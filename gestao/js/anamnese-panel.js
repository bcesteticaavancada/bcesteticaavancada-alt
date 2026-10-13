import { ANAMNESE_TEMPLATE_V1, choiceLabelForQuestion, choiceOptionsForQuestion, getVisibleQuestions } from './anamnese-schema.js';
import { buildAnamneseSummary, validateAnamneseAnswers } from './anamnese-domain.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const STATUS_LABELS = {
  nao_iniciada: 'Não iniciada',
  em_preenchimento: 'Em preenchimento',
  aguardando_revisao_profissional: 'Aguardando revisão profissional',
  aguardando_assinaturas: 'Aguardando assinaturas',
  finalizada: 'Finalizada',
  vencida: 'Vencida',
  substituida: 'Substituída por nova versão',
};

export function anamneseStatusLabel(status) {
  return STATUS_LABELS[status] || 'Não iniciada';
}

export function buildRemoteAnamneseUrl({ origin, basePath = '/gestao/anamnese-remota/', token }) {
  const cleanOrigin = String(origin || '').replace(/\/$/, '');
  const cleanPath = `/${String(basePath || '').replace(/^\/+|\/+$/g, '')}/`;
  return `${cleanOrigin}${cleanPath}#t=${encodeURIComponent(String(token || ''))}`;
}

export function renderClinicalAlerts(alerts = []) {
  if (!alerts.length) return '<div class="bcg-anamnese-alerts-empty">Nenhum alerta clínico ativo registrado.</div>';
  return `<div class="bcg-anamnese-alerts">${alerts.map((alert) => `
    <article class="bcg-clinical-alert" data-level="${escapeHtml(alert.level || 'informativo')}">
      <span>${escapeHtml(alert.level === 'critico' ? 'Crítico' : alert.level === 'atencao' ? 'Atenção' : 'Informativo')}</span>
      <p>${escapeHtml(alert.description || '')}</p>
    </article>`).join('')}</div>`;
}

function renderVersions(versions = []) {
  if (!versions.length) return '<div class="bcg-empty">Nenhuma versão anterior registrada.</div>';
  return `<div class="bcg-anamnese-versions">${versions.map((version) => `
    <article class="bcg-anamnese-version" data-anamnese-version-id="${escapeHtml(version.id)}">
      <strong>Versão ${escapeHtml(version.version)}</strong>
      <span>${escapeHtml(anamneseStatusLabel(version.status))}</span>
      ${version.finalized_at ? `<time>${escapeHtml(new Date(version.finalized_at).toLocaleDateString('pt-BR'))}</time>` : ''}
    </article>`).join('')}</div>`;
}

function renderDocuments(documents = []) {
  if (!documents.length) return '<div class="bcg-empty">Nenhum documento clínico emitido.</div>';
  return `<div class="bcg-clinical-documents">${documents.map((doc) => `
    <article class="bcg-document-card" data-document-id="${escapeHtml(doc.id)}">
      <div><strong>${escapeHtml(doc.document_code || 'Documento clínico')}</strong><span>Anamnese Geral • Versão ${escapeHtml(doc.source_version)}</span></div>
      <span class="bcg-chip">${escapeHtml(doc.status === 'emitido' ? 'PDF emitido' : doc.status || '')}</span>
      ${doc.status === 'emitido' && doc.storage_path
        ? `<button type="button" class="bcg-small-button" data-download-clinical-document="${escapeHtml(doc.id)}">Baixar PDF</button>`
        : doc.status === 'erro_pdf'
          ? `<button type="button" class="bcg-small-button" data-generate-clinical-document="${escapeHtml(doc.id)}" data-document-type="${escapeHtml(doc.document_type || 'anamnese_geral')}">Tentar gerar PDF</button>`
          : doc.status === 'pronto_para_pdf'
            ? `<button type="button" class="bcg-small-button" data-generate-clinical-document="${escapeHtml(doc.id)}" data-document-type="${escapeHtml(doc.document_type || 'anamnese_geral')}">Gerar PDF</button>`
            : ''}
    </article>`).join('')}</div>`;
}

function renderAction(state, client) {
  const status = state?.status || 'nao_iniciada';
  if (status === 'nao_iniciada' || status === 'vencida' || status === 'substituida') {
    return `<button type="button" class="bcg-button" data-anamnese-action="begin" data-client-id="${escapeHtml(client?.id)}">Iniciar Anamnese Geral</button>`;
  }
  if (status === 'em_preenchimento') {
    return `<div class="bcg-anamnese-actions"><button type="button" class="bcg-button" data-anamnese-action="edit" data-anamnese-id="${escapeHtml(state.id)}">Continuar preenchimento</button><button type="button" class="bcg-small-button" data-anamnese-action="remote-link" data-anamnese-id="${escapeHtml(state.id)}">Gerar link remoto por 72h</button></div>`;
  }
  if (status === 'aguardando_revisao_profissional') {
    return `<button type="button" class="bcg-button" data-anamnese-action="review" data-anamnese-id="${escapeHtml(state.id)}">Revisar com a cliente</button>`;
  }
  if (status === 'aguardando_assinaturas') {
    return `<button type="button" class="bcg-button" data-anamnese-action="sign" data-anamnese-id="${escapeHtml(state.id)}">Coletar assinaturas</button>`;
  }
  return `<button type="button" class="bcg-small-button" data-anamnese-action="begin" data-client-id="${escapeHtml(client?.id)}">Criar nova versão</button>`;
}

