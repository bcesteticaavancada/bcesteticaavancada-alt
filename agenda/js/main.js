import { BC_WHATSAPP_NUMBER } from '../../assets/js/bc-public-config.js';
import { createPublicAgendaApi, PublicAgendaError } from './api.js';
import { clinicToday, monthLabel, publicMonthBounds, renderPublicCalendar, shiftMonth } from './calendar.js';

const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const formatDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.split('-').reverse().join('/') : '';
function normalizePhone(value) {
  const raw = String(value ?? '').replace(/\D/g, '');
  return raw.length === 10 || raw.length === 11 ? `55${raw}` : raw;
}

export function initPublicAgenda({ root = document, api = createPublicAgendaApi(), today = clinicToday() } = {}) {
  const find = selector => root.querySelector(selector);
  const view = root.defaultView || globalThis.window;
  const wideViewport = view?.matchMedia?.('(min-width: 1100px)');
  const procedureSelect = find('[data-procedure]');
  const professionalSelect = find('[data-professional]');
  const calendarRoot = find('[data-calendar]');
  const slotsRoot = find('[data-slots]');
  const form = find('[data-booking-form]');
  const submitButton = find('[data-submit]');
  const panel = find('[data-booking-panel]');
  const success = find('[data-booking-success]');
  if (!procedureSelect || !professionalSelect || !calendarRoot || !slotsRoot || !form || !submitButton || !panel) return null;
  const bounds = publicMonthBounds(today);
  const state = { procedures: [], professionals: [], selectedProcedure: null, selectedProfessional: null, selectedDate: null, selectedSlot: null, month: bounds.min, days: [], submitting: false, loadingMonth: false, loadingDetails: false };
  let monthGeneration = 0, detailsGeneration = 0, catalogLoading = false, catalogError = '';
  let slotMap = new Map();
  const message = error => error instanceof Error ? error.message : 'Não foi possível carregar. Tente novamente.';
  function announce(text = '', tone = '') {
    const status = find('[data-status]');
    if (status) { status.textContent = text; status.dataset.tone = tone; }
  }
  function syncControls() {
    find('[data-month-prev]').disabled = state.submitting || state.month <= bounds.min;
    find('[data-month-next]').disabled = state.submitting || state.month >= bounds.max;
    find('[data-month-today]').disabled = state.submitting || state.month === bounds.min;
    find('[data-month-label]').textContent = monthLabel(state.month);
    procedureSelect.disabled = state.submitting || catalogLoading || !state.selectedDate || !state.procedures.length;
    professionalSelect.disabled = state.submitting || state.loadingDetails || !state.professionals.length;
    submitButton.disabled = state.submitting || !state.selectedSlot;
    submitButton.textContent = state.submitting ? 'Confirmando...' : 'Confirmar agendamento ↗';
    find('[data-booking-close]').disabled = state.submitting;
    form.querySelectorAll('input').forEach(input => { input.disabled = state.submitting; });
    slotsRoot.querySelectorAll('button').forEach(button => { button.disabled = state.submitting; });
  }
  function renderCalendar() {
    calendarRoot.setAttribute('aria-busy', String(state.loadingMonth));
    renderPublicCalendar({ root: calendarRoot, month: state.month, days: state.days, selectedDate: state.selectedDate, today, busy: state.loadingMonth || state.submitting, onSelect: selectDate });
    syncControls();
  }
  function closePanel() {
    if (panel.open) panel.close();
    root.body?.classList.remove('agenda-dialog-open');
    find('[data-booking-placeholder]').hidden = false;
  }
  panel.addEventListener('close', () => {
    if (panel.open) return;
    root.body?.classList.remove('agenda-dialog-open');
    find('[data-booking-placeholder]').hidden = false;
    if (state.selectedDate) find(`[data-date="${state.selectedDate}"]`)?.focus();
  });
  panel.addEventListener('cancel', event => { if (state.submitting) event.preventDefault(); });
  find('[data-booking-close]').addEventListener('click', () => { if (!state.submitting) closePanel(); });
  function showPanel() {
    find('[data-booking-placeholder]').hidden = true;
    if (panel.open) {
      (procedureSelect.disabled ? find('[data-booking-close]') : procedureSelect).focus();
      return;
    }
    if (wideViewport?.matches) panel.show();
    else { panel.showModal(); root.body?.classList.add('agenda-dialog-open'); }
  }
  wideViewport?.addEventListener?.('change', () => {
    if (!panel.open) return;
    panel.close();
    root.body?.classList.remove('agenda-dialog-open');
    showPanel();
  });
  function resetDetails() {
    detailsGeneration++;
    state.selectedProcedure = null;
    state.selectedProfessional = null;
    state.selectedSlot = null;
    state.professionals = [];
    state.loadingDetails = false;
    slotMap = new Map();
    professionalSelect.innerHTML = '<option value="">Escolha o procedimento</option>';
    slotsRoot.innerHTML = '<p class="agenda-empty">Escolha o procedimento para ver as profissionais e os horários deste dia.</p>';
    find('[data-duration]').textContent = '';
    find('[data-booking-summary]').hidden = true;
    find('[data-details-retry]').hidden = true;
    form.hidden = false;
    success.hidden = true;
    announce(catalogError, catalogError ? 'error' : '');
    find('[data-details-retry]').hidden = !catalogError;
    populateProcedures();
  }
  function populateProcedures() {
    procedureSelect.innerHTML = '<option value="">Selecione o procedimento</option>' + state.procedures.map(item => `<option value="${escapeText(item.id)}">${escapeText(item.name)}</option>`).join('');
    syncControls();
  }
  async function loadCatalog() {
    catalogLoading = true; catalogError = '';
    find('[data-details-retry]').hidden = true; announce(''); syncControls();
    try {
      const response = await api.getCatalog();
      state.procedures = Array.isArray(response?.procedures) ? response.procedures : [];
      populateProcedures();
      if (!state.procedures.length) {
        catalogError = 'O agendamento online está sem procedimentos disponíveis neste momento.';
        announce(catalogError, 'error'); find('[data-details-retry]').hidden = false;
      }
    } catch (error) {
      catalogError = message(error); announce(catalogError, 'error');
      find('[data-details-retry]').hidden = false;
    } finally { catalogLoading = false; syncControls(); }
  }
  async function loadMonth(month = state.month) {
    if (state.submitting || month < bounds.min || month > bounds.max) return;
    const generation = ++monthGeneration;
    state.month = month;
    state.selectedDate = null;
    state.days = [];
    state.loadingMonth = true;
    resetDetails(); closePanel(); renderCalendar();
    find('[data-calendar-retry]').hidden = true;
    find('[data-calendar-status]').textContent = 'Buscando os dias com horários disponíveis...';
    try {
      const response = await api.getOverview({ month });
      if (generation !== monthGeneration) return;
      if (response?.month !== month || !Array.isArray(response.days)) throw new Error('Não foi possível carregar o calendário.');
      state.days = response.days.filter(day => typeof day.date === 'string' && day.date.startsWith(`${month}-`));
      const available = state.days.some(day => day.available === true && day.date >= today);
      find('[data-calendar-status]').textContent = available ? 'Toque em um dia disponível para escolher seu atendimento.' : 'Nenhum horário disponível neste mês. Consulte o próximo mês.';
    } catch (error) {
      if (generation !== monthGeneration) return;
      find('[data-calendar-status]').textContent = message(error);
      find('[data-calendar-retry]').hidden = false;
    } finally {
      if (generation === monthGeneration) { state.loadingMonth = false; renderCalendar(); }
    }
  }
  function selectDate(date) {
    if (state.submitting || state.loadingMonth || date < today || !state.days.some(day => day.date === date && day.available === true)) return;
    state.selectedDate = date;
    resetDetails(); renderCalendar();
    const [year, month, day] = date.split('-').map(Number);
    find('[data-selected-date]').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
    showPanel();
  }
  function renderSlots(slots = []) {
    state.selectedSlot = null;
    find('[data-booking-summary]').hidden = true;
    slotsRoot.innerHTML = slots.length ? slots.map(time => `<button type="button" class="agenda-slot" data-slot="${escapeText(time)}" aria-pressed="false">${escapeText(time)}</button>`).join('') : '<p class="agenda-empty">Não há horários livres para esta escolha neste dia.</p>';
    slotsRoot.querySelectorAll('[data-slot]').forEach(button => button.addEventListener('click', () => {
      if (state.submitting) return;
      state.selectedSlot = button.dataset.slot;
      slotsRoot.querySelectorAll('[data-slot]').forEach(item => { const active = item === button; item.classList.toggle('is-selected', active); item.setAttribute('aria-pressed', String(active)); });
      const summary = find('[data-booking-summary]');
      summary.hidden = false;
      summary.textContent = `${formatDate(state.selectedDate)} · ${state.selectedSlot} · ${state.procedures.find(item => item.id === state.selectedProcedure)?.durationMinutes || ''} min`;
      announce('Horário selecionado. Preencha seu nome e WhatsApp para confirmar.');
      syncControls();
    }));
    syncControls();
  }
  function selectProfessional(id) {
    state.selectedProfessional = state.professionals.some(item => item.id === id) ? id : null;
    if (state.selectedProfessional) renderSlots(slotMap.get(id) || []);
    else { renderSlots([]); slotsRoot.innerHTML = '<p class="agenda-empty">Escolha a profissional para ver os horários.</p>'; }
  }
  async function loadProfessionals() {
    const procedureId = state.selectedProcedure, date = state.selectedDate;
    const generation = ++detailsGeneration;
    state.selectedProfessional = null; state.selectedSlot = null; state.professionals = [];
    state.loadingDetails = true; slotMap = new Map();
    find('[data-details-retry]').hidden = true;
    find('[data-booking-summary]').hidden = true;
    professionalSelect.innerHTML = '<option value="">Buscando profissionais...</option>';
    slotsRoot.innerHTML = '<p class="agenda-empty">Consultando os horários disponíveis neste dia...</p>';
    syncControls();
    if (!procedureId || !date) { state.loadingDetails = false; syncControls(); return; }
    try {
      const response = await api.getProfessionals(procedureId);
      if (generation !== detailsGeneration) return;
      const professionals = Array.isArray(response?.professionals) ? response.professionals : [];
      const choices = await Promise.all(professionals.map(async professional => {
        const result = await api.getSlots({ procedureId, professionalId: professional.id, date });
        const slots = [...new Set((Array.isArray(result?.slots) ? result.slots : []).filter(time => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)))];
        return { professional, slots };
      }));
      if (generation !== detailsGeneration) return;
      state.professionals = choices.filter(item => item.slots.length).map(item => item.professional);
      slotMap = new Map(choices.map(item => [item.professional.id, item.slots]));
      professionalSelect.innerHTML = '<option value="">Selecione a profissional</option>' + state.professionals.map(item => `<option value="${escapeText(item.id)}">${escapeText(item.name)}</option>`).join('');
      if (state.professionals.length === 1) {
        professionalSelect.querySelectorAll('option').forEach(option => { option.selected = option.value === state.professionals[0].id; });
        selectProfessional(state.professionals[0].id);
      } else if (state.professionals.length) slotsRoot.innerHTML = '<p class="agenda-empty">Escolha a profissional para ver os horários.</p>';
      else { renderSlots([]); announce('Este procedimento não tem horários livres neste dia. Escolha outro procedimento ou outro dia.', 'error'); }
    } catch (error) {
      if (generation !== detailsGeneration) return;
      professionalSelect.innerHTML = '<option value="">Consulta indisponível</option>';
      slotsRoot.innerHTML = '<p class="agenda-empty">Não foi possível consultar os horários.</p>';
      find('[data-details-retry]').hidden = false; announce(message(error), 'error');
    } finally { if (generation === detailsGeneration) { state.loadingDetails = false; syncControls(); } }
  }
  procedureSelect.addEventListener('change', () => {
    if (state.submitting) return;
    state.selectedProcedure = procedureSelect.value || null;
    find('[data-duration]').textContent = state.procedures.find(item => item.id === state.selectedProcedure)?.durationMinutes ? `${state.procedures.find(item => item.id === state.selectedProcedure).durationMinutes} min` : '';
    announce(''); loadProfessionals();
  });
  professionalSelect.addEventListener('change', () => { if (!state.submitting) selectProfessional(professionalSelect.value); });
  find('[data-month-prev]').addEventListener('click', () => loadMonth(shiftMonth(state.month, -1)));
  find('[data-month-next]').addEventListener('click', () => loadMonth(shiftMonth(state.month, 1)));
  find('[data-month-today]').addEventListener('click', () => loadMonth(bounds.min));
  find('[data-calendar-retry]').addEventListener('click', () => loadMonth());
  find('[data-details-retry]').addEventListener('click', () => state.procedures.length ? loadProfessionals() : loadCatalog());
  function showSuccess(booking, payload, names, whatsappUrl) {
    const text = (selector, value) => { const node = find(selector); if (node) node.textContent = value; };
    text('[data-success-name]', payload.name);
    text('[data-success-procedure]', booking.procedureName || names.procedure);
    text('[data-success-professional]', booking.professionalName || names.professional);
    text('[data-success-date]', formatDate(booking.date || payload.date));
    text('[data-success-time]', booking.time || payload.time);
    find('[data-success-whatsapp]').href = whatsappUrl;
    form.hidden = true; success.hidden = false;
    success.focus();
  }
  function openWhatsApp(url) { try { view?.open(url, '_blank', 'noopener,noreferrer'); } catch { /* O resumo mantém o link manual. */ } }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.submitting) return;
    const payload = { procedureId: state.selectedProcedure, professionalId: state.selectedProfessional, date: state.selectedDate, time: state.selectedSlot, name: form.querySelector('[name="name"]').value.trim(), phone: normalizePhone(form.querySelector('[name="phone"]').value), website: form.querySelector('[name="website"]').value };
    const error = !payload.date ? 'Escolha o dia.' : !payload.procedureId ? 'Escolha o procedimento.' : !payload.professionalId ? 'Escolha a profissional.' : !payload.time ? 'Escolha o horário.' : payload.name.length < 2 ? 'Informe seu nome.' : !/^55\d{10,11}$/.test(payload.phone) ? 'Informe um WhatsApp válido com DDD.' : '';
    if (error) { announce(error, 'error'); return; }
    const names = { procedure: state.procedures.find(item => item.id === payload.procedureId)?.name || '', professional: state.professionals.find(item => item.id === payload.professionalId)?.name || '' };
    state.submitting = true; renderCalendar(); announce('Confirmando seu horário...');
    try {
      const result = await api.book(payload);
      const booking = result?.booking;
      if (!booking?.id) throw new Error('Não foi possível confirmar a reserva. Consulte a BC antes de tentar novamente.');
      const text = `Olá, BC Estética! Meu agendamento foi confirmado pelo site.\n\nNome: ${payload.name}\nProcedimento: ${booking.procedureName || names.procedure}\nProfissional: ${booking.professionalName || names.professional}\nData: ${formatDate(booking.date || payload.date)}\nHorário: ${booking.time || payload.time}`;
      const whatsappUrl = `https://wa.me/${BC_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
      showSuccess(booking, payload, names, whatsappUrl);
      announce('Agendamento confirmado. Seu horário já está reservado.', 'ok');
      openWhatsApp(whatsappUrl);
    } catch (error) {
      if (error instanceof PublicAgendaError && error.status === 409) await loadProfessionals();
      announce(message(error), 'error');
    } finally { state.submitting = false; renderCalendar(); }
  });
  const ready = Promise.all([loadMonth(), loadCatalog()]);
  return { state, ready, loadCatalog, loadMonth, loadProfessionals };
}
if (typeof document !== 'undefined') initPublicAgenda();
