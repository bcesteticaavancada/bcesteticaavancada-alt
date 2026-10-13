import test from 'node:test';
import assert from 'node:assert/strict';

async function load() {
  try { return await import('../../gestao/js/anamnese-panel.js'); }
  catch (error) { assert.fail(`anamnese-panel.js deve existir: ${error?.code || error}`); }
}

test('render da anamnese mostra status, versão e CTA sem decisão clínica automática', async () => {
  const { renderAnamnesePanel } = await load();
  const html = renderAnamnesePanel({
    client: { id: 'c1', nome: 'Cliente Teste' },
    state: { id: 'a1', version: 2, status: 'aguardando_revisao_profissional', source: 'remota' },
    versions: [{ id: 'a1', version: 2, status: 'aguardando_revisao_profissional' }, { id: 'a0', version: 1, status: 'substituida' }],
    alerts: [{ id: 'al1', level: 'atencao', description: 'Medicamento informado.' }],
    documents: [],
  });
  assert.match(html, /Anamnese Geral/i);
  assert.match(html, /Versão 2/i);
  assert.match(html, /Aguardando revisão profissional/i);
  assert.match(html, /Medicamento informado/i);
  assert.doesNotMatch(html.toLowerCase(), /procedimento liberado|procedimento contraindicado|diagnóstico automático/);
});

test('construtor de link remoto usa fragmento e nunca query string para token', async () => {
  const { buildRemoteAnamneseUrl } = await load();
  const url = buildRemoteAnamneseUrl({ origin: 'https://bc.example', basePath: '/gestao/anamnese-remota/', token: 'abc 123' });
  assert.equal(url, 'https://bc.example/gestao/anamnese-remota/#t=abc%20123');
  assert.doesNotMatch(url, /[?&](token|t)=/i);
});

test('wizard interno mostra tipos de pele no campo pele_tipo e não respostas binárias', async () => {
  const { renderAnamneseWizard } = await load();
  const html = renderAnamneseWizard({ step: 1 });
  const select = html.match(/<select[^>]*name="pele_tipo"[^>]*>[\s\S]*?<\/select>/)?.[0] || '';
  assert.ok(select, 'select pele_tipo deve ser renderizado');
  for (const label of ['Seca', 'Oleosa', 'Mista', 'Sensível', 'Normal', 'Não sei']) assert.match(select, new RegExp(`>${label}<`));
  assert.doesNotMatch(select, /value="sim"|value="nao"|value="nao_se_aplica"|Prefiro conversar pessoalmente/);
});

test('revisão da anamnese mostra rótulo humano do tipo de pele', async () => {
  const { renderAnamneseReview } = await load();
  const html = renderAnamneseReview({ answers: { pele_tipo: 'sensivel' } });
  assert.match(html, />Sensível</);
  assert.doesNotMatch(html, />sensivel</);
});