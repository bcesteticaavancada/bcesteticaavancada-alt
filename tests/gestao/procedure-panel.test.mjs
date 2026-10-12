import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  canManageProcedureLibrary,
  renderProcedureEditor,
  renderProcedureCards,
  initProcedurePanel,
} from '../../gestao/js/procedure-panel.js';

const adminHtmlUrl = new URL('../../gestao/admin/index.html', import.meta.url);
const collaboratorHtmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);

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

test('HTML admin troca formulário simples pela Biblioteca Clínica', async () => {
  const html = await readFile(adminHtmlUrl,'utf8');
  assert.match(html,/id=["']procedureLibrary["']/);
  assert.match(html,/procedure-panel\.js/);
  assert.doesNotMatch(html,/id=["']procedureForm["']/);
});

test('HTML colaboradora oferece área oculta que só runtime autorizado revela', async () => {
  const html = await readFile(collaboratorHtmlUrl,'utf8');
  assert.match(html,/id=["']procedureLibraryNav["'][^>]*hidden/);
  assert.match(html,/id=["']procedureLibraryArea["'][^>]*hidden/);
  assert.match(html,/procedure-panel\.js/);
});

test('initProcedurePanel é função compartilhada', () => assert.equal(typeof initProcedurePanel,'function'));
