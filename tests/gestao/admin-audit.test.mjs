import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAuditLog, initAdminAudit } from '../../gestao/js/admin-audit.js';

test('auditoria mostra ator ação entidade e data sem controles de mutação', () => {
  const html=renderAuditLog([{id:'l1',actor_user_id:'mel-id',action:'cliente_archived',entity_type:'clientes',entity_id:'c1',old_data:{ativo:true},new_data:{ativo:false},created_at:'2026-10-10T12:00:00Z'}],new Map([['mel-id','Mel']]));
  for(const text of ['Mel','Cliente arquivado','clientes','c1']) assert.match(html,new RegExp(text,'i'));
  assert.doesNotMatch(html,/editar|excluir|apagar|delete|update/i);
});

test('auditoria traduz todos os eventos financeiros sensíveis da fase 5', () => {
  const actions = [
    ['recebimento_created','Recebimento registrado'],
    ['recebimento_reversed','Recebimento estornado'],
    ['comissao_updated','Comissão atualizada'],
    ['livro_closed','Livro financeiro fechado'],
    ['livro_reopened','Livro financeiro reaberto'],
    ['livro_recalculated','Livro financeiro recalculado'],
    ['repasse_cycle_updated','Ciclo de repasse atualizado'],
    ['repasse_created','Repasse criado'],
    ['repasse_paid','Repasse baixado como pago'],
    ['repasse_reversed','Repasse estornado'],
  ];
  for (const [action, label] of actions) {
    const html = renderAuditLog([{id:'l1',actor_user_id:'mel-id',action,entity_type:'repasses',entity_id:'00000000-0000-0000-0000-000000000001',old_data:null,new_data:{ok:true},created_at:'2026-10-10T12:00:00Z'}],new Map([['mel-id','Mel']]));
    assert.match(html,new RegExp(label,'i'));
  }
});

test('initAdminAudit é função explícita',()=>assert.equal(typeof initAdminAudit,'function'));
