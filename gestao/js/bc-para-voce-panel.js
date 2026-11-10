const labels = new Map([
  ['adesao', 'Em adesão'], ['bronze', 'Bronze'], ['prata', 'Prata'],
  ['ouro', 'Ouro'], ['perola', 'Pérola'], ['diamante', 'Diamante'],
]);
const number = new Intl.NumberFormat('pt-BR');

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

export function renderBCParaVocePointRule() {
  return `<section class="bcg-procedure-editor" data-bc-point-rule aria-label="Regra de Pontos BC">
    <p class="bcg-eyebrow">FIDELIDADE BC PARA VOCÊ</p>
    <p class="bcg-muted">Pontos concedidos por atendimento finalizado a partir desta configuração.</p>
    <button type="button" class="bcg-small-button" data-load-point-rule>Consultar regra de pontos</button>
    <form class="bcg-form" hidden>
      <label>Pontos BC<input class="bcg-input" type="number" name="points" min="0" max="100000" step="1" required></label>
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
