import { registerAttendance } from './agenda-api.js';

export const ATTENDANCE_FIELDS = [
  'queixa_objetivo',
  'observacoes',
  'reacoes',
  'intercorrencias',
  'feedback_cliente',
  'orientacoes',
  'recomendacao_proxima_sessao',
];

export function normalizeAttendanceFields(values = {}) {
  return Object.fromEntries(
    ATTENDANCE_FIELDS.map((name) => [name, String(values?.[name] ?? '').trim()]),
  );
}

export function validateAttendanceFields(values = {}) {
  const normalized = normalizeAttendanceFields(values);
  const hasMeaningfulContent = ATTENDANCE_FIELDS.some((name) => normalized[name].length > 0);
  return hasMeaningfulContent
    ? { valid: true, message: '' }
    : { valid: false, message: 'Registre ao menos uma observação do atendimento.' };
}

function valuesFromForm(form) {
  return Object.fromEntries(
    ATTENDANCE_FIELDS.map((name) => [name, form?.elements?.namedItem?.(name)?.value ?? '']),
  );
}

function setStatus(statusEl, message, kind = '') {
  if (!statusEl) return;
  statusEl.textContent = message || '';
  if (statusEl.dataset) statusEl.dataset.kind = kind;
}

function resolveAppointmentId(appointmentId) {
  const value = typeof appointmentId === 'function' ? appointmentId() : appointmentId;
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error('Agendamento não selecionado.');
  return clean;
}

export function bindAttendanceForm({ form, client, appointmentId, onSuccess = async () => {} }) {
  if (!form || typeof form.addEventListener !== 'function') throw new Error('Formulário de atendimento inválido.');
  if (!client || typeof client.rpc !== 'function') throw new Error('Cliente Supabase indisponível.');
  if (typeof onSuccess !== 'function') throw new Error('Callback de sucesso inválido.');

  const submitButton = form.querySelector?.('[type="submit"]') ?? null;
  const statusEl = form.querySelector?.('[data-attendance-status]') ?? null;
  let inFlight = false;

  form.addEventListener('submit', async (event) => {
    event?.preventDefault?.();
    if (inFlight) return;

    const fields = normalizeAttendanceFields(valuesFromForm(form));
    const validation = validateAttendanceFields(fields);
    if (!validation.valid) {
      setStatus(statusEl, validation.message, 'error');
      return;
    }

    let id;
    try {
      id = resolveAppointmentId(appointmentId);
    } catch (error) {
      setStatus(statusEl, error?.message || 'Agendamento não selecionado.', 'error');
      return;
    }

    inFlight = true;
    if (submitButton) submitButton.disabled = true;
    setStatus(statusEl, 'Salvando atendimento…');

    try {
      const attendanceId = await registerAttendance({
        client,
        appointmentId: id,
        fields,
      });
      form.reset?.();
      setStatus(statusEl, 'Atendimento registrado com sucesso.', 'success');
      await onSuccess(attendanceId);
    } catch (error) {
      setStatus(statusEl, error?.message || 'Não foi possível registrar o atendimento.', 'error');
    } finally {
      inFlight = false;
      if (submitButton) submitButton.disabled = false;
    }
  });

  return {
    isSubmitting: () => inFlight,
  };
}
