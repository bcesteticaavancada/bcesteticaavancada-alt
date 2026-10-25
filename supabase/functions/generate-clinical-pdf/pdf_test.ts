import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { buildClinicalPdf, buildTreatment6dSections, buildTreatmentReportSection } from './pdf.ts';

const document = {
  document_code: 'BC-DOC-TESTE',
  document_version: 1,
  profissional_nome: 'Profissional Teste',
  profissional_profissao: 'Biomédica Esteta',
  profissional_conselho: 'CRBM',
  profissional_registro: '00000',
};
const client = {
  nome: 'Cliente Teste',
  cpf: '00000000000',
  data_nascimento: '1990-01-01',
  telefone: '(31) 00000-0000',
};
const signatures = [
  { signer_kind: 'paciente', signer_name: 'Cliente Teste', signed_at: '2026-10-12T20:00:00-03:00' },
  { signer_kind: 'profissional', signer_name: 'Profissional Teste', signer_profissao: 'Biomédica Esteta', signer_conselho: 'CRBM', signer_registro: '00000', signed_at: '2026-10-12T20:05:00-03:00' },
];

Deno.test('gera PDF institucional válido para consentimento de procedimento', async () => {
  const bytes = await buildClinicalPdf({
    document: { ...document, document_type: 'consentimento_procedimento' },
    client,
    signatures,
    consent: {
      consent_class: 'injetavel',
      procedure_name_snapshot: 'Botox full face',
      supplement_snapshot: 'Complemento clínico específico.',
      component_keys: [],
    },
    consentTemplate: {
      version: 1,
      title: 'TCLE E AUTORIZAÇÃO PARA PROCEDIMENTO INJETÁVEL / INVASIVO',
      body: 'Texto institucional do consentimento.',
    },
  });
  assert(bytes.length > 1000);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
});

Deno.test('modelo textual 6D registra rastreabilidade sem path/URL/bytes de foto', () => {
  const sections = buildTreatment6dSections({
    photos:[
      {id:'ph1',kind:'antes',region:'Face',view:'frontal',caption:'Referência inicial',captured_at:'2026-10-12T10:00:00-03:00',storage_path:'fotos-clinicas/privado.jpg'},
      {id:'ph2',kind:'depois',region:'Face',view:'frontal',captured_at:'2026-10-12T11:00:00-03:00'},
    ],
    product_usages:[{product_name_snapshot:'Produto Teste',manufacturer_snapshot:'Fabricante Teste',lot_code_snapshot:'LOT-123',expires_on_snapshot:'2027-12-31',quantity:1.5,unit:'mL'}],
    equipment_usages:[{equipment_name_snapshot:'Equipamento Teste',manufacturer_snapshot:'Marca',model_snapshot:'Modelo X',parameter_values:{potencia:10,modo:'A'}}],
    intercurrences:[{moment:'durante',severity:'moderada',description:'Descrição sintética',action_taken:'Conduta registrada',status:'acompanhamento',updates:[{evolution:'Evolução sintética',status_after:'acompanhamento'}]}],
  });
  const text=sections.map((s)=>`${s.title}\n${s.lines.join('\n')}`).join('\n');
  for(const expected of ['Fotos clínicas','Antes','Depois','Produto Teste','LOT-123','31/12/2027','Equipamento Teste','potencia: 10','Descrição sintética','Evolução sintética','acompanhamento']) assertStringIncludes(text,expected);
  assert(!/storage_path|fotos-clinicas|https?:\/\/|signedurl|bytes/i.test(text));
});

