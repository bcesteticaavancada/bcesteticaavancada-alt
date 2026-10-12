import test from 'node:test';
import assert from 'node:assert/strict';

async function loadAlerts() {
  try { return await import('../../gestao/js/clinical-alerts-api.js'); }
  catch (error) { assert.fail(`clinical-alerts-api.js deve existir: ${error?.code || error}`); }
}

function clientWithRpc(result = []) {
  const calls = [];
  return { calls, rpc: async (name, args = {}) => { calls.push({ name, args }); return { data: result, error: null }; } };
}

test('lista alertas pelo RPC compartilhado da cliente', async () => {
  const { listClinicalAlerts } = await loadAlerts();
  const client = clientWithRpc([{ level: 'critico' }]);
  const rows = await listClinicalAlerts({ client, clienteId: 'c1', activeOnly: true });
  assert.deepEqual(client.calls[0], { name: 'bc_clinical_alert_list', args: { p_cliente_id: 'c1', p_active_only: true } });
  assert.equal(rows[0].level, 'critico');
});

test('alerta manual não envia autoria do navegador', async () => {
  const { createManualClinicalAlert } = await loadAlerts();
  const client = clientWithRpc('a1');
  await createManualClinicalAlert({ client, clienteId: 'c1', level: 'atencao', description: 'Relato clínico a revisar' });
  const call = client.calls[0];
  assert.equal(call.name, 'bc_clinical_alert_create_manual');
  assert.deepEqual(call.args, { p_cliente_id: 'c1', p_level: 'atencao', p_description: 'Relato clínico a revisar' });
  assert.doesNotMatch(JSON.stringify(call.args), /created_by|user_id/i);
});

test('inativação de alerta exige motivo via RPC administrativo', async () => {
  const { inactivateClinicalAlert } = await loadAlerts();
  const client = clientWithRpc('a1');
  await inactivateClinicalAlert({ client, alertId: 'a1', reason: 'Revisado em consulta' });
  assert.deepEqual(client.calls[0], { name: 'bc_clinical_alert_inactivate', args: { p_alert_id: 'a1', p_reason: 'Revisado em consulta' } });
});
