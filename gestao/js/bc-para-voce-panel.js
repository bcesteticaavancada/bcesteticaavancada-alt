import { BC_LEVELS, rankBCProcedures, suggestBCPoints } from './bc-para-voce-scoring.js';

const labels = new Map(BC_LEVELS.map((level) => [level.key, level.name]));
const number = new Intl.NumberFormat('pt-BR');
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderBCParaVocePointsScale(procedures = []) {
  const rows = rankBCProcedures(procedures);
  return `<section class="bcg-procedure-admin bcg-points-scale" data-bc-points-scale aria-label="Escala de Pontos BC">
    <p class="bcg-eyebrow">BC PARA VOCÊ · PROPOSTA DE FIDELIDADE</p>
    <h3>Escala por valor, do menor ao maior</h3>
    <p class="bcg-muted">Sugestão: 1 Ponto BC para cada R$ 1 de valor-base. Nenhum ponto desta tabela é ativado automaticamente. A administradora precisa revisar e salvar a regra de cada procedimento.</p>
    <div class="bcg-points-table-wrap"><table class="bcg-points-table"><thead><tr><th scope="col">Procedimento</th><th scope="col">Valor-base</th><th scope="col">Pontos sugeridos</th><th scope="col">Ação</th></tr></thead><tbody>${rows.map((item) => {
      const suggestion = item.suggestion;
      const price = suggestion ? `${suggestion.isStartingAt ? 'A partir de ' : ''}${currency.format(suggestion.price)}` : 'A definir';
      const points = suggestion ? `${number.format(suggestion.points)} pts${suggestion.isStartingAt ? ' (referência)' : ''}` : 'Revisão manual';
      return `<tr><th scope="row">${escapeHtml(item.name)}</th><td>${escapeHtml(price)}</td><td>${escapeHtml(points)}</td><td><button type="button" class="bcg-small-button" data-procedure-edit="${escapeHtml(item.id)}">Revisar</button></td></tr>`;
    }).join('')}</tbody></table></div>
    <p class="bcg-muted">Nos serviços “a partir de”, a pontuação usa somente o valor mínimo como referência. Sem preço definido ou sem cobrança, não há sugestão.</p>
    <h3>Níveis por pontos acumulados</h3>
    <div class="bcg-points-levels">${BC_LEVELS.map((level) => `<span><strong>${level.name}</strong> · ${number.format(level.threshold)} pts</span>`).join('')}</div>
    <p class="bcg-muted">O saldo acumula por atendimento concluído; resgatar um benefício não reduz o nível. Vouchers e regras comerciais dependem de aprovação da clínica.</p>
  </section>`;
}

export function renderBCParaVoceSummary() {
  return `<section class="bcg-client-portal" data-bc-para-voce aria-label="BC para Você">
    <p class="bcg-eyebrow">BC PARA VOCÊ</p>
    <p class="bcg-muted">Acompanhe o cadastro espelho e os Pontos BC desta cliente.</p>
    <div class="bcg-folder-actions"><button class="bcg-small-button" type="button">Consultar BC para Você</button></div>
    <p class="bcg-status" role="status"></p>
  </section>`;
}

export function bindBCParaVoceSummary(host, client, clienteId) {
  const button = host.querySelector('button');
  const status = host.querySelector('[role="status"]');
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = 'Consultando…';
    try {
      const { data, error } = await client.rpc('bc_para_voce_staff_summary', { p_cliente_id: clienteId });
      if (error) throw error;
      const level = labels.get(data?.level);
      const points = data?.total_points;
      if (!level || !Number.isSafeInteger(points) || points < 0) throw new Error('Resumo indisponível');
      const account = data.account_state === 'arquivado' ? 'Cadastro arquivado' : 'Ativação pendente';
      status.textContent = `${account} · ${number.format(points)} Pontos BC · ${level}`;
    } catch {
      status.textContent = 'Não foi possível consultar o BC para Você.';
    } finally {
      button.disabled = false;
    }
  });
}

export function renderBCParaVocePointRule(version = {}) {
  const suggested = suggestBCPoints(version);
  return `<section class="bcg-procedure-editor" data-bc-point-rule aria-label="Regra de Pontos BC">
    <p class="bcg-eyebrow">FIDELIDADE BC PARA VOCÊ</p>
    <p class="bcg-muted">Pontos concedidos por atendimento finalizado a partir desta configuração.</p>
    <button type="button" class="bcg-small-button" data-load-point-rule>Consultar regra de pontos</button>
    <form class="bcg-form" hidden>
      <label>Pontos BC<input class="bcg-input" type="number" name="points" min="0" max="100000" step="1" required></label>
      ${suggested ? `<p class="bcg-muted">Sugestão pela tabela: ${number.format(suggested.points)} pontos para ${suggested.isStartingAt ? 'valor a partir de ' : ''}${currency.format(suggested.price)}.${suggested.isStartingAt ? ' Confirme o valor de referência antes de aprovar.' : ''}</p>
      <button type="button" class="bcg-small-button" data-suggest-point-rule="${suggested.points}">Preencher sugestão</button>` : '<p class="bcg-muted">Sem preço-base positivo: defina a pontuação manualmente ou mantenha zero.</p>'}
      <p class="bcg-muted">Use 0 para encerrar a concessão futura.</p>
      <button type="submit" class="bcg-small-button">Salvar Pontos BC</button>
    </form>
    <p class="bcg-status" role="status"></p>
  </section>`;
}

export function bindBCParaVocePointRule(host, client, procedureId) {
  const load = host.querySelector('[data-load-point-rule]');
  const status = host.querySelector('[role="status"]');
  const form = host.querySelector('form');
  const input = form.querySelector('input');
  const submit = form.querySelector('[type="submit"]');
  const suggest = form.querySelector('[data-suggest-point-rule]');
  const args = { p_procedimento_id: procedureId };

  load.addEventListener('click', async () => {
    if (load.disabled) return;
    load.disabled = true;
    status.textContent = 'Consultando regra…';
    try {
      const { data, error } = await client.rpc('bc_para_voce_get_point_rule', args);
      if (error || !Number.isInteger(data) || data < 0 || data > 100000) throw new Error('Regra indisponível');
      input.value = data;
      load.hidden = true;
      form.hidden = false;
      status.textContent = '';
    } catch {
      status.textContent = 'Não foi possível consultar a regra de pontos.';
    } finally {
      load.disabled = false;
    }
  });

  suggest?.addEventListener('click', () => {
    if (form.hidden || submit.disabled) return;
    // O valor sugerido é exibido na própria tela, sem envio ao banco até salvar.
    input.value = suggest.dataset.suggestPointRule;
    status.textContent = 'Sugestão preenchida. Revise e clique em Salvar Pontos BC para aplicar.';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled || !form.checkValidity()) return;
    const points = input.valueAsNumber;
    submit.disabled = input.disabled = true;
    status.textContent = 'Salvando pontos…';
    try {
      const { error } = await client.rpc('bc_para_voce_set_point_rule', { ...args, p_points: points });
      if (error) throw error;
      status.textContent = 'Regra de Pontos BC salva para os próximos atendimentos finalizados.';
    } catch {
      status.textContent = 'Não foi possível salvar a regra de pontos.';
    } finally {
      submit.disabled = input.disabled = false;
    }
  });
}
