import test from 'node:test';
import assert from 'node:assert/strict';

async function loadStaff() {
  try { return await import('../../gestao/js/admin-staff-profile.js'); }
  catch (error) { assert.fail(`admin-staff-profile.js deve existir: ${error?.code || error}`); }
}

test('identidade clínica profissional só envia campos profissionais pelo RPC administrativo', async () => {
  const { updateStaffClinicalIdentity } = await loadStaff();
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: true, error: null }; } };
  await updateStaffClinicalIdentity({ client, userId: 'u1', profissao: 'Biomédica Esteta', conselho: 'CRBM', registroConselho: '12345' });
  assert.deepEqual(calls[0], {
    name: 'bc_staff_update_clinical_identity',
    args: { p_user_id: 'u1', p_profissao: 'Biomédica Esteta', p_conselho: 'CRBM', p_registro_conselho: '12345' },
  });
});

test('helper detecta perfil incompleto sem inventar conselho ou registro', async () => {
  const { hasCompleteClinicalIdentity } = await loadStaff();
  assert.equal(hasCompleteClinicalIdentity({ profissao: 'Biomédica', conselho: 'CRBM', registro_conselho: '123' }), true);
  assert.equal(hasCompleteClinicalIdentity({ profissao: 'Biomédica', conselho: '', registro_conselho: '123' }), false);
  assert.equal(hasCompleteClinicalIdentity({ profissao: 'Biomédica', conselho: 'CRBM', registro_conselho: '' }), false);
});
