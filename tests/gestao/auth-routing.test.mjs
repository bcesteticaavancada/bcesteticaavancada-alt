import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { destinationForRole } from '../../gestao/js/routes.js';

const root = process.cwd();

async function importFresh(rel) {
  const url = pathToFileURL(path.join(root, rel));
  url.searchParams.set('t', String(Date.now()) + Math.random());
  return import(url.href);
}

test('role routing stays explicit and fails closed', () => {
  assert.equal(destinationForRole('admin'), '../admin/');
  assert.equal(destinationForRole('colaborador'), '../colaborador/');
  assert.equal(destinationForRole('desconhecido'), null);
  assert.equal(destinationForRole(''), null);
  assert.equal(destinationForRole(null), null);
});

test('public Supabase config exists and contains no privileged config marker', async () => {
  const rel = 'gestao/js/config.js';
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.doesNotMatch(source, /privileged_server_key/i);
  const config = await importFresh(rel);
  assert.equal(config.SUPABASE_URL, 'https://tpqsmerlxquyrzrjbogj.supabase.co');
  assert.match(config.SUPABASE_PUBLISHABLE_KEY, /^(sb_publishable_|eyJ)/);
  assert.ok(config.SUPABASE_PUBLISHABLE_KEY.length > 20);
});

test('Supabase client factory receives only public config and safe session options', async () => {
  const rel = 'gestao/js/supabase-client.js';
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  const { createBcGestaoClient } = await importFresh(rel);
  const calls = [];
  const expectedClient = { kind: 'fake-client' };
  const fakeFactory = (...args) => {
    calls.push(args);
    return expectedClient;
  };

  const client = createBcGestaoClient(fakeFactory);
  assert.equal(client, expectedClient);
  assert.equal(calls.length, 1);
  const [url, key, options] = calls[0];
  assert.equal(url, 'https://tpqsmerlxquyrzrjbogj.supabase.co');
  assert.match(key, /^(sb_publishable_|eyJ)/);
  assert.equal(options.auth.persistSession, true);
  assert.equal(options.auth.autoRefreshToken, true);
  assert.equal(options.auth.detectSessionInUrl, true);
});

test('Supabase client factory fails closed when SDK factory is absent', async () => {
  const rel = 'gestao/js/supabase-client.js';
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  const { createBcGestaoClient } = await importFresh(rel);
  assert.throws(() => createBcGestaoClient(), /Supabase SDK/i);
});
