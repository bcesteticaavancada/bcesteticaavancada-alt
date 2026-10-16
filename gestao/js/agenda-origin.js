export function normalizeAgendaView(value = 'all') {
  const view = String(value || 'all');
  if (!['all', 'site', 'internal'].includes(view)) throw new Error('Visão de agenda inválida.');
  return view;
}

export function agendaOriginKind(appointment = {}) {
  return (appointment.booking_channel ?? (appointment.origem === 'site' ? 'site' : 'internal')) === 'site' ? 'site' : 'internal';
}

export function agendaOriginLabel(appointment) {
  return agendaOriginKind(appointment) === 'site' ? 'Site' : 'Interna';
}
