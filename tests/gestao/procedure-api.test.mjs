import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listProcedures,
  getProcedure,
  saveProcedureDraft,
  publishProcedure,
  archiveProcedure,
  setProcedureExecutionPermission,
  setProcedureManagerCapability,
} from '../../gestao/js/procedure-api.js';

function makeClient(results = {}) {
  const calls = [];
  return {
    calls,
    client: {
      async rpc(name, payload = {}) {
        calls.push({ name, payload });
        const value = results[name];
        if (value instanceof Error) return { data: null, error: value };
        return { data: value ?? null, error: null };
      },
    },
  };
}

test('list/get usam somente RPCs da Biblioteca Clínica', async () => {
  const mock = makeClient({
    bc_procedure_list: [{ id: 'p1', nome: 'Peeling' }],
    bc_procedure_get: { id: 'p1', nome: 'Peeling' },
  });

  assert.deepEqual(await listProcedures({ client: mock.client, includeArchived: true }), [{ id: 'p1', nome: 'Peeling' }]);
  assert.deepEqual(await getProcedure({ client: mock.client, procedureId: 'p1' }), { id: 'p1', nome: 'Peeling' });
  assert.deepEqual(mock.calls, [
    { name: 'bc_procedure_list', payload: { p_include_archived: true } },
    { name: 'bc_procedure_get', payload: { p_procedure_id: 'p1' } },
  ]);
});

test('salvar rascunho envia conteúdo clínico sem autoria, publicação ou permissão forjadas pelo browser', async () => {
  const mock = makeClient({ bc_procedure_save_draft: 'p1' });
  const payload = {
    nome: 'Peeling',
    classe_documental: 'nao_injetavel',
    price_mode: 'starting_at',
    base_price: 195,
    suggested_duration: 45,
    protocol_mode: 'simple',
    specific_schema: { fields: [] },
    technical_schema: { reference_steps: [] },
    created_by: 'forjado',
    published_by: 'forjado',
    professional_user_id: 'forjado',
    allowed: true,
  };

  await saveProcedureDraft({ client: mock.client, procedureId: null, payload });
  const call = mock.calls[0];
  assert.equal(call.name, 'bc_procedure_save_draft');
  assert.equal(call.payload.p_procedure_id, null);
  assert.equal(call.payload.p_payload.nome, 'Peeling');
  for (const forbidden of ['created_by','published_by','professional_user_id','allowed','granted_by']) {
    assert.equal(Object.hasOwn(call.payload.p_payload, forbidden), false, `${forbidden} não deve sair do browser`);
  }
});

test('publicar, arquivar, autorizar execução e habilitar gestora usam RPCs dedicadas', async () => {
  const mock = makeClient({
    bc_procedure_publish: 'v1',
    bc_procedure_archive: true,
    bc_procedure_set_execution_permission: true,
    bc_staff_set_procedure_manager: true,
  });

  await publishProcedure({ client: mock.client, procedureId: 'p1' });
  await archiveProcedure({ client: mock.client, procedureId: 'p1' });
  await setProcedureExecutionPermission({ client: mock.client, procedureId: 'p1', professionalUserId: 'u1', allowed: true });
  await setProcedureManagerCapability({ client: mock.client, userId: 'u1', enabled: true });

  assert.deepEqual(mock.calls, [
    { name: 'bc_procedure_publish', payload: { p_procedure_id: 'p1' } },
    { name: 'bc_procedure_archive', payload: { p_procedure_id: 'p1' } },
    { name: 'bc_procedure_set_execution_permission', payload: { p_procedure_id: 'p1', p_professional_user_id: 'u1', p_allowed: true } },
    { name: 'bc_staff_set_procedure_manager', payload: { p_user_id: 'u1', p_enabled: true } },
  ]);
});

test('erros RPC são propagados para a interface tratar', async () => {
  const mock = makeClient({ bc_procedure_publish: new Error('sem permissão') });
  await assert.rejects(() => publishProcedure({ client: mock.client, procedureId: 'p1' }), /sem permissão/);
});
