import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderTreatment6dCards,
  renderEquipmentParameterFields,
} from '../../gestao/js/treatment-6d-panel.js';

const base={
  id:'t1',cliente_id:'c1',status:'em_atendimento',pending_document_id:null,
  procedure_version:{requires_photo:true,requires_product_lot:true,requires_equipment:true},
  finalization_gate_reasons:['fotos_pendentes','produto_lote_pendente','equipamento_pendente'],
  phase6d_summary:{photos_before:0,photos_after:0,photos_additional:0,product_usages:0,equipment_usages:0,intercurrences:0,open_intercurrences:0},
};

test('renderiza os quatro cards recolhíveis e chips obrigatórios por flag',()=>{
  const html=renderTreatment6dCards({treatment:base,photos:[],products:[],productUsages:[],equipment:[],equipmentUsages:[],intercurrences:[]});
  for(const title of ['Fotos clínicas','Produtos e lotes','Equipamentos','Intercorrências']) assert.match(html,new RegExp(title,'i'));
  assert.equal((html.match(/Obrigatório/g)||[]).length,3);
  assert.match(html,/data-6d-card="photos"/);
  assert.match(html,/data-6d-card="products"/);
  assert.match(html,/data-6d-card="equipment"/);
  assert.match(html,/data-6d-card="intercurrences"/);
  assert.match(html,/fotos_pendentes|Pendente/i);
});

test('sessão com documento pendente/finalizada bloqueia mutações 6D, mas mantém evolução de intercorrência',()=>{
  const treatment={...base,status:'finalizado',pending_document_id:'d1',finalization_gate_reasons:[]};
  const html=renderTreatment6dCards({treatment,photos:[{id:'p1',kind:'antes',storage_path:'private/path.jpg'}],products:[],productUsages:[],equipment:[],equipmentUsages:[],intercurrences:[{id:'i1',status:'acompanhamento',severity:'moderada',description:'Evento',action_taken:'Registro',updates:[]}]});
  assert.match(html,/Somente leitura|finaliz/i);
  assert.doesNotMatch(html,/data-6d-photo-submit/);
  assert.doesNotMatch(html,/data-6d-product-submit/);
  assert.doesNotMatch(html,/data-6d-equipment-submit/);
  assert.doesNotMatch(html,/data-6d-intercurrence-create/);
  assert.match(html,/data-6d-intercurrence-evolution/);
});

test('foto privada só carrega por marcador de path para URL assinada sob demanda',()=>{
  const html=renderTreatment6dCards({treatment:base,photos:[{id:'p1',kind:'antes',storage_path:'fotos-clinicas/c1/t1/p.jpg',region:'face',view:'frontal'}],products:[],productUsages:[],equipment:[],equipmentUsages:[],intercurrences:[]});
  assert.match(html,/data-6d-photo-path="fotos-clinicas\/c1\/t1\/p\.jpg"/);
  assert.doesNotMatch(html,/getPublicUrl|publicUrl|https?:\/\//i);
});

test('parâmetros de equipamento respeitam schema number/text/select/boolean',()=>{
  const html=renderEquipmentParameterFields({fields:[
    {key:'power',label:'Potência',type:'number',required:true,unit:'W',min:1,max:20,step:1},
    {key:'mode',label:'Modo',type:'select',options:['A','B']},
    {key:'note',label:'Observação',type:'text'},
    {key:'pulse',label:'Pulsado',type:'boolean'},
  ]});
  assert.match(html,/name="parameter\.power"[^>]*type="number"/);
  assert.match(html,/name="parameter\.mode"/);
  assert.match(html,/<option value="A">A<\/option>/);
  assert.match(html,/name="parameter\.note"/);
  assert.match(html,/name="parameter\.pulse"[^>]*type="checkbox"/);
});

test('intercorrência aberta oferece confirmação explícita para finalizar',()=>{
  const treatment={...base,finalization_gate_reasons:['intercorrencia_aberta_nao_confirmada'],phase6d_summary:{...base.phase6d_summary,open_intercurrences:1}};
  const html=renderTreatment6dCards({treatment,photos:[],products:[],productUsages:[],equipment:[],equipmentUsages:[],intercurrences:[{id:'i1',status:'aberta',severity:'leve',description:'Evento',action_taken:'Registro',updates:[]}]});
  assert.match(html,/data-6d-confirm-open-intercurrences/);
  assert.match(html,/acompanhamento pendente|confirmar/i);
});
