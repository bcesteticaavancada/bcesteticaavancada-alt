import { listProcedures } from './procedure-api.js';
import { listStaffDirectory } from './agenda-api.js';
import {
  createTreatment,
  getTreatment,
  listClientTreatments,
  updateTreatmentDraft,
  confirmTreatmentHealthChange,
  confirmTreatmentAlertReview,
  prepareTreatmentConsent,
  markTreatmentReady,
  startTreatment,
  finalizeTreatment,
  completeTreatmentFinalization,
} from './treatment-api.js';
import {
  listClinicalSignatures,
  registerClinicalSignature,
  uploadClinicalSignature,
  finalizeProcedureConsent,
} from './clinical-documents-api.js';
import { createSignaturePad, sha256Blob } from './signature-pad.js';
import { isMinor } from './clientes-domain.js';
import { renderTreatment6dCards, initTreatment6dController } from './treatment-6d-panel.js';

const GATE_LABELS = {
  anamnese_invalida: 'Anamnese Geral válida',
  saude_nao_confirmada: 'Saúde hoje confirmada',
  alertas_nao_revisados: 'Alertas clínicos revisados',
  profissional_nao_autorizada: 'Profissional autorizada',
  consentimento_pendente: 'Consentimento finalizado',
  modulo_especifico_incompleto: 'Ficha específica completa',
};

