import { listAuditLog } from './audit-api.js';
import { listStaffDirectory } from './agenda-api.js';
import { formatClinicDateTime } from './agenda-format.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

const ACTION_LABELS = {
  cliente_created: 'Cliente criado',
  cliente_updated: 'Cliente atualizado',
  cliente_archived: 'Cliente arquivado',
  cliente_reactivated: 'Cliente reativado',
  agendamento_created: 'Agendamento criado',
  agendamento_updated: 'Agendamento atualizado',
  agendamento_status_changed: 'Status do agendamento alterado',
  atendimento_created: 'Atendimento registrado',
};

function compactJson(value) {
  if (!value || typeof value !== 'object' || !Object.keys(value).length) return '';
  return escapeHtml(JSON.stringify(value));
}

export function renderAuditLog(entries = [], staffMap = new Map()) {
  if (!entries.length) return '<div class="bcg-empty">Nenhum evento de auditoria encontrado.</div>';
  return `<div class="bcg-audit-list">${entries.map((entry) => {
    const actor = staffMap.get(entry.actor_user_id) || 'Sistema / usuário';
    const action = ACTION_LABELS[entry.action] || entry.action || 'Evento';
    const before = compactJson(entry.old_data);
    const after = compactJson(entry.new_data);
    return `<article class="bcg-audit-entry">
      <header><div><strong>${escapeHtml(action)}</strong><span>${escapeHtml(actor)}</span></div><time>${escapeHtml(formatClinicDateTime(entry.created_at))}</time></header>
      <p><span class="bcg-chip">${escapeHtml(entry.entity_type || 'entidade')}</span> <code>${escapeHtml(entry.entity_id || '')}</code></p>
      ${before ? `<details><summary>Antes</summary><code>${before}</code></details>` : ''}
      ${after ? `<details><summary>Depois</summary><code>${after}</code></details>` : ''}
    </article>`;
  }).join('')}</div>`;
}

function setStatus(el, message, kind = '') {
  if (!el) return;
  el.textContent = message || '';
  el.dataset.kind = kind;
}

export async function initAdminAudit({ client, root = document, staffMap = null }) {
  if (!client || !root) throw new Error('Contexto de auditoria inválido.');
  const el = (id) => root.getElementById(id);
  const type = el('auditEntityType');
  const id = el('auditEntityId');
  const refreshButton = el('auditRefresh');
  const list = el('auditList');
  const status = el('auditStatus');
  if (!type || !id || !refreshButton || !list) throw new Error('Estrutura de auditoria incompleta.');

  let names = staffMap instanceof Map ? staffMap : null;
  if (!names) {
    const staff = await listStaffDirectory({ client });
    names = new Map(staff.map((item) => [item.user_id, item.display_name]));
  }

  async function refresh() {
    setStatus(status, 'Carregando auditoria…');
    try {
      const rows = await listAuditLog({
        client,
        entityType: type.value || null,
        entityId: id.value || null,
      });
      list.innerHTML = renderAuditLog(rows, names);
      setStatus(status, `${rows.length} evento(s) encontrado(s).`, 'success');
      return rows;
    } catch (error) {
      list.innerHTML = '<div class="bcg-empty">Não foi possível carregar a auditoria.</div>';
      setStatus(status, error?.message || 'Erro ao carregar auditoria.', 'error');
      throw error;
    }
  }

  refreshButton.addEventListener('click', refresh);
  type.addEventListener('change', refresh);
  await refresh();
  return { refresh };
}
