import { buildMonthCells, clinicToday, publicMonthBounds } from './agenda/js/calendar.js';

const storageKey = 'bc.mobile.demo-appointments.v1';
const times = ['09:00', '10:30', '14:00', '16:30'];
const procedures = [
  { id: 'avaliacao', name: 'Avaliação estética', durationMinutes: 60 },
  { id: 'limpeza', name: 'Limpeza de pele', durationMinutes: 60 },
  { id: 'massagem', name: 'Massagem relaxante', durationMinutes: 60 },
];
const professionals = [
  { id: 'facial', name: 'Equipe facial (teste)', procedureIds: ['avaliacao', 'limpeza'] },
  { id: 'corporal', name: 'Equipe corporal (teste)', procedureIds: ['avaliacao', 'massagem'] },
];

export function readDemoBookings(storage) {
  try {
    const bookings = JSON.parse(storage.getItem(storageKey) || '[]');
    return Array.isArray(bookings) ? bookings : [];
  } catch {
    return [];
  }
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createDemoAgendaFetch({ storage, today = clinicToday() }) {
  const bounds = publicMonthBounds(today);

  function availableSlots(date, professionalId, bookings) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || date < today || date.slice(0, 7) > bounds.max) return [];
    const instant = new Date(`${date}T12:00:00Z`);
    if (!Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== date
      || instant.getUTCDay() === 0) return [];
    return times.filter(time => !bookings.some(booking => (
      booking.date === date && booking.time === time && booking.professionalId === professionalId
    )));
  }

  return async function demoAgendaFetch(_endpoint, { body }) {
    const request = JSON.parse(body);
    const { action, month, date, time, procedureId, professionalId, requestKey } = request;
    const bookings = readDemoBookings(storage);

    if (action === 'catalog') return response({ procedures });
    if (action === 'overview') {
      if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        || month < bounds.min || month > bounds.max) {
        return response({ error: 'Mês fora do calendário de teste.' }, 422);
      }
      const days = buildMonthCells(month, [], today).filter(Boolean).map(({ date: day }) => ({
        date: day,
        available: professionals.some(item => availableSlots(day, item.id, bookings).length),
      }));
      return response({ month, days });
    }
    if (action === 'recover') {
      const booking = bookings.find(item => item.id === `beta-${requestKey}`);
      return booking
        ? response({ booking })
        : response({ error: 'A reserva de teste ainda não foi localizada.' }, 404);
    }

    const procedure = procedures.find(item => item.id === procedureId);
    if (!procedure) return response({ error: 'Escolha um procedimento de teste.' }, 422);
    const eligible = professionals.filter(item => item.procedureIds.includes(procedureId));
    if (action === 'professionals') {
      return response({ professionals: eligible.map(({ id, name }) => ({ id, name })) });
    }

    const professional = eligible.find(item => item.id === professionalId);
    if (!professional) return response({ error: 'Escolha uma profissional de teste.' }, 422);
    const slots = availableSlots(date, professionalId, bookings);
    if (action === 'slots') return response({ slots });
    if (action !== 'book' || typeof requestKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestKey)) {
      return response({ error: 'Pedido de teste inválido.' }, 422);
    }

    const id = `beta-${requestKey}`;
    const previous = bookings.find(item => item.id === id);
    if (previous) {
      const same = previous.date === date && previous.time === time
        && previous.professionalId === professionalId && previous.procedureId === procedureId;
      return same
        ? response({ booking: previous })
        : response({ error: 'Esta tentativa já está vinculada a outro horário de teste.' }, 409);
    }
    if (!slots.includes(time)) return response({ error: 'Este horário de teste já está indisponível.' }, 409);

    const booking = { id, date, time, procedureId, professionalId, procedureName: procedure.name, professionalName: professional.name };
    try {
      storage.setItem(storageKey, JSON.stringify([...bookings, booking]));
    } catch {
      return response({ error: 'Não foi possível salvar neste aparelho. Confira o espaço disponível e tente novamente.' }, 422);
    }
    return response({ booking }, 201);
  };
}
