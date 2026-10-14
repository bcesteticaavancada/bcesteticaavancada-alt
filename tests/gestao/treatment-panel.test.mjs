import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  renderTreatmentPanel,
  renderTreatmentHistory,
  renderTreatmentWizard,
  renderTreatmentGateChecklist,
  initTreatmentController,
} from '../../gestao/js/treatment-panel.js';

const sourceUrl=new URL('../../gestao/js/treatment-panel.js',import.meta.url);
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

const baseTreatment={
  id:'t1',cliente_id:'c1',status:'em_atendimento',procedure_version:{nome:'Limpeza de pele',specific_schema:{fields:[]},requires_photo:false,requires_product_lot:false,requires_equipment:false},gate_reasons:[],finalization_gate_reasons:['parecer_pendente'],phase6d_summary:{},
};

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

test('wizard possui etapas 6C e cards 6D dentro da mesma sessão', () => {
  const treatment={id:'t1',cliente_id:'c1',status:'rascunho',procedure_version:{nome:'Limpeza de pele',specific_schema:{fields:[]},requires_photo:true,requires_product_lot:false,requires_equipment:false},gate_reasons:['anamnese_invalida','consentimento_pendente'],finalization_gate_reasons:['fotos_pendentes'],phase6d_summary:{}};
  const html=renderTreatmentWizard({step:'clinical',treatment,consent:{document_id:'d1',title:'Termo de Responsabilidade',body:'Texto institucional',procedure_name:'Limpeza de pele',status:'rascunho'}});
  for(const text of ['Saúde hoje','Alertas clínicos','Consentimento','Ficha do atendimento','Fotos clínicas','Produtos e lotes','Equipamentos','Intercorrências','Finalizar']) assert.match(html,new RegExp(text,'i'));
  assert.match(html,/data-treatment-6d-slot/);
  assert.match(html,/Texto institucional/);
});

test('TCLE externo selecionado na pasta aparece para revisão no atendimento',()=>{
  const treatment={...baseTreatment,status:'rascunho',gate_reasons:['consentimento_pendente'],finalization_gate_reasons:[]};
  const html=renderTreatmentWizard({
    step:'clinical',treatment,consent:null,
    pendingExternalConsent:{fileId:'f1',title:'TCLE GOV.BR assinado'},
  });
  assert.match(html,/TCLE externo para revisar/i);
  assert.match(html,/TCLE GOV\.BR assinado/i);
  assert.match(html,/data-treatment-external-consent-link=["']f1["']/);
  assert.match(html,/Revisar e vincular/i);
});

test('TCLE externo já revisado satisfaz a etapa visual sem pedir assinatura interna',()=>{
  const treatment={...baseTreatment,status:'rascunho',gate_reasons:[],finalization_gate_reasons:[]};
  const html=renderTreatmentWizard({
    step:'clinical',treatment,consent:null,
    externalConsent:{client_file_id:'f1',file_title:'TCLE GOV.BR assinado',consent_class:'nao_injetavel',reviewed_at:'2026-10-14T12:00:00Z'},
  });
  assert.match(html,/TCLE externo revisado/i);
  assert.match(html,/TCLE GOV\.BR assinado/i);
  assert.doesNotMatch(html,/data-treatment-consent-prepare/);
  assert.doesNotMatch(html,/data-treatment-signature-canvas=["']subject["']/);
});

test('controller carrega e confirma TCLE externo usando a seleção transitória da pasta',async()=>{
  const source=await readFile(sourceUrl,'utf8');
  assert.match(source,/getExternalConsent/);
  assert.match(source,/linkExternalConsent/);
  assert.match(source,/__bcPendingExternalConsent/);
  assert.match(source,/data-treatment-external-consent-link/);
  assert.match(source,/delete\s+folder\(\)\.__bcPendingExternalConsent|folder\(\)\.__bcPendingExternalConsent\s*=\s*null/);
});

test('parecer estruturado aparece no atendimento em curso com campos aprovados',()=>{
  const html=renderTreatmentWizard({step:'clinical',treatment:baseTreatment,report:null});
  assert.match(html,/Relatório \/ Parecer do Atendimento/i);
  assert.match(html,/data-treatment-report-form/);
  for(const name of ['descricao_sessao','resposta_observada','orientacoes','retorno_necessario','retorno_sugerido_em','observacoes']){
    assert.match(html,new RegExp(`name=["']${name}["']`));
  }
  assert.match(html,/Salvar parecer/i);
});

test('parecer pendente bloqueia visualmente a preparação da finalização',()=>{
  const html=renderTreatmentWizard({step:'clinical',treatment:baseTreatment,report:null});
  assert.match(html,/Parecer clínico pendente/i);
  assert.match(html,/data-finalization-gate=["']parecer_pendente["']/);
  assert.match(html,/data-treatment-finalize[^>]*disabled|disabled[^>]*data-treatment-finalize/i);
});

test('parecer congelado fica somente leitura após finalização',()=>{
  const report={descricao_sessao:'Sessão registrada',resposta_observada:'Resposta registrada',orientacoes:'Orientações registradas',retorno_necessario:true,retorno_sugerido_em:'2026-10-28',observacoes:'Observação final'};
  const treatment={...baseTreatment,status:'finalizado',finalization_gate_reasons:[]};
  const html=renderTreatmentWizard({step:'clinical',treatment,report});
  assert.match(html,/data-treatment-report-form[^>]*data-readonly=["']true["']/);
  for(const text of ['Sessão registrada','Resposta registrada','Orientações registradas','28\/10\/2026','Observação final'])assert.match(html,new RegExp(text,'i'));
  assert.doesNotMatch(html,/>Salvar parecer</i);
});

test('controller carrega e salva parecer pela API dedicada',async()=>{
  const source=await readFile(sourceUrl,'utf8');
  assert.match(source,/from ['"]\.\/treatment-report-api\.js['"]/);
  assert.match(source,/getTreatmentReport/);
  assert.match(source,/saveTreatmentReport/);
  assert.match(source,/data-treatment-report-form/);
});

test('checklist de início traduz apenas gates 6C sem exigir dados do fim da sessão', () => {
  const html=renderTreatmentGateChecklist(['anamnese_invalida','saude_nao_confirmada','alertas_nao_revisados','profissional_nao_autorizada','consentimento_pendente','modulo_especifico_incompleto']);
  for(const text of ['Anamnese','Saúde','Alertas','Profissional','Consentimento','Ficha específica']) assert.match(html,new RegExp(text,'i'));
  assert.doesNotMatch(html,/Fotos clínicas|Produtos e lotes|Equipamentos|intercorrencia_aberta|contraindicado|liberado automaticamente/i);
});

test('controller compartilhado existe para hidratar a pasta',()=>assert.equal(typeof initTreatmentController,'function'));
