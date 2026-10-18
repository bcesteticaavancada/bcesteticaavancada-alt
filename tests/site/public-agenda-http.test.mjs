import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { validatePublicAgendaPayload } from '../../supabase/functions/public-agenda/domain.js';

// Run the real Edge entry point. Only Deno's listener/env and the external
// Supabase transport are replaced; validation, CORS, mapping and DTOs are real.
async function handlerFor(rpcImpl = async () => ({ data: [], error: null }), configured = true) {
  const [validation, entry] = await Promise.all(['validation.ts', 'index.ts'].map((name) =>
    readFile(new URL(`../../supabase/functions/public-agenda/${name}`, import.meta.url), 'utf8')));
  let handler;
  const calls = [];
  const env = configured ? {
    SUPABASE_URL: 'https://example.invalid',
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'fake-backend-key' }),
    PUBLIC_AGENDA_RATE_LIMIT_SALT: 'only-a-fictitious-test-salt',
  } : {};
  const context = vm.createContext({
    Request, Response, Headers, TextEncoder, crypto: webcrypto,
    validatePublicAgendaPayload,
    console: { error() {} },
    createClient: () => ({ rpc: async (name, args) => {
      calls.push([name, args]); return rpcImpl(name, args);
    } }),
    Deno: { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn; } },
  });
  for (const source of [validation, entry]) {
    const script = stripTypeScriptTypes(source.replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '').replace('if (import.meta.main) ', ''));
    vm.runInContext(script, context);
  }
  return { handler, calls };
}

const ORIGIN = 'https://bcesteticaavancada.github.io';
function request(payload, options = {}) {
  return new Request('https://example.invalid/functions/v1/public-agenda', {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify(payload), ...options,
  });
}
const procedureId = '11111111-1111-4111-8111-111111111111';
const professionalId = '22222222-2222-4222-8222-222222222222';
const booking = { action: 'book', procedureId, professionalId, date: '2026-10-20', time: '14:30',
  name: 'Cliente Fictícia', phone: '(31) 99999-0000', website: '' };

test('HTTP público valida preflight, método, JSON, payload e origem antes de acessar banco', async () => {
  const { handler, calls } = await handlerFor();
  for (const [req, expected] of [
    [new Request('https://example.invalid', { method: 'OPTIONS', headers: { origin: ORIGIN } }), 204],
    [new Request('https://example.invalid'), 405],
    [request(null, { body: '{' }), 400],
    [request({ action: 'delete_all' }), 422],
    [request({ action: 'catalog' }, { headers: { origin: 'https://attacker.invalid' } }), 403],
  ]) {
    const response = await handler(req);
    assert.equal(response.status, expected);
    if (expected !== 204) assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls.length, 0);
});

test('HTTP catálogo e disponibilidade removem identidade e informações internas', async () => {
  const { handler } = await handlerFor(async (name) => ({ data:
    name === 'bc_public_agenda_catalog' ? [{ id: procedureId, name: 'Procedimento CI', duration: 30, internal_note: 'PRIVATE' }]
    : name === 'bc_public_agenda_month' ? [{ date: '2026-10-20', available: true, patient_name: 'PRIVATE' }]
    : [{ time: '14:30', patient_name: 'PRIVATE' }], error: null }));
  for (const payload of [{ action: 'catalog' },
    { action: 'month', procedureId, professionalId, month: '2026-10' },
    { action: 'slots', procedureId, professionalId, date: '2026-10-20' }]) {
    const response = await handler(request(payload));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /PRIVATE|patient_name|internal_note/);
  }
});

