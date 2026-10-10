import { listActiveProcedures } from './agenda-api.js';
import { listAdminReceipts, reverseReceipt } from './finance-receipts-api.js';
import { listAdminCommissions, setCommission, listAdminBooks, closeBook, reopenBook, recalculateBooks } from './finance-books-api.js';
import { listAdminPayouts, setPayoutCycle, createPayout, settlePayout, reversePayout } from './finance-payouts-api.js';

const MONEY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function money(value) { return MONEY.format(Number(value) || 0); }
function setStatus(el, message, kind = '') { if (el) { el.textContent = message || ''; el.dataset.kind = kind; } }
function option(label, value) { return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`; }
function currentMonth() {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth() + 1; const last = new Date(y, m, 0).getDate();
  return { start: `${y}-${String(m).padStart(2,'0')}-01`, end: `${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}` };
}
function aggregateBooks(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.livro_id)) map.set(row.livro_id, { ...row, items: [] });
    if (row.item_id) map.get(row.livro_id).items.push(row);
  }
  return [...map.values()];
}

export async function initAdminFinance({ client, profile, root = document, staffMap }) {
  if (!client?.rpc || !root || profile?.role !== 'admin' || !(staffMap instanceof Map)) {
    throw new Error('Contexto financeiro administrativo inválido.');
  }
  const el = (id) => root.getElementById(id);
  const professional = el('adminFinanceProfessional');
  const from = el('adminFinanceFrom');
  const to = el('adminFinanceTo');
  const refreshButton = el('adminFinanceRefresh');
  const message = el('adminFinanceStatus');
  if (!professional || !from || !to) throw new Error('Estrutura financeira administrativa incompleta.');

  const period = currentMonth(); if (!from.value) from.value = period.start; if (!to.value) to.value = period.end;
  let procedureMap = new Map(); let bookRows = [];
  const staff = [...staffMap.entries()].map(([user_id, display_name]) => ({ user_id, display_name }));

  function populateLookups(procedures) {
    procedureMap = new Map(procedures.map((item) => [item.id, item.nome]));
    for (const select of root.querySelectorAll('[data-finance-professional]')) {
      const keepBlank = select.id === 'adminFinanceProfessional';
      select.innerHTML = `${keepBlank ? '<option value="">Todas as profissionais</option>' : '<option value="">Selecione</option>'}${staff.map((item) => option(item.display_name, item.user_id)).join('')}`;
    }
    for (const select of root.querySelectorAll('[data-finance-procedure]')) {
      select.innerHTML = '<option value="">Selecione</option>' + procedures.map((item) => option(item.nome, item.id)).join('');
    }
  }

  function renderReceipts(rows) {
    const target = el('adminFinanceReceipts');
    if (!rows.length) { target.innerHTML = '<div class="bcg-empty">Nenhum recebimento no período.</div>'; return; }
    target.innerHTML = `<div class="bcg-finance-list">${rows.map((r) => `<article class="bcg-finance-row"><div><strong>${money(r.valor)}</strong><span>${escapeHtml(staffMap.get(r.profissional_user_id) || 'Profissional')} • ${escapeHtml(procedureMap.get(r.procedimento_id) || 'Procedimento')}</span></div><div><span class="bcg-chip">${escapeHtml(r.status)}</span>${r.status === 'ativo' ? `<button class="bcg-small-button" type="button" data-reverse-receipt="${escapeHtml(r.id)}">Estornar</button>` : ''}</div></article>`).join('')}</div>`;
  }

  function renderCommissions(rows) {
    const target = el('adminFinanceCommissions');
    if (!rows.length) { target.innerHTML = '<div class="bcg-empty">Nenhuma comissão configurada.</div>'; return; }
    target.innerHTML = `<div class="bcg-finance-list">${rows.filter((r) => r.ativo).map((r) => `<article class="bcg-finance-row"><div><strong>${escapeHtml(staffMap.get(r.profissional_user_id) || 'Profissional')}</strong><span>${escapeHtml(procedureMap.get(r.procedimento_id) || 'Procedimento')}</span></div><strong>${Number(r.percentual).toLocaleString('pt-BR')}%</strong></article>`).join('')}</div>`;
  }

  function renderBooks(rows) {
    const target = el('adminFinanceBooks');
    bookRows = aggregateBooks(rows);
    if (!bookRows.length) { target.innerHTML = '<div class="bcg-empty">Nenhum livro no período.</div>'; }
    else target.innerHTML = `<div class="bcg-finance-list">${bookRows.map((b) => `<article class="bcg-finance-row"><div><strong>${escapeHtml(staffMap.get(b.profissional_user_id) || 'Profissional')} • ${escapeHtml(b.periodo_inicio)} → ${escapeHtml(b.periodo_fim)}</strong><span>Produção: ${money(b.producao_recebida)} • Repasse: ${money(b.repasse_total)} • ${b.items.length} movimento(s)</span></div><div><span class="bcg-chip">${escapeHtml(b.status)}</span>${b.status === 'fechado' ? `<button class="bcg-small-button" data-reopen-book="${escapeHtml(b.livro_id)}" type="button">Reabrir</button>` : ''}</div></article>`).join('')}</div>`;

    const payoutBooks = el('adminPayoutBooks');
    if (payoutBooks) {
      const eligible = bookRows.filter((b) => b.status === 'fechado');
      payoutBooks.innerHTML = eligible.length ? eligible.map((b) => `<label class="bcg-check-row"><input type="checkbox" name="livro_id" value="${escapeHtml(b.livro_id)}"> <span>${escapeHtml(staffMap.get(b.profissional_user_id) || 'Profissional')} • ${escapeHtml(b.periodo_inicio)} → ${escapeHtml(b.periodo_fim)} • ${money(b.repasse_total)}</span></label>`).join('') : '<div class="bcg-empty">Nenhum livro fechado disponível no filtro atual.</div>';
    }
  }

  function renderPayouts(rows) {
    const target = el('adminFinancePayouts');
    if (!rows.length) { target.innerHTML = '<div class="bcg-empty">Nenhum repasse no período.</div>'; return; }
    target.innerHTML = `<div class="bcg-finance-list">${rows.map((r) => `<article class="bcg-finance-row"><div><strong>${money(r.valor_total)} • ${escapeHtml(staffMap.get(r.profissional_user_id) || 'Profissional')}</strong><span>${escapeHtml(r.periodo_inicio)} → ${escapeHtml(r.periodo_fim)}</span></div><div><span class="bcg-chip">${escapeHtml(r.status)}</span>${r.status === 'aberto' ? `<button class="bcg-small-button" data-settle-payout="${escapeHtml(r.id)}" type="button">Baixar</button>` : ''}${r.status !== 'estornado' ? `<button class="bcg-small-button" data-reverse-payout="${escapeHtml(r.id)}" type="button">Estornar</button>` : ''}</div></article>`).join('')}</div>`;
  }

  async function refresh() {
    setStatus(message, 'Carregando financeiro…');
    const args = { client, profissionalUserId: professional.value || null, periodoInicio: from.value || null, periodoFim: to.value || null };
    try {
      const [receipts, commissions, books, payouts] = await Promise.all([
        listAdminReceipts(args), listAdminCommissions({ client, profissionalUserId: professional.value || null }), listAdminBooks(args), listAdminPayouts(args),
      ]);
      renderReceipts(receipts); renderCommissions(commissions); renderBooks(books); renderPayouts(payouts);
      const total = receipts.filter((r) => r.status === 'ativo').reduce((sum, r) => sum + Number(r.valor || 0), 0);
      const pending = payouts.filter((r) => r.status === 'aberto').reduce((sum, r) => sum + Number(r.valor_total || 0), 0);
      if (el('adminFinanceTotalReceived')) el('adminFinanceTotalReceived').textContent = money(total);
      if (el('adminFinanceTotalPending')) el('adminFinanceTotalPending').textContent = money(pending);
      setStatus(message, 'Financeiro atualizado.', 'success');
      return { receipts, commissions, books, payouts };
    } catch (error) { setStatus(message, error?.message || 'Erro ao carregar financeiro.', 'error'); throw error; }
  }

  el('adminCommissionForm')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    try { await setCommission({ client, profissionalUserId: form.profissional.value, procedimentoId: form.procedimento.value, percentual: form.percentual.value }); await refresh(); setStatus(message, 'Comissão atualizada.', 'success'); }
    catch (error) { setStatus(message, error?.message || 'Erro ao atualizar comissão.', 'error'); }
  });

  el('adminBookCloseForm')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    try { await closeBook({ client, profissionalUserId: form.profissional.value, periodoInicio: form.inicio.value, periodoFim: form.fim.value }); await refresh(); setStatus(message, 'Livro fechado.', 'success'); }
    catch (error) { setStatus(message, error?.message || 'Erro ao fechar livro.', 'error'); }
  });

  el('adminBookRecalcForm')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    try { await recalculateBooks({ client, profissionalUserId: form.profissional.value, procedimentoId: form.procedimento.value || null, periodoInicio: form.inicio.value, periodoFim: form.fim.value }); await refresh(); setStatus(message, 'Livros recalculados.', 'success'); }
    catch (error) { setStatus(message, error?.message || 'Erro ao recalcular livros.', 'error'); }
  });

  el('adminPayoutCycleForm')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    try { await setPayoutCycle({ client, profissionalUserId: form.profissional.value, cicloDias: form.ciclo.value }); setStatus(message, 'Ciclo de repasse atualizado.', 'success'); }
    catch (error) { setStatus(message, error?.message || 'Erro ao configurar ciclo.', 'error'); }
  });

  el('adminPayoutCreateForm')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    const ids = [...form.querySelectorAll('input[name="livro_id"]:checked')].map((input) => input.value);
    try { await createPayout({ client, profissionalUserId: form.profissional.value, livroIds: ids, observacao: form.observacao.value }); await refresh(); setStatus(message, 'Repasse criado.', 'success'); }
    catch (error) { setStatus(message, error?.message || 'Erro ao criar repasse.', 'error'); }
  });

  el('adminFinanceReceipts')?.addEventListener('click', async (event) => {
    const button = event.target.closest?.('[data-reverse-receipt]'); if (!button) return;
    const motivo = globalThis.prompt?.('Motivo do estorno do recebimento:') || ''; if (!motivo.trim()) return;
    try { await reverseReceipt({ client, recebimentoId: button.dataset.reverseReceipt, motivo }); await refresh(); }
    catch (error) { setStatus(message, error?.message || 'Erro ao estornar recebimento.', 'error'); }
  });

  el('adminFinanceBooks')?.addEventListener('click', async (event) => {
    const button = event.target.closest?.('[data-reopen-book]'); if (!button) return;
    const motivo = globalThis.prompt?.('Motivo da revisão do livro:') || ''; if (!motivo.trim()) return;
    try { await reopenBook({ client, livroId: button.dataset.reopenBook, motivo }); await refresh(); }
    catch (error) { setStatus(message, error?.message || 'Erro ao reabrir livro.', 'error'); }
  });

  el('adminFinancePayouts')?.addEventListener('click', async (event) => {
    const settle = event.target.closest?.('[data-settle-payout]');
    const reverse = event.target.closest?.('[data-reverse-payout]');
    try {
      if (settle) await settlePayout({ client, repasseId: settle.dataset.settlePayout });
      if (reverse) { const motivo = globalThis.prompt?.('Motivo do estorno do repasse:') || ''; if (!motivo.trim()) return; await reversePayout({ client, repasseId: reverse.dataset.reversePayout, motivo }); }
      if (settle || reverse) await refresh();
    } catch (error) { setStatus(message, error?.message || 'Erro ao atualizar repasse.', 'error'); }
  });

  refreshButton?.addEventListener('click', refresh); professional.addEventListener('change', refresh); from.addEventListener('change', refresh); to.addEventListener('change', refresh);
  const procedures = await listActiveProcedures({ client });
  populateLookups(procedures);
  await refresh();
  return { refresh };
}
