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

export function createPublicAgendaApi({ endpoint = PUBLIC_AGENDA_FUNCTION_URL, fetchImpl = fetch, timeoutMs=20000, storage, cryptoImpl=globalThis.crypto } = {}) {
  let lastRequest=null;
  const keyName='bc.publicBooking.retry.v1';
  try {storage ||= globalThis.window?.sessionStorage;} catch { /* Memory fallback. */ }
  async function requestKey(payload) {
    const bytes=new TextEncoder().encode(JSON.stringify(payload));
    const fingerprint=Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
    if(!lastRequest)try{lastRequest=JSON.parse(storage?.getItem(keyName)||'null');}catch{lastRequest=null;}
    if(lastRequest?.fingerprint!==fingerprint || lastRequest.expiresAt<=Date.now() || !/^[a-f0-9-]{36}$/i.test(lastRequest?.key||'')) {
      lastRequest={fingerprint,key:cryptoImpl.randomUUID(),expiresAt:Date.now()+30*60*1000};
      try{storage?.setItem(keyName,JSON.stringify(lastRequest));}catch{ /* Page memory keeps retry usable. */ }
    }
    return lastRequest.key;
  }
  async function post(payload) {
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
    const response = await fetchImpl(endpoint, {
      signal:controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new PublicAgendaError(messageForStatus(response.status, body?.error), response.status);
    }
    return body;
    } catch(error) {
      if(error instanceof PublicAgendaError)throw error;
      throw new PublicAgendaError(payload.action==='book' ? 'A resposta não chegou. Tente novamente com os mesmos dados para recuperar a mesma reserva, ou consulte a BC.' : 'Não foi possível atualizar agora. Tente novamente.',0);
    } finally {clearTimeout(timer);}
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
      const payload={action:'book',procedureId,professionalId,date,time,name:name.trim().replace(/\s+/g,' '),phone:String(phone).replace(/\D/g,''),website};
      return post({...payload,requestKey:await requestKey(payload)});
    },
  };
}
