import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  bindBCParaVocePointRule,
  bindBCParaVoceSummary,
  renderBCParaVocePointRule,
} from '../../gestao/js/bc-para-voce-panel.js';
import { renderClientFolder } from '../../gestao/js/clientes-folder.js';

const nextTick = () => new Promise(resolve => setImmediate(resolve));

test('resumo interno do BC para Você consulta somente o cadastro aberto', async () => {
  const record = { id: 'cliente-teste', nome: 'Cliente fictícia', ativo: true };
  assert.doesNotMatch(renderClientFolder({ client: record }), /data-bc-para-voce/);
  const { document } = parseHTML(renderClientFolder({ client: record, canSeeBCParaVoce: true }));
  const host = document.querySelector('[data-bc-para-voce]');
  const calls = [];
  bindBCParaVoceSummary(host, {
    async rpc(name, params) {
      calls.push({ name, params });
      return { data: { account_state: 'ativacao_pendente', total_points: 2100, level: 'prata' } };
    },
  }, record.id);
  host.querySelector('button').click();
  await nextTick();
  assert.deepEqual(calls, [{ name: 'bc_para_voce_staff_summary', params: { p_cliente_id: record.id } }]);
  assert.match(host.querySelector('[role=status]').textContent, /Ativação pendente · 2\.100 Pontos BC · Prata/);
});

test('regra de Pontos BC carrega o valor atual antes de editar e salva pelo procedimento aberto', async () => {
  const { document, Event } = parseHTML(renderBCParaVocePointRule());
  const host = document.querySelector('[data-bc-point-rule]');
  const form = host.querySelector('form');
  const input = host.querySelector('input');
  const calls = [];
  form.checkValidity = () => true;
  bindBCParaVocePointRule(host, {
    async rpc(name, params) {
      calls.push({ name, params });
      return { data: name.includes('_get_') ? 100 : 250 };
    },
  }, 'botox-ficticio');
  assert.equal(form.hidden, true);
  host.querySelector('[data-load-point-rule]').click();
  await nextTick();
  assert.equal(form.hidden, false);
  assert.equal(input.value, '100');
  input.valueAsNumber = 250;
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  await nextTick();
  assert.deepEqual(calls, [
    { name: 'bc_para_voce_get_point_rule', params: { p_procedimento_id: 'botox-ficticio' } },
    { name: 'bc_para_voce_set_point_rule', params: { p_procedimento_id: 'botox-ficticio', p_points: 250 } },
  ]);
});
