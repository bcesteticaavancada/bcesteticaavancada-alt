import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  bindBCParaVocePointRule,
  bindBCParaVoceSummary,
  renderBCParaVocePointRule,
  renderBCParaVocePointsScale,
} from '../../gestao/js/bc-para-voce-panel.js';
import { BC_LEVELS, rankBCProcedures, suggestBCPoints } from '../../gestao/js/bc-para-voce-scoring.js';
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

test('escala proporcional só sugere pontos para preços-base positivos', () => {
  assert.equal(suggestBCPoints({ base_price: 190 }).points, 190);
  assert.deepEqual(suggestBCPoints({ base_price: '990.50', price_mode: 'starting_at' }), {
    price: 990.5, points: 991, isStartingAt: true,
  });
  for (const price of [null, '', 0, -10, 'não definido', 100001]) {
    assert.equal(suggestBCPoints({ base_price: price }), null);
  }
  assert.deepEqual(BC_LEVELS.map((item) => item.threshold), [0, 1000, 2000, 4000, 6000, 10000]);
});

test('tabela administrativa ordena do mais barato ao mais caro e sinaliza a partir de', () => {
  const procedures = [
    { id: 'caro', nome: 'Face Reset™', current_version: { base_price: 2990 } },
    { id: 'nao', nome: '<Sem preço>', current_version: { base_price: null } },
    { id: 'medio', nome: 'Peeling', current_version: { base_price: 195, price_mode: 'starting_at' } },
    { id: 'barato', nome: 'Vasinhos', current_version: { base_price: 180 } },
    { id: 'arquivado', nome: 'Antigo', archived_at: '2026-01-01', current_version: { base_price: 100 } },
  ];
  assert.deepEqual(rankBCProcedures(procedures).map((item) => item.id), ['barato', 'medio', 'caro', 'nao']);
  const html = renderBCParaVocePointsScale(procedures);
  assert.match(html, /180 pts/);
  assert.match(html, /195 pts \(referência\)/);
  assert.match(html, /A partir de R\$\s*195,00/);
  assert.match(html, /Revisão manual/);
  assert.doesNotMatch(html, /<Sem preço>/);
  assert.doesNotMatch(html, /Antigo/);
  assert.match(html, /Nenhum ponto desta tabela é ativado automaticamente/);
});

test('sugestão no editor exige consulta prévia e salvamento explícito', async () => {
  const { document, Event } = parseHTML(renderBCParaVocePointRule({ base_price: 1390 }));
  const host = document.querySelector('[data-bc-point-rule]');
  const input = host.querySelector('input[name=points]');
  const suggestButton = host.querySelector('[data-suggest-point-rule]');
  const calls = [];
  host.querySelector('form').checkValidity = () => true;
  bindBCParaVocePointRule(host, {
    async rpc(name, params) {
      calls.push({ name, params });
      return { data: name.includes('_get_') ? 0 : 1390 };
    },
  }, 'procedimento-ficticio');
  suggestButton.click();
  assert.equal(input.value, '');
  host.querySelector('[data-load-point-rule]').click();
  await nextTick();
  assert.equal(input.value, '0');
  suggestButton.click();
  assert.equal(input.value, '1390');
  assert.equal(calls.length, 1);
  input.valueAsNumber = 1390;
  host.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await nextTick();
  assert.deepEqual(calls.map((call) => call.name), ['bc_para_voce_get_point_rule', 'bc_para_voce_set_point_rule']);
});
