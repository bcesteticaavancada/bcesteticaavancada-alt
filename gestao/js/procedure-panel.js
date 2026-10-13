import {
  listProcedures,
  getProcedure,
  saveProcedureDraft,
  publishProcedure,
  archiveProcedure,
  setProcedureExecutionPermission,
  setProcedureManagerCapability,
} from './procedure-api.js';
import { listStaffDirectory } from './agenda-api.js';
import { formatProcedurePrice } from './procedure-domain.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function checked(value) { return value ? ' checked' : ''; }
function selected(value, current) { return String(value) === String(current) ? ' selected' : ''; }

export function canManageProcedureLibrary(profile = {}) {
  return profile.role === 'admin' || profile.pode_gerenciar_procedimentos === true;
}

function editorVersion(procedure) {
  return procedure?.draft_version || procedure?.current_version || {};
}

export function renderProcedureEditor(profile = {}, procedure = null) {
  const v = editorVersion(procedure);
  const isNew = !procedure?.id;
  return `<form class="bcg-form bcg-form-grid bcg-procedure-editor" data-procedure-editor data-procedure-id="${escapeHtml(procedure?.id || '')}">
    <div class="bcg-field-wide bcg-editor-head"><div><p class="bcg-eyebrow">${isNew ? 'NOVO PROCEDIMENTO' : 'EDITAR PROCEDIMENTO'}</p><h3>${escapeHtml(procedure?.nome || 'Cadastro clínico')}</h3></div><button type="button" class="bcg-small-button" data-procedure-new>Limpar</button></div>
    <label class="bcg-field-wide">Nome<input class="bcg-input" name="nome" value="${escapeHtml(v.nome || procedure?.nome || '')}" required></label>
    <label>Classe documental<select class="bcg-input" name="classe_documental" required><option value="nao_injetavel"${selected('nao_injetavel',v.classe_documental || 'nao_injetavel')}>Não injetável</option><option value="injetavel"${selected('injetavel',v.classe_documental)}>Injetável / invasivo</option></select></label>
    <label>Categoria<input class="bcg-input" name="categoria" value="${escapeHtml(v.categoria || '')}"></label>
    <label>Preço<select class="bcg-input" name="price_mode"><option value="fixed"${selected('fixed',v.price_mode || 'fixed')}>Valor fechado</option><option value="starting_at"${selected('starting_at',v.price_mode)}>A partir de</option></select></label>
    <label>Valor-base<input class="bcg-input" name="base_price" type="number" min="0.01" step="0.01" value="${escapeHtml(v.base_price ?? '')}" required></label>
    <label>Duração sugerida (min)<input class="bcg-input" name="suggested_duration" type="number" min="1" step="1" value="${escapeHtml(v.suggested_duration ?? '')}"></label>
    <label>Tipo de protocolo<select class="bcg-input" name="protocol_mode"><option value="simple"${selected('simple',v.protocol_mode || 'simple')}>Simples</option><option value="compound"${selected('compound',v.protocol_mode)}>Composto / variável</option></select></label>
    <label class="bcg-toggle"><input type="checkbox" name="requires_general_anamnesis"${checked(v.requires_general_anamnesis !== false)}> Exige Anamnese Geral válida</label>
    <label class="bcg-toggle"><input type="checkbox" name="requires_return"${checked(v.requires_return)}> Exige/recomenda retorno</label>
    <label>Intervalo de retorno (dias)<input class="bcg-input" name="return_interval_days" type="number" min="1" step="1" value="${escapeHtml(v.return_interval_days ?? '')}"></label>
    <label class="bcg-field-wide">Descrição<textarea class="bcg-input bcg-textarea" name="descricao" rows="3">${escapeHtml(v.descricao || '')}</textarea></label>
    <label class="bcg-field-wide">Orientações pré<textarea class="bcg-input bcg-textarea" name="pre_guidance" rows="3">${escapeHtml(v.pre_guidance || '')}</textarea></label>
    <label class="bcg-field-wide">Orientações pós<textarea class="bcg-input bcg-textarea" name="post_guidance" rows="3">${escapeHtml(v.post_guidance || '')}</textarea></label>
    <label class="bcg-field-wide">Complemento do consentimento <span class="bcg-optional">opcional</span><textarea class="bcg-input bcg-textarea" name="consent_supplement" rows="3">${escapeHtml(v.consent_supplement || '')}</textarea></label>
    <div class="bcg-field-wide bcg-form-actions"><button class="bcg-button" type="submit">Salvar rascunho</button><button class="bcg-small-button" type="button" data-procedure-publish${procedure?.id ? '' : ' disabled'}>Publicar</button><span class="bcg-status" data-procedure-editor-status></span></div>
  </form>`;
}

