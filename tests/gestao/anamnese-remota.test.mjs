import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../gestao/anamnese-remota/', import.meta.url);

test('página remota usa fragmento #t e nunca token em query/localStorage', async () => {
  const js = await readFile(new URL('anamnese-remota.js', root), 'utf8');
  assert.match(js, /location\.hash|window\.location\.hash/);
  assert.match(js, /#?t=/);
  assert.doesNotMatch(js, /searchParams\.get\(['"](?:token|t)['"]\)|localStorage|sessionStorage/);
});

test('página remota chama somente RPCs remotos e não abre APIs do prontuário', async () => {
  const js = await readFile(new URL('anamnese-remota.js', root), 'utf8');
  assert.match(js, /bc_anamnese_remote_get/);
  assert.match(js, /bc_anamnese_remote_save/);
  assert.doesNotMatch(js, /clinical_documents|clinical_alerts|clientes-photo|pagamento|finance/i);
});

test('HTML remoto identifica pré-preenchimento e revisão profissional posterior', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /Anamnese Geral/i);
  assert.match(html, /revis[aã]o profissional/i);
  assert.match(html, /não finaliza|n[aã]o finaliza/i);
});
