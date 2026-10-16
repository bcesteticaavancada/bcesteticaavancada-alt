import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../../supabase/functions/public-agenda/index.ts', import.meta.url);
const configUrl = new URL('../../supabase/config.toml', import.meta.url);

async function edgeSource() { return readFile(indexUrl, 'utf8'); }
async function configSource() { return readFile(configUrl, 'utf8'); }

test('public-agenda é explicitamente pública no gateway e autoriza somente pelo desenho do handler', async () => {
  const config = await configSource();
  assert.match(config, /\[functions\.public-agenda\]/);
  assert.match(config, /verify_jwt\s*=\s*false/);
});

test('handler usa secret key nova somente no backend e não herda service_role legado', async () => {
  const source = await edgeSource();
  assert.match(source, /SUPABASE_SECRET_KEYS/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /Authorization\s*:\s*[`'"]Bearer/i);
});

test('handler chama somente os RPCs públicos mínimos da agenda', async () => {
  const source = await edgeSource();
  for (const rpc of [
    'bc_public_agenda_catalog',
    'bc_public_agenda_professionals',
    'bc_public_agenda_month',
    'bc_public_agenda_slots',
    'bc_public_agenda_book',
  ]) assert.match(source, new RegExp(rpc));
});

test('rate limit deriva hash SHA-256 sem persistir IP bruto', async () => {
  const source = await edgeSource();
  assert.match(source, /PUBLIC_AGENDA_RATE_LIMIT_SALT/);
  assert.match(source, /crypto\.subtle\.digest\s*\(\s*['"]SHA-256['"]/);
  assert.match(source, /x-forwarded-for/i);
  assert.match(source, /p_origin_hash/);
});

test('handler fixa CORS, no-store e mensagens públicas estáveis', async () => {
  const source = await edgeSource();
  assert.match(source, /https:\/\/bcesteticaavancada\.github\.io/);
  assert.match(source, /http:\/\/localhost:8000/);
  assert.match(source, /Cache-Control['"]?\s*:\s*['"]no-store/i);
  assert.match(source, /Esse horário acabou de ser reservado\. Escolha outro horário disponível\./);
  assert.match(source, /Muitas tentativas em pouco tempo\. Aguarde alguns minutos e tente novamente\./);
});
