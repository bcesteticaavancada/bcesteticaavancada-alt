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

function makeClient({ userId = 'user-1', profile = { user_id: 'user-1', display_name: 'Pessoa Teste', role: 'admin', active: true }, profileError = null, signInError = null } = {}) {
  const calls = { signIn: [], signOut: 0, from: [] };
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: profile, error: profileError }; },
  };
  return {
    calls,
    client: {
      auth: {
        async getSession() {
          return { data: { session: userId ? { user: { id: userId } } : null }, error: null };
        },
        async signInWithPassword(credentials) {
          calls.signIn.push(credentials);
          if (signInError) return { data: { session: null, user: null }, error: signInError };
          return { data: { session: { user: { id: userId } }, user: { id: userId } }, error: null };
        },
        async signOut() {
          calls.signOut += 1;
          return { error: null };
        },
      },
      from(table) {
        calls.from.push(table);
        return query;
      },
    },
  };
}

test('role routing stays explicit and fails closed', () => {
  assert.equal(destinationForRole('admin'), '../admin/');
  assert.equal(destinationForRole('colaborador'), '../colaborador/');
  assert.equal(destinationForRole('desconhecido'), null);
  assert.equal(destinationForRole(''), null);
  assert.equal(destinationForRole(null), null);
});

test('routeForRole exposes the approved login destinations', async () => {
  const { routeForRole } = await importFresh('gestao/js/routes.js');
  assert.equal(routeForRole('admin'), '../admin/');
  assert.equal(routeForRole('colaborador'), '../colaborador/');
  assert.equal(routeForRole('outro'), null);
});

test('public Supabase config exists and contains no privileged config marker', async () => {
  const rel = 'gestao/js/config.js';
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.doesNotMatch(source, /privileged_server_key/i);
  assert.doesNotMatch(source, /service_role/i);
  const config = await importFresh(rel);
  assert.equal(config.SUPABASE_URL, 'https://tpqsmerlxquyrzrjbogj.supabase.co');
  assert.match(config.SUPABASE_PUBLISHABLE_KEY, /^sb_publishable_/);
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
  assert.match(key, /^sb_publishable_/);
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

test('auth module reads only the current active known staff profile', async () => {
  const rel = 'gestao/js/auth.js';
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  const { getCurrentProfile } = await importFresh(rel);

  const active = makeClient();
  assert.deepEqual(await getCurrentProfile(active.client), {
    user_id: 'user-1', display_name: 'Pessoa Teste', role: 'admin', active: true,
  });
  assert.deepEqual(active.calls.from, ['staff_profiles']);

  assert.equal(await getCurrentProfile(makeClient({ profile: null }).client), null);
  assert.equal(await getCurrentProfile(makeClient({ profile: { user_id: 'user-1', display_name: 'Inativa', role: 'admin', active: false } }).client), null);
  assert.equal(await getCurrentProfile(makeClient({ profile: { user_id: 'user-1', display_name: 'Inválida', role: 'gestor', active: true } }).client), null);
  assert.equal(await getCurrentProfile(makeClient({ userId: null, profile: null }).client), null);
});

test('signIn authenticates with password and rejects accounts without an active valid profile', async () => {
  const rel = 'gestao/js/auth.js';
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  const { signIn } = await importFresh(rel);

  const ok = makeClient({ profile: { user_id: 'user-1', display_name: 'Alice Teste', role: 'colaborador', active: true } });
  const profile = await signIn('  alice@example.com ', 'senha-teste', ok.client);
  assert.equal(profile.role, 'colaborador');
  assert.deepEqual(ok.calls.signIn, [{ email: 'alice@example.com', password: 'senha-teste' }]);
  assert.equal(ok.calls.signOut, 0);

  const denied = makeClient({ profile: null });
  await assert.rejects(() => signIn('semperfil@example.com', 'senha-teste', denied.client), /acesso ao BC Gestão/i);
  assert.equal(denied.calls.signOut, 1);
});

test('requireRole fails closed, signs out and redirects on role mismatch', async () => {
  const rel = 'gestao/js/auth.js';
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  const { requireRole } = await importFresh(rel);
  const mismatch = makeClient({ profile: { user_id: 'user-1', display_name: 'Alice', role: 'colaborador', active: true } });
  const redirects = [];
  const result = await requireRole('admin', mismatch.client, (url) => redirects.push(url));
  assert.equal(result, null);
  assert.equal(mismatch.calls.signOut, 1);
  assert.deepEqual(redirects, ['../login/']);
});

test('login and role pages are wired to real authentication without hardcoded staff email', () => {
  const login = fs.readFileSync(path.join(root, 'gestao/login/index.html'), 'utf8');
  assert.match(login, /id=["']loginForm["']/);
  assert.match(login, /id=["']loginEmail["']/);
  assert.match(login, /id=["']loginPassword["']/);
  assert.match(login, /@supabase\/supabase-js@2/);
  assert.match(login, /\.\.\/js\/auth\.js/);
  assert.doesNotMatch(login, /mel@|alice@/i);

  const admin = fs.readFileSync(path.join(root, 'gestao/admin/index.html'), 'utf8');
  assert.match(admin, /requireRole\(['"]admin['"]\)/);
  assert.match(admin, /id=["']gestaoApp["'][^>]*hidden/i);
  assert.match(admin, /id=["']logoutBtn["']/);

  const colaborador = fs.readFileSync(path.join(root, 'gestao/colaborador/index.html'), 'utf8');
  assert.match(colaborador, /requireRole\(['"]colaborador['"]\)/);
  assert.match(colaborador, /id=["']gestaoApp["'][^>]*hidden/i);
  assert.match(colaborador, /id=["']logoutBtn["']/);
  assert.doesNotMatch(colaborador, /financeiro|faturamento|pagamentos?/i);
});
