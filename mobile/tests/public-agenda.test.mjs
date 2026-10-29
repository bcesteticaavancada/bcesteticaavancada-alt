import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgendaReadError,
  createFixtureAgendaReader,
  createPublicAgendaReader,
} from '../src/services/publicAgenda.ts';

const ENDPOINT = 'https://example.supabase.co/functions/v1/public-agenda';
const PROCEDURE_ID = '00000000-0000-4000-8000-000000000001';
const PROFESSIONAL_ID = '00000000-0000-4000-8000-000000000101';

test('fixtures permitem percorrer catálogo, profissionais, dias e horários sem rede', async () => {
  const reader = createFixtureAgendaReader();
  const catalog = await reader.getCatalog();
  assert.ok(catalog.length >= 3);
  const staff = await reader.getProfessionals(catalog[0].id);
  assert.equal(staff.length, 1);
  const days = await reader.getMonth(catalog[0].id, staff[0].id, '2026-11');
  assert.ok(days.length > 0);
  assert.ok(days.every((day) => day.date.startsWith('2026-11-')));
  const slots = await reader.getSlots(catalog[0].id, staff[0].id, '2026-11-02');
  assert.ok(slots.includes('09:00'));
  assert.equal('book' in reader, false);
  assert.equal('recover' in reader, false);
});

test('cliente remoto faz somente POST de leitura no endpoint aprovado', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    const payload = JSON.parse(init.body);
    requests.push({ url, method: init.method, payload });
    if (payload.action === 'catalog') return new Response(JSON.stringify({
      procedures: [{ id: PROCEDURE_ID, name: 'Limpeza de pele', durationMinutes: 60 }],
    }), { status: 200 });
    if (payload.action === 'professionals') return new Response(JSON.stringify({
      professionals: [{ id: PROFESSIONAL_ID, name: 'Profissional fictícia' }],
    }), { status: 200 });
    if (payload.action === 'month') return new Response(JSON.stringify({
      days: [{ date: '2026-11-02', available: true }, { date: '2026-11-03', available: false }],
    }), { status: 200 });
    return new Response(JSON.stringify({ slots: ['09:00', '10:00', '09:00', '25:00'] }), { status: 200 });
  };
  const reader = createPublicAgendaReader({ endpoint: ENDPOINT, fetchImpl });
  assert.equal((await reader.getCatalog())[0].name, 'Limpeza de pele');
  assert.equal((await reader.getProfessionals(PROCEDURE_ID))[0].name, 'Profissional fictícia');
  assert.equal((await reader.getMonth(PROCEDURE_ID, PROFESSIONAL_ID, '2026-11'))[0].state, 'available');
  assert.deepEqual(await reader.getSlots(PROCEDURE_ID, PROFESSIONAL_ID, '2026-11-02'), ['09:00', '10:00']);
  assert.deepEqual(requests.map((item) => item.payload.action), ['catalog', 'professionals', 'month', 'slots']);
  assert.ok(requests.every((item) => item.url === ENDPOINT && item.method === 'POST'));
  assert.equal('book' in reader, false);
  assert.equal('recover' in reader, false);
});

test('recusa endpoint HTTP e ações com identificadores inválidos antes da rede', async () => {
  assert.throws(() => createPublicAgendaReader({
    endpoint: 'http://example.supabase.co/functions/v1/public-agenda',
  }), AgendaReadError);
  let calls = 0;
  const reader = createPublicAgendaReader({
    endpoint: ENDPOINT,
    fetchImpl: async () => { calls += 1; throw Error('não chamar'); },
  });
  await assert.rejects(reader.getProfessionals('id-invalido'), AgendaReadError);
  await assert.rejects(reader.getSlots(PROCEDURE_ID, PROFESSIONAL_ID, '2026-02-30'), AgendaReadError);
  await assert.rejects(reader.getMonth(PROCEDURE_ID, PROFESSIONAL_ID, '2026-14'), AgendaReadError);
  assert.equal(calls, 0);
});

test('erro de limite de consultas não revela mensagem arbitrária do servidor', async () => {
  const reader = createPublicAgendaReader({
    endpoint: ENDPOINT,
    fetchImpl: async () => new Response(JSON.stringify({ error: 'segredo-indesejado' }), { status: 429 }),
  });
  await assert.rejects(
    reader.getCatalog(),
    (error) => error instanceof AgendaReadError && error.status === 429 && !error.message.includes('segredo-indesejado'),
  );
});

test('fixture respeita a duração real de cada mês e oculta horários de domingo', async () => {
  const reader = createFixtureAgendaReader();
  const february = await reader.getMonth(PROCEDURE_ID, PROFESSIONAL_ID, '2027-02');
  assert.equal(february.length, 28);
  const leapFebruary = await reader.getMonth(PROCEDURE_ID, PROFESSIONAL_ID, '2028-02');
  assert.equal(leapFebruary.length, 29);
  const october = await reader.getMonth(PROCEDURE_ID, PROFESSIONAL_ID, '2026-10');
  assert.equal(october.length, 31);
  assert.equal(october.at(-1).date, '2026-10-31');
  const sunday = october.find((day) => day.date === '2026-10-25');
  assert.equal(sunday.available, false);
  assert.deepEqual(await reader.getSlots(PROCEDURE_ID, PROFESSIONAL_ID, '2026-10-25'), []);
});

test('fixture não contém dados de pacientes nem métodos de gravação', async () => {
  const reader = createFixtureAgendaReader();
  assert.deepEqual(Object.keys(reader).sort(), ['getCatalog', 'getMonth', 'getProfessionals', 'getSlots']);
  const data = JSON.stringify(await reader.getCatalog());
  assert.equal(/cpf|telefone|email|patient|clienteId/i.test(data), false);
});
