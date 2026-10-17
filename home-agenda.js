import { createPublicAgendaApi } from './agenda/js/api.js';
import { currentClinicMonth } from './agenda/js/calendar.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function formatDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date || '';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function initHomeAgenda({ root = document, api = createPublicAgendaApi() } = {}) {
  const widget = root.querySelector('[data-home-agenda]');
  if (!widget) return null;

  const startButton = widget.querySelector('[data-home-agenda-start]');
  const procedureSelect = widget.querySelector('[data-home-agenda-procedure]');
  const professionalSelect = widget.querySelector('[data-home-agenda-professional]');
  const controls = widget.querySelector('[data-home-agenda-controls]');
  const results = widget.querySelector('[data-home-agenda-results]');
  const status = widget.querySelector('[data-home-agenda-status]');

  if (!startButton || !procedureSelect || !professionalSelect || !controls || !results) return null;

  const state = {
    procedures: [],
    professionals: [],
    started: false,
  };

  function announce(message = '', tone = '') {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function resetPreview(message = 'Escolha o procedimento e a profissional para ver os próximos horários livres.') {
    results.innerHTML = `<p class="home-agenda-empty">${escapeHtml(message)}</p>`;
  }

  function setStartBusy(busy) {
    startButton.disabled = busy;
    startButton.textContent = busy ? 'Carregando agenda...' : 'Consultar horários livres';
  }

  startButton.addEventListener('click', async () => {
    if (state.started) {
      controls.hidden = false;
      procedureSelect.focus();
      return;
    }

    setStartBusy(true);
    announce('Carregando os procedimentos disponíveis...');
    try {
      const response = await api.getCatalog();
      state.procedures = Array.isArray(response?.procedures) ? response.procedures : [];
      procedureSelect.innerHTML = '<option value="">Escolha o procedimento</option>'
        + state.procedures.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
      state.started = true;
      controls.hidden = false;
      startButton.hidden = true;
      procedureSelect.disabled = false;
      procedureSelect.focus();
      announce(state.procedures.length ? 'Agora escolha o procedimento.' : 'A agenda online está indisponível neste momento.', state.procedures.length ? 'ok' : 'error');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Não foi possível consultar a agenda agora.', 'error');
      setStartBusy(false);
    }
  });

  procedureSelect.addEventListener('change', async () => {
    professionalSelect.disabled = true;
    professionalSelect.innerHTML = '<option value="">Escolha primeiro um procedimento</option>';
    resetPreview();
    announce('');
    if (!procedureSelect.value) return;

    professionalSelect.innerHTML = '<option value="">Carregando profissionais...</option>';
    try {
      const response = await api.getProfessionals(procedureSelect.value);
      state.professionals = Array.isArray(response?.professionals) ? response.professionals : [];
      professionalSelect.innerHTML = '<option value="">Escolha a profissional</option>'
        + state.professionals.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
      professionalSelect.disabled = state.professionals.length === 0;
      announce(state.professionals.length ? 'Escolha a profissional para ver horários livres.' : 'Sem profissionais disponíveis para este procedimento no agendamento online.', state.professionals.length ? 'ok' : 'error');
    } catch (error) {
      professionalSelect.innerHTML = '<option value="">Indisponível</option>';
      announce(error instanceof Error ? error.message : 'Não foi possível carregar as profissionais.', 'error');
    }
  });

  professionalSelect.addEventListener('change', async () => {
    resetPreview('Buscando os próximos horários livres...');
    announce('');
    if (!professionalSelect.value || !procedureSelect.value) return;

    try {
      const month = currentClinicMonth();
      const monthResponse = await api.getMonth({
        procedureId: procedureSelect.value,
        professionalId: professionalSelect.value,
        month,
      });
      const freeDays = (Array.isArray(monthResponse?.days) ? monthResponse.days : [])
        .filter((day) => day?.available === true)
        .map((day) => String(day.date || ''))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .slice(0, 5);

      const preview = [];
      for (const date of freeDays) {
        if (preview.length >= 4) break;
        const slotResponse = await api.getSlots({
          procedureId: procedureSelect.value,
          professionalId: professionalSelect.value,
          date,
        });
        for (const time of Array.isArray(slotResponse?.slots) ? slotResponse.slots : []) {
          preview.push({ date, time });
          if (preview.length >= 4) break;
        }
      }

      if (!preview.length) {
        resetPreview('Não encontramos horário livre neste mês para essa combinação. Você pode consultar outro mês pelo WhatsApp.');
        announce('Sem horários livres neste mês.', 'error');
        return;
      }

      results.innerHTML = preview.map(({ date, time }) => `
        <a class="home-agenda-slot" href="agenda/" aria-label="Ver calendário completo a partir de ${escapeHtml(formatDate(date))} às ${escapeHtml(time)}">
          <span>${escapeHtml(formatDate(date))}</span>
          <strong>${escapeHtml(time)}</strong>
          <small>livre</small>
        </a>`).join('');
      announce('Estes são alguns dos próximos horários livres deste mês.', 'ok');
    } catch (error) {
      resetPreview('Não foi possível consultar os horários agora. Use o calendário completo ou fale com a BC.');
      announce(error instanceof Error ? error.message : 'Não foi possível consultar os horários.', 'error');
    }
  });

  return { state };
}

if (typeof document !== 'undefined') {
  initHomeAgenda({ root: document, api: createPublicAgendaApi() });
}