export function renderProcedureCards(procedures = [], profile = {}) {
  if (!procedures.length) return '<div class="bcg-empty">Nenhum procedimento encontrado.</div>';
  const isAdmin = profile.role === 'admin';
  return `<div class="bcg-procedure-grid">${procedures.map((p) => {
    const v = p.current_version || p.draft_version || {};
    const status = p.archived_at ? 'Arquivado' : p.draft_version ? 'Rascunho pendente' : 'Publicado';
    return `<article class="bcg-procedure-card" data-procedure-card="${escapeHtml(p.id)}">
      <div><p class="bcg-eyebrow">${escapeHtml(v.categoria || 'PROCEDIMENTO')}</p><h3>${escapeHtml(p.nome || v.nome || 'Procedimento')}</h3><p>${escapeHtml(formatProcedurePrice(v) || '')}</p></div>
      <div class="bcg-procedure-meta"><span>${escapeHtml(v.classe_documental === 'injetavel' ? 'Injetável / invasivo' : 'Não injetável')}</span><span>v${escapeHtml(v.version || '—')}</span><span>${escapeHtml(status)}</span></div>
      <div class="bcg-actions"><button class="bcg-small-button" type="button" data-procedure-edit="${escapeHtml(p.id)}">Editar</button>${isAdmin ? `<button class="bcg-small-button" type="button" data-procedure-permissions="${escapeHtml(p.id)}">Permissões</button><button class="bcg-small-button" type="button" data-procedure-archive="${escapeHtml(p.id)}">Arquivar</button>` : ''}</div>
    </article>`;
  }).join('')}</div>`;
}

export function renderProcedureLibraryShell(profile = {}) {
  return `<div id="procedureLibrary" class="bcg-procedure-library">
    <div class="bcg-section-head"><div><p class="bcg-eyebrow">BIBLIOTECA CLÍNICA</p><h2>Procedimentos e protocolos</h2><p class="bcg-muted">Versões clínicas, valores e regras de documentação da BC.</p></div><button class="bcg-button" type="button" data-procedure-new>Novo procedimento</button></div>
    <div data-procedure-editor-slot>${renderProcedureEditor(profile)}</div>
    ${profile.role === 'admin' ? `<section class="bcg-procedure-admin" data-procedure-admin-controls><p class="bcg-eyebrow">ADMINISTRAÇÃO</p><h3>Capacidades e execução clínica</h3><div class="bcg-subgrid"><form class="bcg-form" data-manager-form><label>Profissional<select class="bcg-input" name="user_id" data-staff-options></select></label><label>Gestão da biblioteca<select class="bcg-input" name="enabled"><option value="true">Pode gerenciar</option><option value="false">Não pode gerenciar</option></select></label><button class="bcg-small-button" type="submit">Salvar capacidade</button><span class="bcg-status"></span></form><form class="bcg-form" data-execution-form><label>Procedimento<select class="bcg-input" name="procedure_id" data-procedure-options></select></label><label>Profissional<select class="bcg-input" name="user_id" data-staff-options></select></label><label>Execução<select class="bcg-input" name="allowed"><option value="true">Pode executar</option><option value="false">Revogar execução</option></select></label><button class="bcg-small-button" type="submit">Salvar execução</button><span class="bcg-status"></span></form></div></section>` : ''}
    <div class="bcg-divider"></div><div data-procedure-list><div class="bcg-empty">Carregando biblioteca…</div></div>
  </div>`;
}

