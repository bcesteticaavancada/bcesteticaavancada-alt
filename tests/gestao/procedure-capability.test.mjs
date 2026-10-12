import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentProfile } from '../../gestao/js/auth.js';

function makeClient(profile) {
  const calls = { select: [] };
  const query = {
    select(columns) { calls.select.push(columns); return this; },
    eq() { return this; },
    async maybeSingle() { return { data: profile, error: null }; },
  };
  return {
    calls,
    client: {
      auth: {
        async getSession() {
          return { data: { session: { user: { id: profile.user_id } } }, error: null };
        },
      },
      from() { return query; },
    },
  };
}

test('perfil autenticado carrega capacidade de gerenciar procedimentos sem mudar o papel', async () => {
  const source = makeClient({
    user_id: 'staff-1',
    display_name: 'Profissional Teste',
    role: 'colaborador',
    active: true,
    pode_gerenciar_procedimentos: true,
  });

  const profile = await getCurrentProfile(source.client);
  assert.equal(profile.role, 'colaborador');
  assert.equal(profile.pode_gerenciar_procedimentos, true);
  assert.match(source.calls.select[0], /pode_gerenciar_procedimentos/);
});

test('capacidade false permanece false e não concede papel admin', async () => {
  const source = makeClient({
    user_id: 'staff-2',
    display_name: 'Profissional Teste',
    role: 'colaborador',
    active: true,
    pode_gerenciar_procedimentos: false,
  });

  const profile = await getCurrentProfile(source.client);
  assert.equal(profile.role, 'colaborador');
  assert.equal(profile.pode_gerenciar_procedimentos, false);
});
