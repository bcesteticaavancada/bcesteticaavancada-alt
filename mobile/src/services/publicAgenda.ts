/**
 * Cliente de LEITURA da Agenda V2.
 *
 * Os métodos abaixo refletem exclusivamente ações públicas do backend:
 * catalog, professionals, month e slots. Este módulo não oferece "book",
 * "recover", cadastro, escrita ou conexão privilegiada.
 *
 * A produção só pode ser consultada se a URL HTTPS for fornecida
 * explicitamente pelo responsável pelo build. Não há URL padrão.
 */
export type CatalogProcedure = {
  id: string;
  name: string;
  durationMinutes: number;
};

export type PublicProfessional = { id: string; name: string };
export type MonthDay = { date: string; available: boolean; state: 'available' | 'unavailable' };

export interface AgendaReader {
  getCatalog(): Promise<CatalogProcedure[]>;
  getProfessionals(procedureId: string): Promise<PublicProfessional[]>;
  getMonth(procedureId: string, professionalId: string, month: string): Promise<MonthDay[]>;
  getSlots(procedureId: string, professionalId: string, date: string): Promise<string[]>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AgendaReadError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'AgendaReadError';
    this.status = status;
  }
}

function uuid(value: string, label: string): string {
  if (!UUID.test(value)) throw new AgendaReadError(`${label} inválido.`);
  return value;
}

function dateOnly(value: string): string {
  if (!DATE.test(value)) throw new AgendaReadError('Data inválida.');
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.toISOString().slice(0, 10) !== value) throw new AgendaReadError('Data inexistente.');
  return value;
}

function monthOnly(value: string): string {
  if (!MONTH.test(value)) throw new AgendaReadError('Mês inválido.');
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AgendaReadError('Resposta inválida da agenda.');
  return value as Record<string, unknown>;
}

function entries(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new AgendaReadError('Lista inválida da agenda.');
  return value.map(record);
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function publicId(value: unknown): string {
  const id = string(value);
  return UUID.test(id) ? id : '';
}

export function createPublicAgendaReader({
  endpoint,
  fetchImpl = fetch,
  timeoutMs = 20_000,
}: {
  endpoint: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): AgendaReader {
  // Não aceita domínios arbitrários de HTTP nem URL oculta no próprio app.
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || !url.pathname.endsWith('/functions/v1/public-agenda')) {
    throw new AgendaReadError('Endpoint HTTPS da agenda inválido.');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
    throw new AgendaReadError('Timeout inválido.');
  }

  async function post(action: 'catalog' | 'professionals' | 'month' | 'slots', params: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new AgendaReadError(response.status === 429
        ? 'A agenda recebeu muitas consultas. Tente novamente em instantes.'
        : 'Não foi possível consultar a agenda. Tente novamente.', response.status);
      return record(await response.json());
    } catch (error) {
      if (error instanceof AgendaReadError) throw error;
      throw new AgendaReadError('Falha de conexão com a agenda.');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async getCatalog() {
      const body = await post('catalog');
      return entries(body.procedures)
        .map((row) => ({ id: publicId(row.id), name: string(row.name).trim(), durationMinutes: Number(row.durationMinutes) }))
        .filter((row) => row.id && row.name && Number.isFinite(row.durationMinutes) && row.durationMinutes > 0);
    },
    async getProfessionals(procedureId) {
      const body = await post('professionals', { procedureId: uuid(procedureId, 'Procedimento') });
      return entries(body.professionals)
        .map((row) => ({ id: publicId(row.id), name: string(row.name).trim() }))
        .filter((row) => row.id && row.name);
    },
    async getMonth(procedureId, professionalId, month) {
      const body = await post('month', {
        procedureId: uuid(procedureId, 'Procedimento'),
        professionalId: uuid(professionalId, 'Profissional'),
        month: monthOnly(month),
      });
      return entries(body.days)
        .map((row) => ({
          date: string(row.date),
          available: row.available === true,
          state: row.available === true ? 'available' as const : 'unavailable' as const,
        }))
        .filter((row) => DATE.test(row.date) && row.date.startsWith(month + '-'));
    },
    async getSlots(procedureId, professionalId, date) {
      const body = await post('slots', {
        procedureId: uuid(procedureId, 'Procedimento'),
        professionalId: uuid(professionalId, 'Profissional'),
        date: dateOnly(date),
      });
      if (!Array.isArray(body.slots)) throw new AgendaReadError('Lista de horários inválida.');
      return [...new Set(body.slots.map(string).filter((time) => TIME.test(time)))].sort();
    },
  };
}

/**
 * Fixture explícita para desenvolvimento: NÃO envia requisições e não
 * representa a disponibilidade real da clínica.
 */
export function createFixtureAgendaReader(): AgendaReader {
  const demoProcedures: CatalogProcedure[] = [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Limpeza de pele', durationMinutes: 60 },
    { id: '00000000-0000-4000-8000-000000000002', name: 'Massagem relaxante', durationMinutes: 60 },
    { id: '00000000-0000-4000-8000-000000000003', name: 'Avaliação estética', durationMinutes: 45 },
  ];
  const demoProfessional: PublicProfessional[] = [
    { id: '00000000-0000-4000-8000-000000000101', name: 'Profissional demonstrativa' },
  ];
  return {
    async getCatalog() { return demoProcedures.map((item) => ({ ...item })); },
    async getProfessionals(procedureId) {
      return demoProcedures.some((item) => item.id === procedureId) ? demoProfessional.map((item) => ({ ...item })) : [];
    },
    async getMonth(procedureId, professionalId, month) {
      if (!demoProcedures.some((p) => p.id === procedureId) || professionalId !== demoProfessional[0].id) return [];
      monthOnly(month);
      const [year, monthNumber] = month.split('-').map(Number);
      const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      return Array.from({ length: daysInMonth }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        const available = new Date(date + 'T12:00:00Z').getUTCDay() !== 0;
        return { date, available, state: available ? 'available' as const : 'unavailable' as const };
      });
    },
    async getSlots(procedureId, professionalId, date) {
      dateOnly(date);
      return demoProcedures.some((p) => p.id === procedureId) && professionalId === demoProfessional[0].id
        && new Date(date + 'T12:00:00Z').getUTCDay() !== 0
        ? ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']
        : [];
    },
  };
}