test('HTTP overview usa uma consulta e entrega apenas dia, disponibilidade e estado', async () => {
  const { handler, calls } = await handlerFor(async () => ({ data: [
    { date:'2027-10-01', available:true, professionalId:'PRIVATE', patient_name:'PRIVATE', reason:'PRIVATE' },
    { date:'2027-10-02', available:false, internal_note:'PRIVATE' },
  ], error:null }));
  const response = await handler(request({ action:'overview', month:'2027-10', professionalId:'PRIVATE' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { month:'2027-10', days:[
    { date:'2027-10-01', available:true, state:'available' },
    { date:'2027-10-02', available:false, state:'unavailable' },
  ] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'bc_public_agenda_overview');
  assert.equal(JSON.stringify(calls[0][1]), JSON.stringify({ p_month:'2027-10-01' }));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('HTTP overview traduz rejeição de horizonte sem expor detalhes do banco', async () => {
  const { handler, calls } = await handlerFor(async () => ({ data:null, error:{ code:'22023', message:'PRIVATE invalid month' } }));
  const response = await handler(request({ action:'overview', month:'2027-11' }));
  assert.equal(response.status, 422);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(await response.text(), /PRIVATE|invalid month/);
});

test('HTTP reserva futura preserva o dia local e o contrato existente', async () => {
  const { handler, calls } = await handlerFor(async (name) => ({ data:
    name === 'bc_public_agenda_catalog' ? [{ id:procedureId, name:'Procedimento CI', duration:30 }]
    : name === 'bc_public_agenda_professionals' ? [{ id:professionalId, name:'Profissional CI' }]
    : { appointment_id:'future-reservation' }, error:null }));
  const response = await handler(request({ ...booking, date:'2027-10-16' }));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).booking.date, '2027-10-16');
  assert.equal(calls.find(([name]) => name === 'bc_public_agenda_book')[1].p_inicio, '2027-10-16T17:30:00.000Z');
});

test('HTTP não reserva profissional fora das permissões públicas do procedimento', async () => {
  const { handler, calls } = await handlerFor(async (name) => ({ data:
    name === 'bc_public_agenda_catalog' ? [{ id:procedureId, name:'Procedimento CI', duration:30 }] : [], error:null }));
  const response = await handler(request({ ...booking, date:'2027-10-16' }));
  assert.equal(response.status, 422);
  assert.equal(calls.some(([name]) => name === 'bc_public_agenda_book'), false);
  assert.doesNotMatch(await response.text(), /booking|appointment_id/);
});

test('HTTP confirma reserva com DTO mínimo e hash da origem, sem IP bruto', async () => {
  const { handler, calls } = await handlerFor(async (name) => ({ data:
    name === 'bc_public_agenda_catalog' ? [{ id: procedureId, name: 'Procedimento CI', duration: 30 }]
    : name === 'bc_public_agenda_professionals' ? [{ id: professionalId, name: 'Profissional CI' }]
    : { appointment_id: 'reservation-ci', internal_note: 'PRIVATE', cliente_id: null }, error: null }));
  const response = await handler(request(booking, { headers: { origin: ORIGIN, 'x-forwarded-for': '192.0.2.1' } }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { booking: {
    id: 'reservation-ci', procedureName: 'Procedimento CI', professionalName: 'Profissional CI',
    date: '2026-10-20', time: '14:30',
  } });
  const [, args] = calls.find(([name]) => name === 'bc_public_agenda_book');
  assert.match(args.p_origin_hash, /^[a-f0-9]{64}$/);
  assert.equal(args.p_inicio, '2026-10-20T17:30:00.000Z');
  assert.doesNotMatch(JSON.stringify(args), /192\.0\.2\.1|cliente_id/);
});

test('HTTP apresenta 409, 429 e 500 sanitizados e usa 503 sem configuração', async () => {
  for (const [error, expected, fragment] of [
    [{ code: '23P01', message: 'slot_unavailable INTERNAL' }, 409, /acabou de ser reservado/],
    [{ code: '53300', message: 'rate_limit_exceeded INTERNAL' }, 429, /Muitas tentativas/],
    [{ code: 'XX000', message: 'postgres secret INTERNAL' }, 500, /Não foi possível/],
  ]) {
    const { handler } = await handlerFor(async () => ({ data: null, error }));
    const response = await handler(request({ action: 'catalog' }));
    assert.equal(response.status, expected);
    const body = await response.text();
    assert.match(body, fragment);
    assert.doesNotMatch(body, /INTERNAL|postgres|secret/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const { handler } = await handlerFor(undefined, false);
  assert.equal((await handler(request({ action: 'catalog' }))).status, 503);
});

test('HTTP não confirma reserva quando RPC devolve recusa persistida no DTO', async () => {
  for (const [code, expected] of [['23P01', 409], ['53300', 429], ['22023', 422]]) {
    const { handler } = await handlerFor(async (name) => ({ data:
      name === 'bc_public_agenda_catalog' ? [{ id: procedureId, name: 'Procedimento CI', duration: 30 }]
      : name === 'bc_public_agenda_professionals' ? [{ id: professionalId, name: 'Profissional CI' }]
      : { error_code: code, error: 'PRIVATE error from DB' }, error: null }));
    const response = await handler(request(booking));
    assert.equal(response.status, expected);
    const body = await response.text();
    assert.doesNotMatch(body, /PRIVATE|appointment_id|"booking"/);
  }
});

test('HTTP recovery delegates key and identity to the atomic RPC and returns only confirmation',async()=>{
 const key='a3000000-0000-4000-8000-000000000001';
 const {handler,calls}=await handlerFor(async()=>({data:{appointment_id:'same',procedure_name:'Pele',professional_name:'Alice',internal_note:'PRIVATE'},error:null}));
 const response=await handler(request({...booking,requestKey:key}));
 assert.equal(response.status,201);assert.equal(calls.length,1);assert.equal(calls[0][0],'bc_public_agenda_book_v2');
 assert.equal(calls[0][1].p_request_key,key);assert.equal((await response.json()).booking.id,'same');
 const mismatch=await handlerFor(async()=>({data:null,error:{code:'23505',message:'request_key_mismatch PRIVATE'}}));
 const denied=await mismatch.handler(request({...booking,requestKey:key}));assert.equal(denied.status,409);assert.doesNotMatch(await denied.text(),/PRIVATE/);
});

test('HTTP recovery accepts only the secret request key and returns no contact identity',async()=>{
 const {handler,calls}=await handlerFor(async()=>({data:{appointment_id:'old',procedure_name:'Pele',professional_name:'Alice',start_at:'2026-10-20T21:00:00Z',patient_name:'PRIVATE'},error:null}));
 const result=await handler(request({action:'recover',requestKey:'a3000000-0000-4000-8000-000000000001',name:'IGNORE'}));assert.equal(result.status,200);
 const body=await result.text();assert.doesNotMatch(body,/PRIVATE|IGNORE|patient/);assert.match(body,/18:00/);assert.equal(calls[0][0],'bc_public_agenda_recover');
});
