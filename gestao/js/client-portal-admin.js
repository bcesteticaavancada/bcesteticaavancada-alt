import { formatClinicDateTime } from './agenda-format.js';

export function renderClientPortalControls(active) {
  return `<section class="bcg-client-portal" data-client-portal-controls aria-label="Área do cliente no site">
    <p class="bcg-eyebrow">ÁREA DO CLIENTE NO SITE</p>
    <p class="bcg-muted">${active
      ? 'Confirme a identidade da cliente e compartilhe o link pelo contato já verificado. O acesso vale por 24 horas. Gerar outro link invalida o anterior.'
      : 'Reative o cadastro para gerar um novo link.'}</p>
    ${active ? `<div class="bcg-folder-actions">
      <button type="button" class="bcg-small-button" data-portal-issue>Gerar link de acesso</button>
      <button type="button" class="bcg-small-button" data-portal-revoke>Revogar acesso</button>
    </div>
    <div data-portal-link hidden>
      <input type="text" aria-label="Link individual de acesso" autocomplete="off" spellcheck="false" readonly>
      <button type="button" class="bcg-small-button" data-portal-copy>Copiar link</button>
    </div>
    <p class="bcg-status" role="status" data-portal-admin-status></p>` : ''}
  </section>`;
}

export function bindClientPortalControls({ host, client, clienteId }) {
  const issue = host.querySelector('[data-portal-issue]');
  if (!issue) return;
  const revoke = host.querySelector('[data-portal-revoke]');
  const linkBox = host.querySelector('[data-portal-link]');
  const linkInput = linkBox.querySelector('input');
  const copy = host.querySelector('[data-portal-copy]');
  const status = host.querySelector('[data-portal-admin-status]');
  let busy = false;

  async function changeAccess(issuing) {
    if (busy) return;
    busy = true;
    issue.disabled = revoke.disabled = true;
    linkInput.value = '';
    linkBox.hidden = true;
    status.textContent = issuing ? 'Gerando link…' : 'Revogando acesso…';

    try {
      const rpc = issuing ? 'bc_client_portal_issue' : 'bc_client_portal_revoke';
      const { data, error } = await client.rpc(rpc, { p_cliente_id: clienteId });
      if (error) throw error;
      if (!host.isConnected) return;
      if (issuing) {
        if (!/^[a-f0-9]{64}$/.test(data?.token) || !Number.isFinite(Date.parse(data?.expires_at))) {
          throw new Error('Resposta inválida');
        }
        const url = new URL('../../cliente/', import.meta.url);
        url.hash = 'acesso=' + data.token;
        linkInput.value = url.href;
        linkBox.hidden = false;
        status.textContent = `Link válido até ${formatClinicDateTime(data.expires_at)}.`;
      } else {
        status.textContent = data ? 'Acesso revogado.' : 'Esta cliente está sem link ativo.';
      }
    } catch {
      status.textContent = issuing
        ? 'Não foi possível confirmar a geração do link. Tente gerar outro.'
        : 'Não foi possível confirmar a revogação. Tente novamente.';
    } finally {
      busy = false;
      issue.disabled = revoke.disabled = false;
    }
  }

  issue.addEventListener('click', () => changeAccess(true));
  revoke.addEventListener('click', () => changeAccess(false));
  copy.addEventListener('click', async () => {
    const link = linkInput.value;
    if (!link) return;
    try {
      await host.ownerDocument.defaultView.navigator.clipboard.writeText(link);
      if (linkInput.value === link) status.textContent = 'Link copiado. Compartilhe com a cliente pelo contato verificado.';
    } catch {
      if (linkInput.value !== link) return;
      linkInput.select();
      status.textContent = 'Link selecionado para copiar.';
    }
  });
}
