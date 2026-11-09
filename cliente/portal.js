import { BC_WHATSAPP_NUMBER, CLIENT_PORTAL_FUNCTION_URL } from '../assets/js/bc-public-config.js';

const clinicTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const unavailable = 'O link está indisponível. Peça um novo acesso à equipe da BC.';

export function initClientPortal({ root = document, view = window, fetchImpl = fetch } = {}) {
  const message = root.querySelector('[data-portal-message]');
  const list = root.querySelector('[data-portal-appointments]');
  const contact = root.querySelector('[data-portal-contact]');
  const refresh = root.querySelector('[data-portal-refresh]');
  const exit = root.querySelector('[data-portal-exit]');
  let token = null;
  let activeRequest;

  function renderContact(hasAccess) {
    const text = hasAccess ? 'Olá! Quero falar sobre um horário na BC.' : 'Olá! Gostaria de pedir meu link da Área do cliente.';
    contact.href = `https://wa.me/${BC_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    contact.textContent = hasAccess ? 'Falar com a BC' : 'Pedir meu link pelo WhatsApp';
  }

  function closeAccess(text) {
    activeRequest?.abort();
    activeRequest = undefined;
    token = null;
    list.replaceChildren();
    list.hidden = true;
    message.textContent = text;
    refresh.hidden = true;
    exit.hidden = true;
    renderContact(false);
  }

  async function loadSchedule() {
    if (!token || activeRequest) return;
    const controller = new AbortController();
    activeRequest = controller;
    message.textContent = 'Consultando seus horários…';
    list.replaceChildren();
    list.hidden = true;
    refresh.hidden = false;
    refresh.disabled = true;
    exit.hidden = false;
    try {
      const response = await fetchImpl(CLIENT_PORTAL_FUNCTION_URL, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: controller.signal,
      });
      if (activeRequest !== controller) return;
      if (response.status === 404) {
        closeAccess(unavailable);
        return;
      }
      if (!response.ok) throw new Error('Schedule unavailable');
      const { appointments } = await response.json();
      if (activeRequest !== controller) return;
      const items = appointments.map(({ starts_at }) => {
        const item = root.createElement('li');
        const time = root.createElement('time');
        const badge = root.createElement('span');
        time.dateTime = starts_at;
        time.textContent = clinicTime.format(new Date(starts_at));
        badge.textContent = 'Agendado';
        item.append(time, badge);
        return item;
      });
      list.replaceChildren(...items);
      list.hidden = items.length === 0;
      message.textContent = items.length
        ? 'Horários vinculados ao seu cadastro. Para remarcar, fale com a equipe.'
        : 'Você está sem horários agendados vinculados ao cadastro.';
      renderContact(true);
    } catch {
      if (activeRequest === controller) message.textContent = 'A consulta está indisponível no momento. Tente atualizar.';
    } finally {
      if (activeRequest === controller) {
        activeRequest = undefined;
        refresh.disabled = false;
      }
    }
  }

  const exitMessage = 'Acesso encerrado. Abra de novo o link da BC para consultar seus horários.';

  function openLink() {
    if (!view.location.hash) return;
    const candidate = new URLSearchParams(view.location.hash.slice(1)).get('acesso');
    view.history.replaceState(view.history.state, '', view.location.pathname + view.location.search);
    closeAccess(unavailable);
    if (!candidate || !/^[a-f0-9]{64}$/.test(candidate)) return;
    token = candidate;
    return loadSchedule();
  }

  exit.addEventListener('click', () => closeAccess(exitMessage));
  refresh.addEventListener('click', loadSchedule);
  view.addEventListener('hashchange', openLink);
  view.addEventListener('pagehide', () => { if (token) closeAccess(exitMessage); });
  renderContact(false);
  return openLink();
}

if (typeof document !== 'undefined') initClientPortal();
