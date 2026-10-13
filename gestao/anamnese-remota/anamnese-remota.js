import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../js/config.js';
import { ANAMNESE_TEMPLATE_V1, choiceLabelForQuestion, choiceOptionsForQuestion, getVisibleQuestions } from '../js/anamnese-schema.js';
import { validateAnamneseAnswers, buildAnamneseSummary } from '../js/anamnese-domain.js';

const statusEl = document.getElementById('remoteStatus');
const app = document.getElementById('remoteApp');
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const hash = window.location.hash || '';
const token = /^#t=/.test(hash) ? decodeURIComponent(hash.slice(3)) : '';
let record = null;
let answers = {};
let step = 0;

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function setStatus(message, kind = '') {
  statusEl.textContent = message || '';
  statusEl.dataset.kind = kind;
}

function questionForKey(key) {
  return ANAMNESE_TEMPLATE_V1.sections.flatMap((section) => section.questions || []).find((question) => question.key === key);
}

function reviewValue(item) {
  if (Array.isArray(item.value)) return item.value.join(', ');
  const question = questionForKey(item.key);
  if (question?.type === 'choice') return choiceLabelForQuestion(question, String(item.value));
  return item.value;
}

function renderInput(question) {
  const value = answers[question.key] ?? '';
  const required = question.required ? ' required' : '';
  const label = escapeHtml(question.label);
  const name = escapeHtml(question.key);
  if (question.type === 'textarea') return `<label>${label}<textarea class="bcg-input bcg-textarea" name="${name}" rows="3"${required}>${escapeHtml(value)}</textarea></label>`;
  if (question.type === 'checkbox') return `<label class="bcg-remote-consent"><input type="checkbox" name="${name}" ${value === true ? 'checked' : ''}${required}><span>${label}</span></label>`;
  if (question.type === 'choice') return `<label>${label}<select class="bcg-input" name="${name}"${required}><option value="">Selecione</option>${choiceOptionsForQuestion(question).map((item) => `<option value="${escapeHtml(item.value)}" ${value === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label>`;
  if (question.type === 'multiselect') return `<label>${label}<input class="bcg-input" name="${name}" data-multi="true" value="${escapeHtml(Array.isArray(value) ? value.join(', ') : value)}" placeholder="Separe itens por vírgula"${required}></label>`;
  return `<label>${label}<input class="bcg-input" name="${name}" value="${escapeHtml(value)}"${required}></label>`;
}

function visibleQuestionsForSection(section) {
  const keys = new Set(getVisibleQuestions({ answers, template: { sections: [section] } }).map((question) => question.key));
  return section.questions.filter((question) => keys.has(question.key));
}

function collect(form) {
  const data = new FormData(form);
  const section = ANAMNESE_TEMPLATE_V1.sections[step];
  for (const question of visibleQuestionsForSection(section)) {
    const field = form.elements[question.key];
    if (!field) continue;
    if (question.type === 'checkbox') answers[question.key] = Boolean(field.checked);
    else if (question.type === 'multiselect') answers[question.key] = String(field.value || '').split(',').map((item) => item.trim()).filter(Boolean);
    else answers[question.key] = String(field.value || '').trim();
  }
  return Object.fromEntries([...data.entries()]);
}

async function save(submit = false) {
  const { data, error } = await db.rpc('bc_anamnese_remote_save', {
    p_token: token,
    p_answers: answers,
    p_submit: submit,
  });
  if (error) throw error;
  return data;
}

function renderStep() {
  const sections = ANAMNESE_TEMPLATE_V1.sections;
  const section = sections[step];
  const questions = visibleQuestionsForSection(section);
  app.innerHTML = `<div class="bcg-remote-client"><strong>${escapeHtml(record.client_name || 'Cliente BC')}</strong><div class="bcg-remote-expiry">Versão ${escapeHtml(record.version)} • link válido até ${escapeHtml(new Date(record.expires_at).toLocaleString('pt-BR'))}</div></div>
    <div class="bcg-remote-progress"><span>Etapa ${step + 1} de ${sections.length}</span><span>${escapeHtml(section.title)}</span></div>
    <section class="bcg-remote-step"><h3>${escapeHtml(section.title)}</h3><form id="remoteStepForm">${questions.map(renderInput).join('')}<div class="bcg-remote-actions"><button type="button" class="bcg-small-button" id="remoteBack" ${step === 0 ? 'disabled' : ''}>Voltar</button><button type="submit" class="bcg-button">${step === sections.length - 1 ? 'Revisar' : 'Continuar'}</button></div></form></section>`;
  const form = document.getElementById('remoteStepForm');
  form.addEventListener('change', () => { collect(form); renderStep(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    collect(form);
    setStatus('Salvando…');
    try {
      await save(false);
      if (step < sections.length - 1) { step += 1; renderStep(); setStatus(''); }
      else { renderReview(); setStatus(''); }
    } catch (error) { setStatus(error?.message || 'Não foi possível salvar.', 'error'); }
  });
  document.getElementById('remoteBack')?.addEventListener('click', () => { collect(form); step = Math.max(0, step - 1); renderStep(); });
}

function renderReview() {
  const validation = validateAnamneseAnswers({ answers, template: ANAMNESE_TEMPLATE_V1 });
  const summary = buildAnamneseSummary({ answers, template: ANAMNESE_TEMPLATE_V1 });
  app.innerHTML = `<div class="bcg-remote-review"><p class="bcg-eyebrow">REVISÃO</p><h3>Confira suas informações</h3>${summary.map((section) => `<section><h4>${escapeHtml(section.title)}</h4>${section.items.map((item) => `<div class="bcg-remote-review-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(reviewValue(item))}</strong></div>`).join('')}</section>`).join('')}<div class="bcg-remote-actions"><button type="button" class="bcg-small-button" id="reviewBack">Voltar</button>${validation.valid ? '<button type="button" class="bcg-button" id="remoteSubmit">Confirmar e enviar para revisão</button>' : ''}</div>${validation.valid ? '' : `<p class="bcg-status" data-kind="warning">Há ${validation.missing.length} campo(s) obrigatório(s) pendente(s).</p>`}</div>`;
  document.getElementById('reviewBack')?.addEventListener('click', () => { step = ANAMNESE_TEMPLATE_V1.sections.length - 1; renderStep(); });
  document.getElementById('remoteSubmit')?.addEventListener('click', async () => {
    setStatus('Enviando sua anamnese para a BC Estética…');
    try {
      await save(true);
      app.innerHTML = '<div class="bcg-remote-success"><p class="bcg-eyebrow">RECEBIDA</p><h3>Obrigada pelas informações.</h3><p>Sua Anamnese Geral foi pré-preenchida e ficará aguardando revisão profissional na BC Estética. O preenchimento remoto não finaliza o prontuário.</p></div>';
      setStatus('Pré-anamnese recebida pela BC Estética.', 'success');
    } catch (error) { setStatus(error?.message || 'Não foi possível enviar.', 'error'); }
  });
}

async function init() {
  if (!token) { setStatus('Este link é inválido ou está incompleto.', 'error'); return; }
  try {
    const { data, error } = await db.rpc('bc_anamnese_remote_get', { p_token: token });
    if (error) throw error;
    record = data;
    answers = data?.answers || {};
    app.hidden = false;
    setStatus('Link validado. Você pode preencher com tranquilidade.', 'success');
    renderStep();
  } catch {
    setStatus('Este link é inválido, expirou ou já foi concluído. Solicite um novo link à BC Estética.', 'error');
  }
}

init();