function installStyle(root) {
  const doc = root?.ownerDocument || root;
  if (!doc?.head || doc.querySelector?.('link[data-procedure-library-styles]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../assets/procedure-library.css', import.meta.url).href;
  link.dataset.procedureLibraryStyles = 'true';
  doc.head.append(link);
}

function ensureArea(root, profile) {
  let area = root.getElementById?.('procedimentos');
  if (!area) {
    const main = root.querySelector?.('.bcg-dashboard-main');
    if (!main) return null;
    area = root.createElement('section');
    area.id = 'procedimentos';
    area.className = 'bcg-panel';
    area.dataset.areaPanel = '';
    area.hidden = true;
    const footer = main.querySelector?.('.bcg-footer');
    main.insertBefore(area, footer || null);
  }

  let host = area.querySelector?.('[data-procedure-library-host]');
  if (!host) {
    host = root.createElement('div');
    host.dataset.procedureLibraryHost = '';
    area.insertBefore(host, area.firstChild || null);
  }
  host.innerHTML = renderProcedureLibraryShell(profile);

  const legacyForm = area.querySelector?.('#procedureForm');
  legacyForm?.closest?.('.bcg-subgrid')?.remove();
  Array.from(area.children || []).forEach((node) => {
    const text = String(node.textContent || '').trim();
    if ((node.matches?.('.bcg-eyebrow') && text === 'PROCEDIMENTOS')
      || (node.matches?.('h2') && text === 'Cadastro de procedimentos')) node.remove();
  });

  const nav = root.querySelector?.('.bcg-menu-nav');
  if (nav && !nav.querySelector?.('[data-area-target="procedimentos"]')) {
    const link = root.createElement('a');
    link.href = '#procedimentos';
    link.dataset.nav = '';
    link.dataset.areaTarget = 'procedimentos';
    link.id = 'procedureLibraryNav';
    link.textContent = 'Procedimentos';
    const install = nav.querySelector?.('a[href*="instalar"]');
    nav.insertBefore(link, install || null);
  }
  return area;
}

function formValue(form, name) { return form.elements?.[name]?.value ?? ''; }
function formChecked(form, name) { return Boolean(form.elements?.[name]?.checked); }

function payloadFromForm(form, current = {}) {
  return {
    nome: formValue(form,'nome'),
    classe_documental: formValue(form,'classe_documental'),
    categoria: formValue(form,'categoria'),
    descricao: formValue(form,'descricao'),
    price_mode: formValue(form,'price_mode'),
    base_price: formValue(form,'base_price'),
    suggested_duration: formValue(form,'suggested_duration'),
    requires_general_anamnesis: formChecked(form,'requires_general_anamnesis'),
    requires_return: formChecked(form,'requires_return'),
    return_interval_days: formValue(form,'return_interval_days'),
    pre_guidance: formValue(form,'pre_guidance'),
    post_guidance: formValue(form,'post_guidance'),
    consent_supplement: formValue(form,'consent_supplement'),
    protocol_mode: formValue(form,'protocol_mode'),
    specific_schema: current.specific_schema || {},
    technical_schema: current.technical_schema || {},
    component_version_ids: current.component_version_ids || [],
    requires_photo: Boolean(current.requires_photo),
    requires_product_lot: Boolean(current.requires_product_lot),
    requires_equipment: Boolean(current.requires_equipment),
  };
}

function setStatus(form, text, kind='') {
  const el = form?.querySelector?.('.bcg-status');
  if (el) { el.textContent = text || ''; el.dataset.kind = kind; }
}

export async function initProcedurePanel({ client, profile, root = document } = {}) {
  if (!client || !root || !canManageProcedureLibrary(profile)) return null;
  installStyle(root);
  const area = ensureArea(root, profile);
  if (!area) return null;

  let procedures = [];
  let staff = [];
  let selected = null;
  const library = area.querySelector('#procedureLibrary');
  const listSlot = library.querySelector('[data-procedure-list]');
  const editorSlot = library.querySelector('[data-procedure-editor-slot]');

  async function refresh() {
    procedures = await listProcedures({ client, includeArchived: profile.role === 'admin' });
    listSlot.innerHTML = renderProcedureCards(procedures, profile);
    if (profile.role === 'admin') {
      staff = await listStaffDirectory({ client });
      const staffOptions = `<option value="">Selecione</option>${staff.map((s)=>`<option value="${escapeHtml(s.user_id)}">${escapeHtml(s.display_name || 'Profissional')}</option>`).join('')}`;
      library.querySelectorAll('[data-staff-options]').forEach((select)=>{ select.innerHTML = staffOptions; });
      const procedureOptions = `<option value="">Selecione</option>${procedures.filter((p)=>!p.archived_at).map((p)=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`).join('')}`;
      library.querySelectorAll('[data-procedure-options]').forEach((select)=>{ select.innerHTML = procedureOptions; });
    }
    return procedures;
  }

  async function openEditor(id) {
    selected = id ? await getProcedure({ client, procedureId: id }) : null;
    editorSlot.innerHTML = renderProcedureEditor(profile, selected);
    editorSlot.scrollIntoView?.({ behavior:'smooth', block:'start' });
  }

  area.addEventListener('submit', async (event) => {
    const form = event.target;
    if (form.matches?.('[data-procedure-editor]')) {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      setStatus(form,'Salvando rascunho…');
      try {
        const current = selected?.draft_version || selected?.current_version || {};
        const id = await saveProcedureDraft({ client, procedureId: form.dataset.procedureId || null, payload: payloadFromForm(form,current) });
        await refresh();
        await openEditor(id);
        setStatus(editorSlot.querySelector('[data-procedure-editor]'),'Rascunho salvo.','success');
      } catch (error) { setStatus(form,error?.message || 'Não foi possível salvar.','error'); }
      finally { if (button) button.disabled = false; }
      return;
    }
    if (form.matches?.('[data-manager-form]')) {
      event.preventDefault();
      try { await setProcedureManagerCapability({ client, userId: form.elements.user_id.value, enabled: form.elements.enabled.value === 'true' }); setStatus(form,'Capacidade atualizada.','success'); }
      catch (error) { setStatus(form,error?.message || 'Não foi possível atualizar.','error'); }
      return;
    }
    if (form.matches?.('[data-execution-form]')) {
      event.preventDefault();
      try { await setProcedureExecutionPermission({ client, procedureId: form.elements.procedure_id.value, professionalUserId: form.elements.user_id.value, allowed: form.elements.allowed.value === 'true' }); setStatus(form,'Permissão clínica atualizada.','success'); }
      catch (error) { setStatus(form,error?.message || 'Não foi possível atualizar.','error'); }
    }
  });

  area.addEventListener('click', async (event) => {
    const target = event.target.closest?.('button,[data-procedure-edit]');
    if (!target) return;
    if (target.matches('[data-procedure-new]')) { await openEditor(null); return; }
    if (target.dataset.procedureEdit) { await openEditor(target.dataset.procedureEdit); return; }
    if (target.matches('[data-procedure-publish]')) {
      const form = target.closest('[data-procedure-editor]');
      const id = form?.dataset?.procedureId;
      if (!id) return;
      target.disabled = true;
      try { await publishProcedure({ client, procedureId:id }); await refresh(); await openEditor(id); }
      catch (error) { setStatus(form,error?.message || 'Não foi possível publicar.','error'); target.disabled=false; }
      return;
    }
    if (target.dataset.procedureArchive && profile.role === 'admin') {
      target.disabled = true;
      try { await archiveProcedure({ client, procedureId:target.dataset.procedureArchive }); await refresh(); }
      catch { target.disabled=false; }
      return;
    }
    if (target.dataset.procedurePermissions && profile.role === 'admin') {
      const form = library.querySelector('[data-execution-form]');
      if (form) { form.elements.procedure_id.value = target.dataset.procedurePermissions; form.scrollIntoView?.({behavior:'smooth'}); }
    }
  });

  await refresh();
  return { refresh, openEditor, area };
}
