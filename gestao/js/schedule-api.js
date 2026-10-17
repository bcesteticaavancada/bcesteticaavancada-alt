function ensureClient(client) {
  if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') {
    throw new Error('Cliente Supabase indisponível.');
  }
}

function cleanRequired(value, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`${label} é obrigatório.`);
  return clean;
}

function cleanOptional(value) {
  const clean = String(value ?? '').trim();
  return clean || null;
}

function cleanEnabled(value) {
  if (typeof value !== 'boolean') throw new Error('Estado da disponibilidade é obrigatório.');
  return value;
}

function cleanDates(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('Datas são obrigatórias.');
  return values.map((value) => cleanRequired(value, 'Data'));
}

function throwIfError(error, fallback) {
  if (error) throw new Error(error.message || fallback);
}

async function callRpc(client, name, payload, fallback) {
  ensureClient(client);
  const { data, error } = await client.rpc(name, payload);
  throwIfError(error, fallback);
  return data;
}

export async function getScheduleMonth({ client, professionalUserId, month }) {
  return callRpc(client, 'bc_schedule_month_get', {
    p_professional_user_id: cleanRequired(professionalUserId, 'Profissional'),
    p_month: cleanRequired(month, 'Mês'),
  }, 'Não foi possível carregar a disponibilidade mensal.');
}

export async function upsertAvailabilityDay({ client, professionalUserId, localDate, enabled, startTime = null, endTime = null }) {
  return callRpc(client, 'bc_schedule_day_upsert', {
    p_professional_user_id: cleanRequired(professionalUserId, 'Profissional'),
    p_local_date: cleanRequired(localDate, 'Data'),
    p_enabled: cleanEnabled(enabled),
    p_start_time: cleanOptional(startTime),
    p_end_time: cleanOptional(endTime),
  }, 'Não foi possível salvar a disponibilidade do dia.');
}

export async function applyAvailabilityDays({ client, professionalUserId, dates, enabled, startTime = null, endTime = null }) {
  return callRpc(client, 'bc_schedule_days_apply', {
    p_professional_user_id: cleanRequired(professionalUserId, 'Profissional'),
    p_local_dates: cleanDates(dates),
    p_enabled: cleanEnabled(enabled),
    p_start_time: cleanOptional(startTime),
    p_end_time: cleanOptional(endTime),
  }, 'Não foi possível aplicar a disponibilidade às datas selecionadas.');
}

export async function createScheduleBlock({ client, professionalUserId, startsAt, endsAt, blockType, internalNote = null }) {
  return callRpc(client, 'bc_schedule_block_create', {
    p_professional_user_id: cleanRequired(professionalUserId, 'Profissional'),
    p_starts_at: cleanRequired(startsAt, 'Início do bloqueio'),
    p_ends_at: cleanRequired(endsAt, 'Fim do bloqueio'),
    p_block_type: cleanRequired(blockType, 'Tipo de bloqueio'),
    p_internal_note: cleanOptional(internalNote),
  }, 'Não foi possível criar o bloqueio de agenda.');
}

export async function deleteScheduleBlock({ client, blockId }) {
  return callRpc(client, 'bc_schedule_block_delete', {
    p_block_id: cleanRequired(blockId, 'Bloqueio'),
  }, 'Não foi possível remover o bloqueio de agenda.');
}

export async function createAgendaInactivation({ client, professionalUserId, startsOn, plannedEndsOn = null, reason, internalNote = null }) {
  return callRpc(client, 'bc_agenda_inactivation_create', {
    p_professional_user_id: cleanRequired(professionalUserId, 'Profissional'),
    p_starts_on: cleanRequired(startsOn, 'Data inicial'),
    p_planned_ends_on: cleanOptional(plannedEndsOn),
    p_reason: cleanRequired(reason, 'Motivo'),
    p_internal_note: cleanOptional(internalNote),
  }, 'Não foi possível inativar a agenda.');
}

export async function reactivateAgenda({ client, inactivationId }) {
  return callRpc(client, 'bc_agenda_reactivate', {
    p_inactivation_id: cleanRequired(inactivationId, 'Inativação'),
  }, 'Não foi possível reativar a agenda.');
}

export async function linkPublicAppointment({ client, appointmentId, clienteId }) {
  return callRpc(client, 'bc_agendamento_link_cliente', {
    p_agendamento_id: cleanRequired(appointmentId, 'Agendamento'),
    p_cliente_id: cleanRequired(clienteId, 'Cliente'),
  }, 'Não foi possível vincular a reserva ao cadastro da cliente.');
}
