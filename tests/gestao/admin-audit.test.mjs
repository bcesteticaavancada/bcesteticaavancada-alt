import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAuditLog, initAdminAudit } from '../../gestao/js/admin-audit.js';

test('auditoria mostra ator ação entidade e data sem controles de mutação', () => {
  const html=renderAuditLog([{id:'l1',actor_user_id:'mel-id',action:'cliente_archived',entity_type:'clientes',entity_id:'c1',old_data:{ativo:true},new_data:{ativo:false},created_at:'2026-10-10T12:00:00Z'}],new Map([['mel-id','Mel']]));
  for(const text of ['Mel','Cliente arquivado','clientes','c1']) assert.match(html,new RegExp(text,'i'));
  assert.doesNotMatch(html,/editar|excluir|apagar|delete|update/i);
});

test('initAdminAudit é função explícita',()=>assert.equal(typeof initAdminAudit,'function'));
