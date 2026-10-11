import { registerReceipt, listOwnReceipts } from './finance-receipts-api.js';
import { listOwnBooks } from './finance-books-api.js';
import { listOwnPayouts } from './finance-payouts-api.js';

const MONEY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DATE = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function money(value) { return MONEY.format(Number(value) || 0); }
function date(value) { return value ? DATE.format(new Date(`${value}T12:00:00-03:00`)) : '—'; }
function dateTime(value) { return value ? DATE_TIME.format(new Date(value)) : '—'; }
function status(el, message, kind = '') { if (el) { el.textContent = message || ''; el.dataset.kind = kind; } }

function clinicToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function defaultPeriod() {
  const today = clinicToday();
  const [year, month] = today.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${year}-${String(month).padStart(2,'0')}-01`, end: `${year}-${String(month).padStart(2,'0')}-${String(last).padStart(2,'0')}` };
}

function renderReceipts(rows) {
  if (!rows.length) return '<div class="bcg-empty">Nenhum recebimento no período.</div>';
  return `<div class="bcg-finance-list">${rows.map((r) => `<article class="bcg-finance-row"><div><strong>${money(r.valor)}</strong><span>${escapeHtml(r.forma_pagamento || 'Forma não informada')}</span></div><div><span>${escapeHtml(dateTime(r.recebido_at))}</span><span class="bcg-chip">${escapeHtml(r.status || 'ativo')}</span></div></article>`).join('')}</div>`;
}
function renderBooks(rows) {
  if (!rows.length) return '<div class="bcg-empty">Nenhum livro financeiro no período.</div>';
  return `<div class="bcg-finance-list">${rows.map((r) => `<article class="bcg-finance-row"><div><strong>${date(r.periodo_inicio)} → ${date(r.periodo_fim)}</strong><span>Produção recebida: ${money(r.producao_recebida)}</span></div><div><strong>${money(r.repasse_total)}</strong><span class="bcg-chip">${escapeHtml(r.status)}</span></div></article>`).join('')}</div>`;
}
function renderPayouts(rows) {
  if (!rows.length) return '<div class="bcg-empty">Nenhum repasse no período.</div>';
  return `<div class="bcg-finance-list">${rows.map((r) => `<article class="bcg-finance-row"><div><strong>${money(r.valor_total)}</strong><span>${date(r.periodo_inicio)} → ${date(r.periodo_fim)}</span></div><div><span>${r.pago_at ? `Pago em ${escapeHtml(dateTime(r.pago_at))}` : 'Aguardando baixa'}</span><span class="bcg-chip">${escapeHtml(r.status)}</span></div></article>`).join('')}</div>`;
}

export async function initCollaboratorFinance({ client, profile, root = document, getCurrentAppointment }) {
  if (!client?.rpc || !profile?.user_id || !root || typeof getCurrentAppointment !== 'function') {
    throw new Error('Contexto financeiro inválido.');
  }
  const el = (id) => root.getElementById(id);
  const from = el('collaboratorFinanceFrom');
  const to = el('collaboratorFinanceTo');
  const refreshBtn = el('collaboratorFinanceRefresh');
  const receiptForm = el('currentAppointmentReceiptForm');
  const receiptsEl = el('collaboratorFinanceReceipts');
  const booksEl = el('collaboratorFinanceBooks');
  const payoutsEl = el('collaboratorFinancePayouts');
  const totalReceived = el('collaboratorTotalReceived');
  const totalEarned = el('collaboratorTotalEarned');
  const totalPaid = el('collaboratorTotalPaid');
  const message = el('collaboratorFinanceStatus');
  const receiptMessage = el('currentAppointmentReceiptStatus');
  if (!from || !to || !receiptForm || !receiptsEl || !booksEl || !payoutsEl) {
    throw new Error('Estrutura financeira da colaboradora incompleta.');
  }

  const period = defaultPeriod();
  if (!from.value) from.value = period.start;
  if (!to.value) to.value = period.end;

  async function refreshReceipts() {
    const receipts = await listOwnReceipts({ client, periodoInicio: from.value, periodoFim: to.value });
    receiptsEl.innerHTML = renderReceipts(receipts);
    if (totalReceived) {
      totalReceived.textContent = money(receipts.filter((r) => r.status === 'ativo').reduce((sum, r) => sum + Number(r.valor || 0), 0));
    }
    return receipts;
  }

  async function refresh() {
    status(message, 'Carregando seu financeiro…');
    try {
      const args = { client, periodoInicio: from.value, periodoFim: to.value };
      const [receipts, books, payouts] = await Promise.all([
        refreshReceipts(), listOwnBooks(args), listOwnPayouts(args),
      ]);
      booksEl.innerHTML = renderBooks(books);
      payoutsEl.innerHTML = renderPayouts(payouts);
      if (totalEarned) totalEarned.textContent = money(books.reduce((sum, r) => sum + Number(r.repasse_total || 0), 0));
      if (totalPaid) totalPaid.textContent = money(payouts.filter((r) => r.status === 'pago').reduce((sum, r) => sum + Number(r.valor_total || 0), 0));
      status(message, 'Financeiro atualizado.', 'success');
      return { receipts, books, payouts };
    } catch (error) {
      status(message, error?.message || 'Não foi possível carregar seu financeiro.', 'error');
      throw error;
    }
  }

  receiptForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const appointment = getCurrentAppointment();
    if (!appointment?.id) {
      status(receiptMessage, 'Abra um atendimento da sua agenda antes de registrar o recebimento.', 'error');
      return;
    }
    if (appointment.colaboradora_user_id && appointment.colaboradora_user_id !== profile.user_id) {
      status(receiptMessage, 'Este atendimento não pertence à sua agenda.', 'error');
      return;
    }

    const submit = receiptForm.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await registerReceipt({
        client,
        atendimentoId: appointment.id,
        valor: el('currentAppointmentReceiptValue').value,
        formaPagamento: el('currentAppointmentReceiptMethod').value,
        recebidoAt: el('currentAppointmentReceiptAt').value ? new Date(el('currentAppointmentReceiptAt').value).toISOString() : null,
        observacao: el('currentAppointmentReceiptNote').value,
      });
      receiptForm.reset();
      await refreshReceipts();
      status(receiptMessage, 'Recebimento registrado no atendimento atual.', 'success');
    } catch (error) {
      status(receiptMessage, error?.message || 'Não foi possível registrar o recebimento.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  refreshBtn?.addEventListener('click', refresh);
  from.addEventListener('change', refresh);
  to.addEventListener('change', refresh);
  await refresh();
  return { refresh, refreshReceipts };
}
