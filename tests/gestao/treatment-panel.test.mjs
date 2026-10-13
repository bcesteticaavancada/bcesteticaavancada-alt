import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderTreatmentPanel,
  renderTreatmentHistory,
  renderTreatmentWizard,
  renderTreatmentGateChecklist,
  initTreatmentController,
} from '../../gestao/js/treatment-panel.js';

const procedures = [
  {
    id:'p1', nome:'Limpeza de pele', can_execute:true,
    current_version:{ id:'v1', nome:'Limpeza de pele', classe_documental:'nao_injetavel', protocol_mode:'simple', price_mode:'fixed', base_price:190, specific_schema:{ fields:[{key:'objetivo_sessao',label:'Objetivo desta sessão',type:'textarea',required:true}] } },
  },
  {
    id:'p2', nome:'Fort Hair™', can_execute:true,
    current_version:{ id:'v2', nome:'Fort Hair™', classe_documental:'nao_injetavel', protocol_mode:'compound', price_mode:'fixed', base_price:490, specific_schema:{ component_options:[{key:'led',label:'LED',classe_documental:'nao_injetavel'},{key:'microestimulacao_invasiva',label:'Microestimulação invasiva',classe_documental:'injetavel'}], fields:[] } },
  },
];

test('painel oferece histórico e novo atendimento sem financeiro', () => {
  const html = renderTreatmentPanel({ client:{id:'c1',nome:'Cliente Teste'}, treatments:[], procedures });
  assert.match(html,/Novo atendimento/i);
  assert.match(html,/Histórico de atendimentos/i);
  assert.match(html,/data-treatment-new/);
  assert.doesNotMatch(html,/comiss|repasse|financeiro|recebimento/i);
});

test('histórico mostra sessão formal, profissional e status sem valores', () => {
  const html = renderTreatmentHistory([{
    id:'t1', treatment_date:'2026-10-12', status:'finalizado', profissional_nome:'Alice', procedure_name:'Botox full face', current_version_number:1,
  }]);
  for (const text of ['Botox full face','Alice','Finalizado','v1']) assert.match(html,new RegExp(text,'i'));
  assert.doesNotMatch(html,/R\$|valor|comiss|repasse/i);
});

test('wizard começa por procedimento e suporta walk-in/agendamento', () => {
  const html = renderTreatmentWizard({ step:'procedure', procedures, appointmentId:'a1' });
  assert.match(html,/Procedimento/i);
  assert.match(html,/Agendamento vinculado/i);
  assert.match(html,/Limpeza de pele/i);
  assert.match(html,/Fort Hair™/i);
  assert.match(html,/data-treatment-create/);
});

test('protocolo composto mostra componentes reais e escala documental visualmente', () => {
  const html = renderTreatmentWizard({ step:'procedure', procedures, selectedProcedureId:'p2', selectedComponentKeys:['microestimulacao_invasiva'] });
  assert.match(html,/LED/);
  assert.match(html,/Microestimulação invasiva/);
  assert.match(html,/Injetável \/ invasivo/i);
  assert.match(html,/data-treatment-component/);
});

test('wizard possui etapas saúde, alertas, consentimento, ficha e finalização', () => {
  const treatment={id:'t1',status:'rascunho',procedure_version:{nome:'Limpeza de pele',specific_schema:{fields:[]}},gate_reasons:['anamnese_invalida','consentimento_pendente']};
  const html=renderTreatmentWizard({step:'clinical',treatment,consent:{title:'Termo de Responsabilidade',body:'Texto institucional'}});
  for(const text of ['Saúde hoje','Alertas clínicos','Consentimento','Ficha do atendimento','Finalizar']) assert.match(html,new RegExp(text,'i'));
  assert.match(html,/Texto institucional/);
});

test('checklist traduz gates sem transformar mudança de saúde em contraindicação automática', () => {
  const html=renderTreatmentGateChecklist(['anamnese_invalida','saude_nao_confirmada','alertas_nao_revisados','profissional_nao_autorizada','consentimento_pendente','modulo_especifico_incompleto']);
  for(const text of ['Anamnese','Saúde','Alertas','Profissional','Consentimento','Ficha específica']) assert.match(html,new RegExp(text,'i'));
  assert.doesNotMatch(html,/contraindicado|liberado automaticamente/i);
});

test('controller compartilhado existe para hidratar a pasta',()=>assert.equal(typeof initTreatmentController,'function'));