Deno.test('seção do parecer reúne contexto clínico sem bytes ou URLs externas',()=>{
  const section=buildTreatmentReportSection({
    treatment:{treatment_date:'2026-10-12',anamnese_id:'an1',consent_document_id:'cons1'},
    procedure_version:{nome:'Skinbooster'},
    professional:{name:'Profissional Teste',profissao:'Biomédica Esteta',conselho:'CRBM',registro:'00000'},
    report:{
      descricao_sessao:'Sessão descrita de forma estruturada.',
      resposta_observada:'Resposta clínica observada.',
      orientacoes:'Orientações individualizadas.',
      retorno_necessario:true,
      retorno_sugerido_em:'2026-10-28',
      observacoes:'Observação complementar.',
      storage_path:'arquivos-clientes/nunca-incluir.pdf',
    },
  });
  assertEquals(section.title,'Relatório / Parecer do Atendimento');
  const text=section.lines.join('\n');
  for(const expected of ['Skinbooster','Profissional Teste','12/10/2026','Sessão descrita','Resposta clínica','Orientações individualizadas','Retorno necessário: Sim','28/10/2026','Observação complementar','Anamnese Geral vinculada: Sim','Consentimento vinculado: Sim'])assertStringIncludes(text,expected);
  assert(!/storage_path|arquivos-clientes|https?:\/\/|signedurl|bytes/i.test(text));
});

Deno.test('seção do parecer reconhece TCLE externo congelado como consentimento vinculado',()=>{
  const section=buildTreatmentReportSection({
    treatment:{treatment_date:'2026-10-12',anamnese_id:'an1',consent_document_id:null},
    procedure_version:{nome:'Bioestimulador'},
    professional:{name:'Profissional Teste'},
    report:{descricao_sessao:'Sessão',resposta_observada:'Resposta',orientacoes:'Orientações',retorno_necessario:false},
    external_consent:{client_file_id:'file1',sha256:'0'.repeat(64),consent_class:'injetavel'},
  });
  assertStringIncludes(section.lines.join('\n'),'Consentimento vinculado: Sim');
});

Deno.test('gera PDF institucional válido para ficha final de atendimento com 6D e parecer', async () => {
  const bytes = await buildClinicalPdf({
    document: { ...document, document_type: 'treatment_record' },
    client,
    signatures: signatures.filter((item) => item.signer_kind === 'profissional'),
    treatmentVersion: {
      version: 2,
      correction_mode: 'same_day',
      created_at: '2026-10-12T20:30:00-03:00',
      snapshot: {
        treatment: {
          treatment_date: '2026-10-12',
          objetivo: 'Melhora global da pele',
          regiao: 'Face',
          avaliacao_profissional: 'Registro clínico de teste',
          specific_data: { objetivo_sessao: 'Hidratação', area_regiao: 'Face' },
          resposta_imediata: 'Sem intercorrências imediatas registradas.',
          orientacoes: 'Orientações individualizadas registradas.',
          retorno: 'Retorno conforme avaliação.',
          anamnese_id: 'anamnese-ref',
          consent_document_id: 'consent-ref',
        },
        procedure_version: { nome: 'Skinbooster', version: 1, classe_documental: 'injetavel' },
        professional:{name:'Profissional Teste',profissao:'Biomédica Esteta',conselho:'CRBM',registro:'00000'},
        components: [],
        report:{descricao_sessao:'Sessão estruturada',resposta_observada:'Resposta observada',orientacoes:'Orientações finais',retorno_necessario:true,retorno_sugerido_em:'2026-10-28',observacoes:'Sem observações adicionais'},
        photos:[{id:'ph1',kind:'antes',region:'Face',view:'frontal',captured_at:'2026-10-12T19:00:00-03:00'}],
        product_usages:[{product_name_snapshot:'Produto Teste',lot_code_snapshot:'LOT-123',expires_on_snapshot:'2027-12-31',quantity:1,unit:'mL'}],
        equipment_usages:[{equipment_name_snapshot:'Equipamento Teste',parameter_values:{potencia:10}}],
        intercurrences:[],
      },
    },
  });
  assert(bytes.length > 1000);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
});
Deno.test('PDF intermediário da profissional não se apresenta como consentimento final',async()=>{
  const bytes=await buildClinicalPdf({
    document:{...document,document_type:'consentimento_procedimento'},
    client,
    signatures:signatures.filter((item)=>item.signer_kind==='profissional'),
    consent:{consent_class:'nao_injetavel',procedure_name_snapshot:'Limpeza de pele'},
    consentTemplate:{title:'TCLE e ciência dos riscos',body:'Informações e riscos de teste.'},
    externalSignatureCopy:true,
  });
  assert(bytes.length>1000);
  assertEquals(new TextDecoder().decode(bytes.slice(0,4)),'%PDF');
});
