import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canManageProcedureLibrary,
  renderProcedureEditor,
  renderProcedureCards,
  renderProcedureLibraryShell,
  initProcedurePanel,
} from '../../gestao/js/procedure-panel.js';

test('capacidade editorial é independente do papel admin', () => {
  assert.equal(canManageProcedureLibrary({ role: 'admin', pode_gerenciar_procedimentos: false }), true);
  assert.equal(canManageProcedureLibrary({ role: 'colaborador', pode_gerenciar_procedimentos: true }), true);
  assert.equal(canManageProcedureLibrary({ role: 'colaborador', pode_gerenciar_procedimentos: false }), false);
});

test('editor contém campos clínicos/comerciais aprovados da 6C', () => {
  const html = renderProcedureEditor({ role: 'admin' });
  for (const field of [
    'nome','classe_documental','price_mode','base_price','categoria','suggested_duration',
    'requires_general_anamnesis','requires_return','return_interval_days','pre_guidance',
    'post_guidance','consent_supplement','protocol_mode',
  ]) assert.match(html, new RegExp(`name=["']${field}["']`));
  assert.match(html, /Salvar rascunho/i);
  assert.match(html, /Publicar/i);
});

test('ações superiores aparecem só para admin', () => {
  const procedures = [{ id:'p1', nome:'Botox full face', current_version:{ version:1, price_mode:'fixed', base_price:1390 } }];
  const admin = renderProcedureCards(procedures, { role:'admin' });
  const collaborator = renderProcedureCards(procedures, { role:'colaborador', pode_gerenciar_procedimentos:true });
  assert.match(admin, /data-procedure-archive/);
  assert.match(admin, /data-procedure-permissions/);
  assert.doesNotMatch(collaborator, /data-procedure-archive|data-procedure-permissions/);
});

test('shell compartilhado identifica Biblioteca Clínica e gestão administrativa', () => {
  const admin = renderProcedureLibraryShell({ role:'admin' });
  const collaborator = renderProcedureLibraryShell({ role:'colaborador', pode_gerenciar_procedimentos:true });
  assert.match(admin,/Biblioteca Clínica/i);
  assert.match(admin,/data-procedure-admin-controls/);
  assert.match(collaborator,/Biblioteca Clínica/i);
  assert.doesNotMatch(collaborator,/data-procedure-admin-controls/);
});

test('initProcedurePanel é função compartilhada para injeção após autenticação', () => {
  assert.equal(typeof initProcedurePanel,'function');
});