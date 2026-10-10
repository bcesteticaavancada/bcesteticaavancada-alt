import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

async function importFresh(rel) {
  const url = pathToFileURL(path.join(root, rel));
  url.searchParams.set('t', String(Date.now()) + Math.random());
  return import(url.href);
}

function makeClient() {
  const calls = { reset: [], update: [] };
  return {
    calls,
    client: {
      auth: {
        async resetPasswordForEmail(email, options) {
          calls.reset.push({ email, options });
          return { data: {}, error: null };
        },
        async updateUser(payload) {
          calls.update.push(payload);
          return { data: { user: { id: 'user-1' } }, error: null };
        },
      },
    },
  };
}

test('auth requests password recovery with trimmed email and approved redirect', async () => {
  const { requestPasswordReset } = await importFresh('gestao/js/auth.js');
  const fake = makeClient();
  await requestPasswordReset('  alice@example.com ', 'https://example.com/gestao/redefinir-senha/', fake.client);
  assert.deepEqual(fake.calls.reset, [{
    email: 'alice@example.com',
    options: { redirectTo: 'https://example.com/gestao/redefinir-senha/' },
  }]);
});

test('auth updates password only when it meets the minimum length', async () => {
  const { updatePassword } = await importFresh('gestao/js/auth.js');
  const fake = makeClient();
  await assert.rejects(() => updatePassword('curta', fake.client), /8 caracteres/i);
  assert.equal(fake.calls.update.length, 0);

  await updatePassword('senha-segura-123', fake.client);
  assert.deepEqual(fake.calls.update, [{ password: 'senha-segura-123' }]);
});

test('login exposes recovery entry and recovery pages are present', () => {
  const login = fs.readFileSync(path.join(root, 'gestao/login/index.html'), 'utf8');
  assert.match(login, /Esqueci minha senha/i);
  assert.match(login, /\.\.\/recuperar-senha\//);

  const recovery = path.join(root, 'gestao/recuperar-senha/index.html');
  const redefine = path.join(root, 'gestao/redefinir-senha/index.html');
  assert.ok(fs.existsSync(recovery), 'missing gestao/recuperar-senha/index.html');
  assert.ok(fs.existsSync(redefine), 'missing gestao/redefinir-senha/index.html');

  const recoveryHtml = fs.readFileSync(recovery, 'utf8');
  assert.match(recoveryHtml, /requestPasswordReset/);
  assert.match(recoveryHtml, /redefinir-senha/);

  const redefineHtml = fs.readFileSync(redefine, 'utf8');
  assert.match(redefineHtml, /updatePassword/);
  assert.match(redefineHtml, /Nova senha/i);
  assert.match(redefineHtml, /Confirmar nova senha/i);
});
