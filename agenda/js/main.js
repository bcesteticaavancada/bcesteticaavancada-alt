import { BC_WHATSAPP_NUMBER } from '../../assets/js/bc-public-config.js';
import { createPublicAgendaApi, PublicAgendaError } from './api.js';
import { currentClinicMonth, renderPublicCalendar } from './calendar.js';

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizePhone(value) {
  const raw = digits(value);
  if (raw.length === 10 || raw.length === 11) return `55${raw}`;
  return raw;
}

function formatDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date || '';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function buildWhatsAppUrl(message) {
  return `https://wa.me/${BC_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function setBusy(element, busy, busyText = 'Carregando...') {
  if (!element) return;
  if (!element.dataset.originalText) element.dataset.originalText = element.textContent || '';
  element.disabled = busy;
  element.textContent = busy ? busyText : element.dataset.originalText;
}

export function initPublicAgenda({ root = document, api = createPublicAgendaApi() } = {}) {
  const procedureSelect = root.querySelector('[data-procedure]');
  const professionalSelect = root.querySelector('[data-professional]');
  const calendarRoot = root.querySelector('[data-calendar]');
  const slotsRoot = root.querySelector('[data-slots]');
  const form = root.querySelector('[data-booking-form]');
  const submitButton = root.querySelector('[data-submit]');
  const status = root.querySelector('[data-status]');
  const success = root.querySelector('[data-booking-success]');

  if (!procedureSelect || !professionalSelect || !calendarRoot || !slotsRoot || !form || !submitButton) {
    return null;
  }

  const state = {
    procedures: [],
    professionals: [],
    selectedProcedure: null,
    selectedProfessional: null,
    selectedDate: null,
    selectedSlot: null,
    month: currentClinicMonth(),
    days: [],
    submitting: false,
  };

  function announce(message = '', tone = '') {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function resetDate() {
    state.selectedDate = null;
    state.selectedSlot = null;
    state.days = [];
    slotsRoot.innerHTML = '<p class="agenda-empty">Escolha uma data disponível para ver os horários.</p>';
    calendarRoot.innerHTML = '<p class="agenda-empty">Escolha uma profissional para carregar o calendário.</p>';
  }

  function resetProfessional() {
    state.selectedProfessional = null;
    professionalSelect.innerHTML = '<option value="">Escolha primeiro um procedimento</option>';
    professionalSelect.disabled = true;
    resetDate();
  }

  function selectedProcedure() {
    return state.procedures.find((item) => item.id === state.selectedProcedure) || null;
  }

  function selectedProfessional() {
    return state.professionals.find((item) => item.id === state.selectedProfessional) || null;
  }

  function renderSlots(slots = []) {
    state.selectedSlot = null;
    if (!slots.length) {
      slotsRoot.innerHTML = '<p class="agenda-empty">Não há horários livres neste dia.</p>';
      return;
    }
    slotsRoot.innerHTML = slots.map((time) => `<button type="button" class="agenda-slot" data-slot="${escapeText(time)}" aria-pressed="false">${escapeText(time)}</button>`).join('');
    slotsRoot.querySelectorAll('[data-slot]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedSlot = button.dataset.slot;
        slotsRoot.querySelectorAll('[data-slot]').forEach((item) => {
          const active = item === button;
          item.classList.toggle('is-selected', active);
          item.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        announce('Horário selecionado. Preencha seu nome e WhatsApp para confirmar.', 'ok');
      });
    });
  }

  async function loadSlots(date) {
    state.selectedDate = date;
    state.selectedSlot = null;
    slotsRoot.innerHTML = '<p class="agenda-empty">Carregando horários...</p>';
    renderPublicCalendar({
      root: calendarRoot,
      month: state.month,
      days: state.days,
      selectedDate: date,
      onSelect: loadSlots,
    });
    try {
      const response = await api.getSlots({
        procedureId: state.selectedProcedure,
        professionalId: state.selectedProfessional,
        date,
      });
      renderSlots(Array.isArray(response?.slots) ? response.slots : []);
    } catch (error) {
      renderSlots([]);
      announce(error instanceof Error ? error.message : 'Não foi possível carregar os horários.', 'error');
    }
  }

  async function loadMonth() {
    if (!state.selectedProcedure || !state.selectedProfessional) return;
    resetDate();
    calendarRoot.innerHTML = '<p class="agenda-empty">Carregando calendário...</p>';
    try {
      const response = await api.getMonth({
        procedureId: state.selectedProcedure,
        professionalId: state.selectedProfessional,
        month: state.month,
      });
      state.month = response?.month || state.month;
      state.days = Array.isArray(response?.days) ? response.days : [];
      renderPublicCalendar({
        root: calendarRoot,
        month: state.month,
        days: state.days,
        selectedDate: state.selectedDate,
        onSelect: loadSlots,
      });
      announce('Escolha um dia marcado como Livre.', 'ok');
    } catch (error) {
      calendarRoot.innerHTML = '<p class="agenda-empty">Calendário indisponível no momento.</p>';
      announce(error instanceof Error ? error.message : 'Não foi possível carregar o calendário.', 'error');
    }
  }

  procedureSelect.addEventListener('change', async () => {
    state.selectedProcedure = procedureSelect.value || null;
    resetProfessional();
    announce('');
    if (!state.selectedProcedure) return;

    professionalSelect.innerHTML = '<option value="">Carregando profissionais...</option>';
    try {
      const response = await api.getProfessionals(state.selectedProcedure);
      state.professionals = Array.isArray(response?.professionals) ? response.professionals : [];
      professionalSelect.innerHTML = '<option value="">Selecione a profissional</option>'
        + state.professionals.map((item) => `<option value="${escapeText(item.id)}">${escapeText(item.name)}</option>`).join('');
      professionalSelect.disabled = state.professionals.length === 0;
      if (!state.professionals.length) announce('Nenhuma profissional está disponível para este procedimento no agendamento online.', 'error');
    } catch (error) {
      professionalSelect.innerHTML = '<option value="">Indisponível</option>';
      announce(error instanceof Error ? error.message : 'Não foi possível carregar as profissionais.', 'error');
    }
  });

  professionalSelect.addEventListener('change', () => {
    state.selectedProfessional = professionalSelect.value || null;
    state.selectedDate = null;
    state.selectedSlot = null;
    if (state.selectedProfessional) loadMonth();
    else resetDate();
  });

  function validateBeforeBooking() {
    if (!state.selectedProcedure) return 'Escolha o procedimento.';
    if (!state.selectedProfessional) return 'Escolha a profissional.';
    if (!state.selectedDate) return 'Escolha a data.';
    if (!state.selectedSlot) return 'Escolha o horário.';
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const phone = normalizePhone(formData.get('phone'));
    if (name.length < 2) return 'Informe seu nome.';
    if (!/^55\d{10,11}$/.test(phone)) return 'Informe um WhatsApp válido com DDD.';
    return null;
  }

  function showSuccess(booking, name, whatsappUrl) {
    if (!success) return;
    success.hidden = false;
    root.querySelector('[data-success-procedure]').textContent = booking.procedureName || selectedProcedure()?.name || '';
    root.querySelector('[data-success-professional]').textContent = booking.professionalName || selectedProfessional()?.name || '';
    root.querySelector('[data-success-date]').textContent = formatDate(booking.date || state.selectedDate);
    root.querySelector('[data-success-time]').textContent = booking.time || state.selectedSlot || '';
    const link = root.querySelector('[data-success-whatsapp]');
    if (link) link.href = whatsappUrl;
    success.querySelector('[data-success-name]')?.replaceChildren(document.createTextNode(name));
    success.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openWhatsApp(url) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // O botão manual permanece disponível no card de sucesso.
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.submitting) return;
    const validationError = validateBeforeBooking();
    if (validationError) {
      announce(validationError, 'error');
      return;
    }

    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const phone = normalizePhone(formData.get('phone'));
    const website = String(formData.get('website') || '');
    state.submitting = true;
    submitButton.disabled = true;
    setBusy(submitButton, true, 'Confirmando...');
    announce('Confirmando seu horário...', '');

    try {
      const result = await api.book({
        procedureId: state.selectedProcedure,
        professionalId: state.selectedProfessional,
        date: state.selectedDate,
        time: state.selectedSlot,
        name,
        phone,
        website,
      });
      const booking = result?.booking || {};
      const message = `Olá, BC Estética! Meu agendamento foi confirmado pelo site.\n\nNome: ${name}\nProcedimento: ${booking.procedureName || selectedProcedure()?.name || ''}\nProfissional: ${booking.professionalName || selectedProfessional()?.name || ''}\nData: ${formatDate(booking.date || state.selectedDate)}\nHorário: ${booking.time || state.selectedSlot}`;
      const whatsappUrl = buildWhatsAppUrl(message);
      showSuccess(booking, name, whatsappUrl);
      announce('Agendamento confirmado. Seu horário já está reservado.', 'ok');
      openWhatsApp(whatsappUrl);
    } catch (error) {
      if (error instanceof PublicAgendaError && error.status === 409 && state.selectedDate) {
        announce(error.message, 'error');
        await loadSlots(state.selectedDate);
      } else {
        announce(error instanceof Error ? error.message : 'Não foi possível confirmar agora.', 'error');
      }
    } finally {
      state.submitting = false;
      submitButton.disabled = false;
      setBusy(submitButton, false);
    }
  });

  async function loadCatalog() {
    procedureSelect.disabled = true;
    procedureSelect.innerHTML = '<option value="">Carregando procedimentos...</option>';
    try {
      const response = await api.getCatalog();
      state.procedures = Array.isArray(response?.procedures) ? response.procedures : [];
      procedureSelect.innerHTML = '<option value="">Selecione o procedimento</option>'
        + state.procedures.map((item) => `<option value="${escapeText(item.id)}">${escapeText(item.name)}</option>`).join('');
      procedureSelect.disabled = false;
      if (!state.procedures.length) announce('O agendamento online está sem procedimentos disponíveis neste momento.', 'error');
    } catch (error) {
      procedureSelect.innerHTML = '<option value="">Indisponível</option>';
      announce(error instanceof Error ? error.message : 'Não foi possível carregar a agenda.', 'error');
    }
  }

  loadCatalog();
  return { state, loadCatalog, loadMonth, loadSlots };
}

if (typeof document !== 'undefined') {
  initPublicAgenda({ root: document, api: createPublicAgendaApi() });
}
