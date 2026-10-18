import { validatePublicAgendaPayload } from './domain.js';

export type PublicAgendaAction =
  | { action: 'catalog' }
  | { action: 'recover'; requestKey: string }
  | { action: 'overview'; month: string }
  | { action: 'professionals'; procedureId: string }
  | { action: 'month'; procedureId: string; professionalId: string; month: string }
  | { action: 'slots'; procedureId: string; professionalId: string; date: string }
  | { action: 'book'; procedureId: string; professionalId: string; date: string; time: string; name: string; phone: string; website: ''; requestKey?: string };

export function validateRequest(raw: unknown): { ok: true; data: PublicAgendaAction } | { ok: false; error: string } {
  try {
    return { ok: true, data: validatePublicAgendaPayload(raw) as PublicAgendaAction };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Requisição inválida.',
    };
  }
}
