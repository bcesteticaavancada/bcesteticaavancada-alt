import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerAppointmentReceipt } from '../../gestao/js/finance-receipts-api.js';

const migrationUrl = new URL('../../supabase/migrations/20261011_bc_gestao_phase5_receipts_by_appointment.sql', import.meta.url);

function makeClient(response = { data: 'receipt-1', error: null }) {
  const calls = [];
  return {
    calls,
    client: {
      rpc: async (name, payload) => {
        calls.push({ name, payload });
        return response;
      },
    },
  };
}

test('registro por agendamento envia somente identificador e dados monetários mínimos', async () => {
  const { client, calls } = makeClient();
  const id = await registerAppointmentReceipt({
    client,
    agendamentoId: ' ag-1 ',
    valor: '220.00',
    formaPagamento: ' Pix ',
    recebidoAt: null,
    observacao: ' sinal ',
  });
  assert.equal(id, 'receipt-1');
  assert.deepEqual(calls[0], {
    name: 'bc_recebimento_registrar_agendamento',
    payload: {
      p_agendamento_id: 'ag-1',
      p_valor: 220,
      p_forma_pagamento: 'Pix',
      p_recebido_at: null,
      p_observacao: 'sinal',
    },
  });
});

test('RPC por agendamento deriva identidade no banco e aceita atendimento clínico opcional', async () => {
  const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
  assert.match(sql, /create\s+or\s+replace\s+function\s+private\.bc_recebimento_registrar_agendamento_impl/);
  assert.match(sql, /from\s+public\.agendamentos[\s\S]*where\s+id\s*=\s*p_agendamento_id/);
  assert.match(sql, /if\s+not\s+private\.is_bc_admin\(\)[\s\S]*v_agendamento\.colaboradora_user_id\s*<>\s*v_user_id/);
  assert.match(sql, /from\s+public\.atendimentos[\s\S]*agendamento_id\s*=\s*p_agendamento_id/);
  assert.match(sql, /v_agendamento\.cliente_id/);
  assert.match(sql, /v_agendamento\.procedimento_id/);
  assert.match(sql, /v_agendamento\.colaboradora_user_id/);
  assert.match(sql, /created_by[\s\S]*v_user_id/);
});

test('wrapper por agendamento é authenticated-only', async () => {
  const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bc_recebimento_registrar_agendamento/);
  assert.match(sql, /security\s+invoker/);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.bc_recebimento_registrar_agendamento[\s\S]*from\s+public/);
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.bc_recebimento_registrar_agendamento[\s\S]*from\s+anon/);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.bc_recebimento_registrar_agendamento[\s\S]*to\s+authenticated/);
});
