import { PUBLIC_AGENDA_FUNCTION_URL } from '../../assets/js/bc-public-config.js';

export class PublicAgendaError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'PublicAgendaError';
    this.status = status;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function messageForStatus(status, backendMessage = '') {
  if (status === 409) return backendMessage || 'Esse horário acabou de ser reservado. Escolha outro horário disponível.';
  if (status === 429) return backendMessage || 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  if (status >= 500) return 'Não foi possível concluir agora. Fale com a BC pelo WhatsApp.';
  return backendMessage || 'Confira os dados e tente novamente.';
}

export function createPublicAgendaApi({ endpoint = PUBLIC_AGENDA_FUNCTION_URL, fetchImpl = fetch } = {}) {
  async function post(payload) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new PublicAgendaError(messageForStatus(response.status, body?.error), response.status);
    }
    return body;
  }

  return {
    async getCatalog() {
      return post({ action: 'catalog' });
    },
    async getOverview({ month }) {
      return post({ action: 'overview', month });
    },
    async getProfessionals(procedureId) {
      return post({ action: 'professionals', procedureId });
    },
    async getMonth({ procedureId, professionalId, month }) {
      return post({ action: 'month', procedureId, professionalId, month });
    },
    async getSlots({ procedureId, professionalId, date }) {
      return post({ action: 'slots', procedureId, professionalId, date });
    },
    async book({ procedureId, professionalId, date, time, name, phone, website = '' }) {
      return post({ action: 'book', procedureId, professionalId, date, time, name, phone, website });
    },
  };
}