const STATUS_LABELS = {
  rascunho: 'Rascunho',
  pronto_para_iniciar: 'Pronto para iniciar',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function formatDate(value) {
  if (!value) return '';
  const text = String(value).slice(0,10);
  const [y,m,d] = text.split('-');
  return y && m && d ? `${d}/${m}/${y}` : text;
}

function staffName(item, staffMap = new Map()) {
  return item?.profissional_nome || staffMap.get(item?.profissional_user_id) || 'Profissional';
}

function selectedProcedure(procedures = [], id = '') {
  return procedures.find((item) => item.id === id) || null;
}

function dynamicOptions(procedure) {
  const options = procedure?.current_version?.specific_schema?.component_options;
  return Array.isArray(options) ? options : [];
}

function derivedClass(procedure, selectedKeys = []) {
  if (procedure?.current_version?.classe_documental === 'injetavel') return 'injetavel';
  const keys = new Set(selectedKeys || []);
  return dynamicOptions(procedure).some((opt) => keys.has(opt.key) && opt.classe_documental === 'injetavel')
    ? 'injetavel' : 'nao_injetavel';
}

function renderDynamicComponents(procedure, selectedKeys = []) {
  const options = dynamicOptions(procedure);
  if (!options.length) return '';
  const selected = new Set(selectedKeys || []);
  return `<fieldset class="bcg-treatment-components"><legend>Componentes desta sessão</legend>${options.map((opt) => `<label class="bcg-treatment-component"><input type="checkbox" name="component_key" value="${escapeHtml(opt.key)}" data-treatment-component ${selected.has(opt.key) ? 'checked' : ''}><span><strong>${escapeHtml(opt.label || opt.key)}</strong><small>${opt.classe_documental === 'injetavel' ? 'Injetável / invasivo' : 'Não injetável'}</small></span></label>`).join('')}</fieldset>`;
}

export function renderTreatmentHistory(treatments = [], staffMap = new Map()) {
  if (!treatments.length) return '<div class="bcg-empty">Nenhum atendimento clínico formal registrado ainda.</div>';
  return `<div class="bcg-treatment-history">${treatments.map((item) => {
    const version = item.current_version_number ? `v${item.current_version_number}` : '';
    return `<article class="bcg-treatment-history-card" data-treatment-id="${escapeHtml(item.id)}"><div><p class="bcg-eyebrow">${escapeHtml(formatDate(item.treatment_date))}</p><h4>${escapeHtml(item.procedure_name || item.procedure_version?.nome || 'Procedimento')}</h4><p>${escapeHtml(staffName(item, staffMap))}</p></div><div class="bcg-treatment-history-meta"><span class="bcg-chip">${escapeHtml(STATUS_LABELS[item.status] || item.status || '')}</span>${version ? `<span class="bcg-chip">${escapeHtml(version)}</span>` : ''}</div><button type="button" class="bcg-small-button" data-treatment-open="${escapeHtml(item.id)}">Abrir ficha</button></article>`;
  }).join('')}</div>`;
}

export function renderTreatmentGateChecklist(reasons = []) {
  const pending = new Set(Array.isArray(reasons) ? reasons : []);
  return `<ul class="bcg-treatment-gates" aria-label="Checklist para iniciar atendimento">${Object.entries(GATE_LABELS).map(([key,label]) => `<li data-gate="${escapeHtml(key)}" data-complete="${pending.has(key) ? 'false' : 'true'}"><span>${escapeHtml(label)}</span><strong>${pending.has(key) ? 'Pendente' : 'OK'}</strong></li>`).join('')}</ul>`;
}

function renderProcedureStep({ procedures = [], appointmentId = null, selectedProcedureId = '', selectedComponentKeys = [] } = {}) {
  const executable = procedures.filter((item) => item.ativo !== false && item.archived_at == null && item.can_execute !== false);
  const procedure = selectedProcedure(procedures, selectedProcedureId);
  const resultClass = derivedClass(procedure, selectedComponentKeys);
  return `<section class="bcg-treatment-wizard" data-treatment-wizard="procedure"><p class="bcg-eyebrow">NOVO ATENDIMENTO</p><h3>Escolha o procedimento</h3>${appointmentId ? '<p class="bcg-chip">Agendamento vinculado</p>' : '<p class="bcg-muted">Atendimento direto / walk-in</p>'}<form class="bcg-form" data-treatment-create-form data-appointment-id="${escapeHtml(appointmentId || '')}"><label>Procedimento<select class="bcg-input" name="procedure_id" data-treatment-procedure-select required><option value="">Selecione</option>${executable.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === selectedProcedureId ? ' selected' : ''}>${escapeHtml(item.nome)}</option>`).join('')}</select></label>${procedure ? `${renderDynamicComponents(procedure, selectedComponentKeys)}<p class="bcg-treatment-derived-class"><strong>Classe documental desta sessão:</strong> ${resultClass === 'injetavel' ? 'Injetável / invasivo' : 'Não injetável'}</p>${procedure.current_version?.protocol_mode === 'compound' ? '<p class="bcg-muted">Selecione os componentes realmente previstos para esta sessão. O backend recalcula a classe e o TCLE.</p>' : ''}` : ''}<div class="bcg-form-actions"><button class="bcg-button" type="submit" data-treatment-create>Continuar</button><button class="bcg-small-button" type="button" data-treatment-cancel>Cancelar</button><span class="bcg-status" data-treatment-status></span></div></form></section>`;
}

function renderConsentSection({ consent = null, signatures = [], clientRecord = {} } = {}) {
  if (!consent?.document_id) return `<section class="bcg-treatment-stage"><p class="bcg-eyebrow">CONSENTIMENTO</p><h4>Consentimento do procedimento</h4><p class="bcg-muted">O sistema seleciona automaticamente o termo básico ou o TCLE completo conforme a classe real da sessão.</p><button type="button" class="bcg-small-button" data-treatment-consent-prepare>Preparar consentimento</button></section>`;
  const minor = isMinor(clientRecord?.data_nascimento);
  const subjectKind = minor ? 'responsavel' : 'paciente';
  const subjectDone = signatures.some((item) => item.signer_kind === subjectKind);
  const professionalDone = signatures.some((item) => item.signer_kind === 'profissional');
  const finalized = consent.status === 'finalizado' || consent.reused === true;
  return `<section class="bcg-treatment-stage" data-treatment-consent-stage data-document-id="${escapeHtml(consent.document_id)}"><p class="bcg-eyebrow">CONSENTIMENTO</p><h4>${escapeHtml(consent.title || 'Consentimento do procedimento')}</h4><p><strong>${escapeHtml(consent.procedure_name || '')}</strong></p>${consent.body ? `<div class="bcg-treatment-consent-copy">${escapeHtml(consent.body).replaceAll('\n','<br>')}</div>` : '<p class="bcg-muted">Termo institucional preparado e vinculado a esta sessão.</p>'}${consent.supplement ? `<div class="bcg-treatment-supplement"><strong>Complemento específico</strong><p>${escapeHtml(consent.supplement)}</p></div>` : ''}${finalized ? '<p class="bcg-status" data-kind="success">Consentimento finalizado.</p>' : `<div class="bcg-signature-grid">${subjectDone ? '<section><strong>Cliente / responsável</strong><p class="bcg-status" data-kind="success">Assinatura registrada.</p></section>' : '<section><strong>Cliente / responsável</strong><canvas data-treatment-signature-canvas="subject" aria-label="Assinatura da cliente ou responsável"></canvas><button type="button" class="bcg-small-button" data-treatment-signature-clear="subject">Limpar</button></section>'}${professionalDone ? '<section><strong>Profissional</strong><p class="bcg-status" data-kind="success">Assinatura registrada.</p></section>' : '<section><strong>Profissional</strong><canvas data-treatment-signature-canvas="professional" aria-label="Assinatura profissional"></canvas><button type="button" class="bcg-small-button" data-treatment-signature-clear="professional">Limpar</button></section>'}</div><button type="button" class="bcg-button" data-treatment-consent-sign>Registrar assinaturas</button>`}</section>`;
}

function renderSpecificFields(treatment = {}) {
  const fields = treatment?.procedure_version?.specific_schema?.fields;
  const data = treatment.specific_data || {};
  if (!Array.isArray(fields) || !fields.length) return '<p class="bcg-muted">A ficha específica usa o modelo genérico desta versão.</p>';
  return fields.map((field) => {
    const value = data[field.key] ?? '';
    const required = field.required ? ' required' : '';
    if (field.type === 'select' && Array.isArray(field.options)) return `<label>${escapeHtml(field.label || field.key)}<select class="bcg-input" name="specific.${escapeHtml(field.key)}"${required}><option value="">Selecione</option>${field.options.map((opt) => `<option value="${escapeHtml(opt)}"${String(opt)===String(value)?' selected':''}>${escapeHtml(opt)}</option>`).join('')}</select></label>`;
    if (field.type === 'checkbox') return `<label class="bcg-toggle"><input type="checkbox" name="specific.${escapeHtml(field.key)}"${value ? ' checked' : ''}> ${escapeHtml(field.label || field.key)}</label>`;
    if (field.type === 'textarea') return `<label class="bcg-field-wide">${escapeHtml(field.label || field.key)}<textarea class="bcg-input bcg-textarea" name="specific.${escapeHtml(field.key)}" rows="3"${required}>${escapeHtml(value)}</textarea></label>`;
    return `<label>${escapeHtml(field.label || field.key)}<input class="bcg-input" name="specific.${escapeHtml(field.key)}" value="${escapeHtml(value)}"${required}></label>`;
  }).join('');
}

function renderFinalSignature(treatment = {}, signatures = []) {
  if (!treatment.pending_document_id) return '';
  const done = signatures.some((item) => item.signer_kind === 'profissional');
  return `<section class="bcg-treatment-stage" data-treatment-final-signature data-document-id="${escapeHtml(treatment.pending_document_id)}"><p class="bcg-eyebrow">ASSINATURA FINAL</p><h4>Ficha do atendimento</h4><p>A assinatura profissional confirma o conteúdo final desta versão da ficha.</p>${done ? '<p class="bcg-status" data-kind="success">Assinatura profissional registrada.</p>' : '<canvas data-treatment-signature-canvas="final" aria-label="Assinatura profissional da ficha final"></canvas><button type="button" class="bcg-small-button" data-treatment-signature-clear="final">Limpar</button>'}<button type="button" class="bcg-button" data-treatment-final-sign${done ? '' : ' data-needs-pad="true"'}>Concluir finalização</button></section>`;
}

function renderClinicalStep({ treatment = {}, consent = null, consentSignatures = [], finalSignatures = [], clientRecord = {} } = {}) {
  const status = treatment.status || 'rascunho';
  const readonly = status === 'finalizado' || treatment.pending_document_id ? ' disabled' : '';
  const startingAt = treatment.price_mode_snapshot === 'starting_at';
  return `<section class="bcg-treatment-wizard" data-treatment-wizard="clinical" data-treatment-id="${escapeHtml(treatment.id || '')}"><div class="bcg-treatment-head"><div><p class="bcg-eyebrow">ATENDIMENTO CLÍNICO</p><h3>${escapeHtml(treatment.procedure_version?.nome || 'Procedimento')}</h3></div><span class="bcg-chip">${escapeHtml(STATUS_LABELS[status] || status)}</span></div>${renderTreatmentGateChecklist(treatment.gate_reasons || [])}<section class="bcg-treatment-stage"><p class="bcg-eyebrow">SAÚDE HOJE</p><h4>Houve mudança desde a última avaliação?</h4><form class="bcg-form" data-treatment-health-form><label><input type="radio" name="changed" value="false" required> Não</label><label><input type="radio" name="changed" value="true" required> Sim</label><label class="bcg-field-wide">Se sim, descreva<textarea class="bcg-input" name="details" rows="2"></textarea></label><button class="bcg-small-button" type="submit"${readonly}>Confirmar saúde hoje</button></form></section><section class="bcg-treatment-stage"><p class="bcg-eyebrow">ALERTAS CLÍNICOS</p><h4>Revisão antes do procedimento</h4><p class="bcg-muted">O sistema copia os alertas ativos do prontuário no momento da confirmação. Mudança de saúde não é contraindicação automática: exige avaliação profissional.</p><button type="button" class="bcg-small-button" data-treatment-alerts-confirm${readonly}>Confirmar revisão dos alertas</button></section>${renderConsentSection({consent,signatures:consentSignatures,clientRecord})}<section class="bcg-treatment-stage"><p class="bcg-eyebrow">FICHA DO ATENDIMENTO</p><h4>Registro técnico da sessão</h4><form class="bcg-form bcg-form-grid" data-treatment-draft-form><label class="bcg-field-wide">Queixa / condição do dia<textarea class="bcg-input" name="queixa_dia" rows="2"${readonly}>${escapeHtml(treatment.queixa_dia || '')}</textarea></label><label class="bcg-field-wide">Objetivo da sessão<textarea class="bcg-input" name="objetivo" rows="2" required${readonly}>${escapeHtml(treatment.objetivo || '')}</textarea></label><label>Área / região<input class="bcg-input" name="regiao" value="${escapeHtml(treatment.regiao || '')}" required${readonly}></label><label class="bcg-field-wide">Avaliação profissional<textarea class="bcg-input" name="avaliacao_profissional" rows="2"${readonly}>${escapeHtml(treatment.avaliacao_profissional || '')}</textarea></label>${renderSpecificFields(treatment)}${startingAt ? `<label>Valor final da sessão<input class="bcg-input" type="number" step="0.01" min="0.01" name="final_price" value="${escapeHtml(treatment.final_price ?? '')}" required${readonly}></label>` : ''}<label class="bcg-field-wide">Resposta imediata<textarea class="bcg-input" name="resposta_imediata" rows="2"${readonly}>${escapeHtml(treatment.resposta_imediata || '')}</textarea></label><label class="bcg-field-wide">Orientações<textarea class="bcg-input" name="orientacoes" rows="2"${readonly}>${escapeHtml(treatment.orientacoes || '')}</textarea></label><label class="bcg-field-wide">Retorno / evolução<textarea class="bcg-input" name="retorno" rows="2"${readonly}>${escapeHtml(treatment.retorno || '')}</textarea></label><div class="bcg-form-actions bcg-field-wide"><button class="bcg-small-button" type="submit"${readonly}>Salvar ficha</button><span class="bcg-status" data-treatment-status></span></div></form></section><div data-treatment-6d-slot>${renderTreatment6dCards({treatment})}</div><section class="bcg-treatment-stage"><p class="bcg-eyebrow">FINALIZAR</p><h4>Fluxo do atendimento</h4><div class="bcg-form-actions">${status === 'rascunho' ? '<button type="button" class="bcg-small-button" data-treatment-ready>Verificar e deixar pronto</button>' : ''}${status === 'pronto_para_iniciar' ? '<button type="button" class="bcg-button" data-treatment-start>Iniciar atendimento</button>' : ''}${status === 'em_atendimento' && !treatment.pending_document_id ? '<button type="button" class="bcg-button" data-treatment-finalize>Preparar finalização</button>' : ''}${status === 'finalizado' ? '<span class="bcg-status" data-kind="success">Atendimento finalizado e versionado.</span>' : ''}<button type="button" class="bcg-small-button" data-treatment-close>Voltar ao histórico</button></div></section>${renderFinalSignature(treatment,finalSignatures)}</section>`;
}

export function renderTreatmentWizard(options = {}) {
  return options.step === 'clinical' ? renderClinicalStep(options) : renderProcedureStep(options);
}

export function renderTreatmentPanel({ client = {}, treatments = [], procedures = [], staffMap = new Map() } = {}) {
  return `<div class="bcg-treatment-panel" data-treatment-panel data-client-id="${escapeHtml(client.id || '')}"><div class="bcg-section-head"><div><p class="bcg-eyebrow">ATENDIMENTOS</p><h3>Prontuário por sessão</h3><p class="bcg-muted">Cada sessão possui ficha própria, consentimento e histórico versionado.</p></div><button type="button" class="bcg-button" data-treatment-new>Novo atendimento</button></div><div data-treatment-workspace></div><div class="bcg-divider"></div><p class="bcg-eyebrow">HISTÓRICO DE ATENDIMENTOS</p><div data-treatment-history>${renderTreatmentHistory(treatments,staffMap)}</div></div>`;
}

function setStatus(scope, message, kind='') {
  const el = scope?.querySelector?.('[data-treatment-status]');
  if (el) { el.textContent = message || ''; el.dataset.kind = kind; }
}

function collectSpecific(form) {
  const result = {};
  form?.querySelectorAll?.('[name^="specific."]')?.forEach?.((field) => {
    const key = field.name.slice('specific.'.length);
    result[key] = field.type === 'checkbox' ? Boolean(field.checked) : String(field.value ?? '').trim();
  });
  return result;
}

function collectDraft(form) {
  const value = (name) => String(form.elements?.[name]?.value ?? '').trim();
  const patch = {
    queixa_dia: value('queixa_dia'), objetivo: value('objetivo'), regiao: value('regiao'),
    avaliacao_profissional: value('avaliacao_profissional'), resposta_imediata: value('resposta_imediata'),
    orientacoes: value('orientacoes'), retorno: value('retorno'), specific_data: collectSpecific(form),
  };
  if (form.elements?.final_price) patch.final_price = value('final_price');
  return patch;
}

async function saveSignaturePad({ client, documentId, signerKind, pad }) {
  if (!pad?.isValid?.()) throw new Error('Faça uma assinatura completa antes de continuar.');
  const blob = await pad.toBlob();
  const sha256 = await sha256Blob(blob);
  const storagePath = await uploadClinicalSignature({ client, documentId, signerKind, file: blob });
  await registerClinicalSignature({ client, documentId, signerKind, storagePath, sha256 });
}

export function initTreatmentController({ client, root, getClientRecord, refreshFolder } = {}) {
  if (!client || !root) throw new Error('Contexto de atendimento inválido.');
  let procedures = [];
  let treatments = [];
  let staffMap = new Map();
  let activeTreatment = null;
  let consent = null;
  let consentSignatures = [];
  let finalSignatures = [];
  let pads = {};
  let selectedProcedureId = '';
  let selectedComponentKeys = [];
  let pendingAppointmentId = null;
  let phase6dController = null;

  const folder = () => root.closest?.('[data-client-folder]') || root;
  const panel = () => root.querySelector?.('[data-treatment-panel]') || root;
  const workspace = () => panel()?.querySelector?.('[data-treatment-workspace]');
  const historySlot = () => panel()?.querySelector?.('[data-treatment-history]');
  const clientRecord = () => getClientRecord?.() || folder()?.__bcClientRecord || {};

  function mountPads() {
    pads = {};
    const scope = workspace();
    scope?.querySelectorAll?.('[data-treatment-signature-canvas]')?.forEach?.((canvas) => {
      pads[canvas.dataset.treatmentSignatureCanvas] = createSignaturePad(canvas);
    });
  }

  async function loadData() {
    const clienteId = clientRecord()?.id;
    if (!clienteId) return;
    const [loadedTreatments, loadedProcedures, staff] = await Promise.all([
      listClientTreatments({ client, clienteId }),
      listProcedures({ client, includeArchived:false }),
      listStaffDirectory({ client }),
    ]);
    treatments = loadedTreatments || [];
    procedures = loadedProcedures || [];
    staffMap = new Map((staff || []).map((item) => [item.user_id,item.display_name || 'Profissional']));
    if (historySlot()) historySlot().innerHTML = renderTreatmentHistory(treatments,staffMap);
  }

  async function openTreatment(id) {
    activeTreatment = await getTreatment({ client, treatmentId:id });
    consent = null;
    consentSignatures = [];
    finalSignatures = [];
    if (activeTreatment.consent_document_id) {
      consent = await prepareTreatmentConsent({ client, treatmentId:id });
      consentSignatures = await listClinicalSignatures({ client, documentId:activeTreatment.consent_document_id });
    }
    if (activeTreatment.pending_document_id) {
      finalSignatures = await listClinicalSignatures({ client, documentId:activeTreatment.pending_document_id });
    }
    workspace().innerHTML = renderTreatmentWizard({ step:'clinical', treatment:activeTreatment, consent, consentSignatures, finalSignatures, clientRecord:clientRecord() });
    mountPads();
    await phase6dController?.loadTreatment(activeTreatment);
  }

  async function reloadTreatment() {
    if (!activeTreatment?.id) return;
    await openTreatment(activeTreatment.id);
    await loadData();
  }

  phase6dController = initTreatment6dController({client,root,getClientRecord:clientRecord,refreshTreatment:reloadTreatment});

  function showProcedureStep(appointmentId = null) {
    pendingAppointmentId = appointmentId || null;
    selectedProcedureId = '';
    selectedComponentKeys = [];
    workspace().innerHTML = renderTreatmentWizard({ step:'procedure', procedures, appointmentId:pendingAppointmentId });
  }

  root.addEventListener('change', (event) => {
    const select = event.target.closest?.('[data-treatment-procedure-select]');
    if (!select) return;
    selectedProcedureId = select.value;
    selectedComponentKeys = [];
    workspace().innerHTML = renderTreatmentWizard({ step:'procedure', procedures, appointmentId:pendingAppointmentId, selectedProcedureId, selectedComponentKeys });
  });

  root.addEventListener('click', async (event) => {
    const newButton = event.target.closest?.('[data-treatment-new]');
    if (newButton) { showProcedureStep(newButton.dataset.appointmentId || null); return; }
    const component = event.target.closest?.('[data-treatment-component]');
    if (component) {
      selectedComponentKeys = [...workspace().querySelectorAll('[data-treatment-component]:checked')].map((item) => item.value);
      const label = workspace().querySelector('.bcg-treatment-derived-class');
      const proc = selectedProcedure(procedures,selectedProcedureId);
      if (label) label.innerHTML = `<strong>Classe documental desta sessão:</strong> ${derivedClass(proc,selectedComponentKeys)==='injetavel'?'Injetável / invasivo':'Não injetável'}`;
      return;
    }
    if (event.target.closest?.('[data-treatment-cancel],[data-treatment-close]')) { workspace().innerHTML=''; return; }
    const open = event.target.closest?.('[data-treatment-open]');
    if (open) { await openTreatment(open.dataset.treatmentOpen); return; }
    if (event.target.closest?.('[data-treatment-alerts-confirm]') && activeTreatment) {
      try { await confirmTreatmentAlertReview({client,treatmentId:activeTreatment.id}); await reloadTreatment(); }
      catch (error) { setStatus(workspace(),error?.message || 'Não foi possível confirmar alertas.','error'); }
      return;
    }
    if (event.target.closest?.('[data-treatment-consent-prepare]') && activeTreatment) {
      try {
        consent = await prepareTreatmentConsent({client,treatmentId:activeTreatment.id});
        consentSignatures = await listClinicalSignatures({client,documentId:consent.document_id});
        await openTreatment(activeTreatment.id);
      } catch (error) { setStatus(workspace(),error?.message || 'Não foi possível preparar o consentimento.','error'); }
      return;
    }
    const clear = event.target.closest?.('[data-treatment-signature-clear]');
    if (clear) { pads[clear.dataset.treatmentSignatureClear]?.clear?.(); return; }
    if (event.target.closest?.('[data-treatment-consent-sign]') && activeTreatment && consent?.document_id) {
      const button = event.target.closest('[data-treatment-consent-sign]');
      button.disabled=true;
      try {
        const subjectKind = isMinor(clientRecord()?.data_nascimento) ? 'responsavel' : 'paciente';
        const existing = new Set(consentSignatures.map((item)=>item.signer_kind));
        if (!existing.has(subjectKind)) await saveSignaturePad({client,documentId:consent.document_id,signerKind:subjectKind,pad:pads.subject});
        if (!existing.has('profissional')) await saveSignaturePad({client,documentId:consent.document_id,signerKind:'profissional',pad:pads.professional});
        await finalizeProcedureConsent({client,documentId:consent.document_id});
        await reloadTreatment();
      } catch (error) { setStatus(workspace(),error?.message || 'Não foi possível finalizar o consentimento.','error'); }
      finally { button.disabled=false; }
      return;
    }
    if (event.target.closest?.('[data-treatment-ready]') && activeTreatment) {
      try { await markTreatmentReady({client,treatmentId:activeTreatment.id}); await reloadTreatment(); }
      catch (error) { setStatus(workspace(),error?.message || 'Há pendências antes de iniciar.','error'); }
      return;
    }
    if (event.target.closest?.('[data-treatment-start]') && activeTreatment) {
      try { await startTreatment({client,treatmentId:activeTreatment.id}); await reloadTreatment(); }
      catch (error) { setStatus(workspace(),error?.message || 'Não foi possível iniciar.','error'); }
      return;
    }
    if (event.target.closest?.('[data-treatment-finalize]') && activeTreatment) {
      try { await finalizeTreatment({client,treatmentId:activeTreatment.id}); await reloadTreatment(); }
      catch (error) { setStatus(workspace(),error?.message || 'Não foi possível preparar a finalização.','error'); }
      return;
    }
    if (event.target.closest?.('[data-treatment-final-sign]') && activeTreatment?.pending_document_id) {
      const button=event.target.closest('[data-treatment-final-sign]'); button.disabled=true;
      try {
        const existing = new Set(finalSignatures.map((item)=>item.signer_kind));
        if (!existing.has('profissional')) await saveSignaturePad({client,documentId:activeTreatment.pending_document_id,signerKind:'profissional',pad:pads.final});
        await completeTreatmentFinalization({client,treatmentId:activeTreatment.id,documentId:activeTreatment.pending_document_id});
        await reloadTreatment();
        await refreshFolder?.();
      } catch (error) { setStatus(workspace(),error?.message || 'Não foi possível concluir a ficha.','error'); }
      finally { button.disabled=false; }
    }
  });

  root.addEventListener('submit', async (event) => {
    const createForm = event.target.closest?.('[data-treatment-create-form]');
    if (createForm) {
      event.preventDefault();
      const procedureId = createForm.elements.procedure_id.value;
      const componentKeys = [...createForm.querySelectorAll('[data-treatment-component]:checked')].map((item)=>item.value);
      try {
        const id = await createTreatment({client,clienteId:clientRecord().id,procedureId,appointmentId:createForm.dataset.appointmentId || null,componentKeys});
        await loadData();
        await openTreatment(id);
      } catch (error) { setStatus(createForm,error?.message || 'Não foi possível criar o atendimento.','error'); }
      return;
    }
    const healthForm = event.target.closest?.('[data-treatment-health-form]');
    if (healthForm && activeTreatment) {
      event.preventDefault();
      const data = new FormData(healthForm);
      try { await confirmTreatmentHealthChange({client,treatmentId:activeTreatment.id,changed:data.get('changed')==='true',details:data.get('details')}); await reloadTreatment(); }
      catch (error) { setStatus(workspace(),error?.message || 'Não foi possível registrar a saúde de hoje.','error'); }
      return;
    }
    const draftForm = event.target.closest?.('[data-treatment-draft-form]');
    if (draftForm && activeTreatment) {
      event.preventDefault();
      try { await updateTreatmentDraft({client,treatmentId:activeTreatment.id,patch:collectDraft(draftForm)}); await reloadTreatment(); }
      catch (error) { setStatus(draftForm,error?.message || 'Não foi possível salvar a ficha.','error'); }
    }
  });

  return {
    async hydrate(){ await loadData(); return {treatments,procedures}; },
    showProcedureStep,
    openTreatment,
  };
}