export function renderAnamnesePanel({ client = {}, state = null, versions = [], alerts = [], documents = [] } = {}) {
  const status = state?.status || 'nao_iniciada';
  const versionText = state?.version ? `Versão ${state.version}` : 'Sem versão ativa';
  return `<div class="bcg-anamnese-panel" data-anamnese-panel>
    <section class="bcg-anamnese-overview">
      <div><p class="bcg-eyebrow">ANAMNESE GERAL</p><h3>Anamnese Geral — BC Estética</h3><p>Registro clínico compartilhado, versionado e revisado pela profissional responsável.</p></div>
      <div class="bcg-anamnese-state"><strong>${escapeHtml(versionText)}</strong><span>${escapeHtml(anamneseStatusLabel(status))}</span></div>
    </section>
    ${renderAction(state, client)}
    <section class="bcg-anamnese-block"><p class="bcg-eyebrow">ALERTAS CLÍNICOS</p>${renderClinicalAlerts(alerts)}</section>
    <section class="bcg-anamnese-block"><p class="bcg-eyebrow">VERSÕES</p>${renderVersions(versions)}</section>
    <section class="bcg-anamnese-block"><p class="bcg-eyebrow">DOCUMENTOS</p>${renderDocuments(documents)}</section>
  </div>`;
}

function inputForQuestion(question, value) {
  const name = escapeHtml(question.key);
  const label = escapeHtml(question.label);
  const required = question.required ? ' required' : '';
  const normalized = value ?? '';
  if (question.type === 'textarea') return `<label>${label}<textarea class="bcg-input bcg-textarea" name="${name}" rows="3"${required}>${escapeHtml(normalized)}</textarea></label>`;
  if (question.type === 'checkbox') return `<label class="bcg-consent-check"><input type="checkbox" name="${name}" value="true" ${normalized === true ? 'checked' : ''}${required}><span>${label}</span></label>`;
  if (question.type === 'multiselect') return `<label>${label}<input class="bcg-input" name="${name}" value="${escapeHtml(Array.isArray(normalized) ? normalized.join(', ') : normalized)}" placeholder="Separe itens por vírgula"${required}></label>`;
  if (question.type === 'choice') {
    return `<label>${label}<select class="bcg-input" name="${name}"${required}><option value="">Selecione</option>${choiceOptionsForQuestion(question).map((option) => `<option value="${escapeHtml(option.value)}" ${normalized === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
  }
  return `<label>${label}<input class="bcg-input" name="${name}" value="${escapeHtml(normalized)}"${required}></label>`;
}

function questionForKey(template, key) {
  return (template?.sections || []).flatMap((section) => section.questions || []).find((question) => question.key === key);
}

function reviewValue(item, template) {
  if (Array.isArray(item.value)) return item.value.join(', ');
  const question = questionForKey(template, item.key);
  if (question?.type === 'choice') return choiceLabelForQuestion(question, String(item.value));
  return item.value;
}

export function renderAnamneseWizard({ answers = {}, step = 0, template = ANAMNESE_TEMPLATE_V1, mode = 'edit' } = {}) {
  const sections = template.sections || [];
  const safeStep = Math.min(Math.max(Number(step) || 0, 0), Math.max(sections.length - 1, 0));
  const section = sections[safeStep] || { title: 'Anamnese', questions: [] };
  const visibleKeys = new Set(getVisibleQuestions({ answers, template: { sections: [section] } }).map((q) => q.key));
  const questions = section.questions.filter((q) => visibleKeys.has(q.key));
  const readonly = mode === 'readonly';
  return `<div class="bcg-anamnese-wizard" data-anamnese-wizard data-step="${safeStep}">
    <header><p class="bcg-eyebrow">ETAPA ${safeStep + 1} DE ${Math.max(sections.length, 1)}</p><h3>${escapeHtml(section.title)}</h3></header>
    <form data-anamnese-step-form ${readonly ? 'data-readonly="true"' : ''}>${questions.map((question) => inputForQuestion(question, answers[question.key])).join('')}
      <div class="bcg-form-actions"><button type="button" class="bcg-small-button" data-anamnese-nav="back" ${safeStep === 0 ? 'disabled' : ''}>Voltar</button>${safeStep < sections.length - 1 ? '<button type="submit" class="bcg-button">Continuar</button>' : '<button type="submit" class="bcg-button">Revisar respostas</button>'}</div>
    </form>
  </div>`;
}

export function renderAnamneseReview({ answers = {}, template = ANAMNESE_TEMPLATE_V1 } = {}) {
  const validation = validateAnamneseAnswers({ answers, template });
  const summary = buildAnamneseSummary({ answers, template });
  return `<div class="bcg-anamnese-review"><p class="bcg-eyebrow">REVISÃO</p><h3>Confira as informações antes de continuar</h3>${summary.map((section) => `<section><h4>${escapeHtml(section.title)}</h4>${section.items.map((item) => `<div class="bcg-review-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(reviewValue(item, template))}</strong></div>`).join('')}</section>`).join('')}${validation.valid ? '<p class="bcg-status" data-kind="success">Informações prontas para revisão profissional.</p>' : `<p class="bcg-status" data-kind="warning">Há ${validation.missing.length} campo(s) obrigatório(s) pendente(s).</p>`}</div>`;
}
