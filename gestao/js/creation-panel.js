function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;').replaceAll("'",'&#039;');}

export const CREATION_SECTIONS=Object.freeze({
  agenda:'Agenda geral',clientes:'Clientes',equipe:'Equipe',procedimentos:'Procedimentos',
  atendimentos:'Atendimentos clínicos',anamneses:'Anamneses',preanamneses:'Pré-anamneses',
  documentos:'Documentos',alertas:'Alertas clínicos',produtos:'Produtos',lotes:'Lotes',
  equipamentos:'Equipamentos',disponibilidade:'Disponibilidade das agendas',bloqueios:'Bloqueios das agendas',
  intercorrencias:'Intercorrências',auditoria:'Eventos da operação',
});
const LABELS={
  id:'Identificador',user_id:'Identificador da conta',cliente_id:'Identificador do cliente',nome:'Nome',name:'Nome',
  cliente:'Cliente',profissional:'Profissional',procedimento:'Procedimento',produto:'Produto',responsavel:'Responsável',
  display_name:'Nome',role:'Perfil',active:'Ativo',ativo:'Ativo',atende_clientes:'Atende clientes',
  profissao:'Profissão',conselho:'Conselho',registro_conselho:'Registro profissional',
  pode_gerenciar_agendas:'Gerencia agendas',pode_gerenciar_procedimentos:'Gerencia procedimentos',procedure_scope:'Escopo dos procedimentos',
  telefone:'Telefone',email:'E-mail',cpf:'CPF',data_nascimento:'Nascimento',cep:'CEP',logradouro:'Logradouro',numero:'Número',
  complemento:'Complemento',bairro:'Bairro',cidade:'Cidade',uf:'UF',responsavel_nome:'Responsável legal',responsavel_cpf:'CPF do responsável',responsavel_parentesco:'Vínculo do responsável',responsavel_telefone:'Telefone do responsável',
  inicio:'Início',fim:'Fim',status:'Situação',origem:'Origem',public_booking_name:'Nome informado na reserva',public_booking_phone:'Telefone informado na reserva',
  duracao_padrao:'Duração padrão (min)',access_mode:'Acesso ao procedimento',versao:'Versão',categoria:'Categoria',descricao:'Descrição',
  orientacoes_antes:'Orientações antes',orientacoes_depois:'Orientações depois',exige_anamnese:'Exige anamnese',exige_foto:'Exige foto',exige_lote:'Exige lote',exige_equipamento:'Exige equipamento',
  treatment_date:'Data do atendimento',queixa_dia:'Queixa do dia',objetivo:'Objetivo',avaliacao_profissional:'Avaliação profissional',regiao:'Região',
  resposta_imediata:'Resposta imediata',intercorrencias_ato:'Intercorrências no ato',orientacoes:'Orientações',retorno:'Retorno',evolucao:'Evolução',feedback:'Feedback',observacoes:'Observações',started_at:'Iniciado em',finalized_at:'Finalizado em',
  version:'Versão',source:'Origem',reviewed_at:'Revisado em',valid_until:'Válida até',created_at:'Criado em',
  patient_name:'Cliente',patient_phone:'Telefone',procedure:'Procedimento',document_type:'Tipo de documento',document_code:'Código do documento',document_version:'Versão do documento',profissional_nome:'Profissional',generated_at:'Gerado em',
  level:'Nível',origin_type:'Origem',description:'Descrição',manufacturer:'Fabricante',category:'Categoria',default_unit:'Unidade padrão',tracks_lot:'Controla lote',
  lot_code:'Código do lote',expires_on:'Validade',model:'Modelo',internal_code:'Código interno',serial_number:'Número de série',
  local_date:'Data',enabled:'Disponível',start_time:'Início',end_time:'Fim',starts_at:'Início',ends_at:'Fim',block_type:'Tipo de bloqueio',
  moment:'Momento',severity:'Gravidade',action_taken:'Conduta',occurred_at:'Ocorrido em',closed_at:'Encerrado em',action:'Evento',entity_type:'Área',entity_id:'Identificador do registro',
};
const VALUES={admin_criacao:'Admin de Criação',admin:'Administradora',colaborador:'Colaboradora',all:'Todos',explicit:'Seleção individual',rascunho:'Rascunho',finalizado:'Finalizado',em_atendimento:'Em atendimento',agendado:'Agendado',confirmado:'Confirmado',cancelado:'Cancelado',atendido:'Atendido',site:'Site',internal:'Interna'};
function valueLabel(value){
  if(typeof value==='boolean')return value?'Sim':'Não';
  const text=String(value);
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)){
    const date=new Date(text);if(!Number.isNaN(date.valueOf()))return date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  }
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text.split('-').reverse().join('/');
  return VALUES[text]||text;
}
export function renderCreationRows(rows=[]){
  if(!rows.length)return '<div class="bcg-empty">Nenhum registro encontrado nesta consulta.</div>';
  return rows.map(row=>{
    const title=row.cliente||row.nome||row.name||row.display_name||row.patient_name||row.profissional||row.document_code||'Registro';
    const subtitle=[row.procedimento,row.status&&valueLabel(row.status),row.inicio&&valueLabel(row.inicio),row.local_date&&valueLabel(row.local_date)].filter(Boolean).join(' • ');
    const fields=Object.entries(row).filter(([key,value])=>LABELS[key] && value!==null && value!=='' && !key.endsWith('_id') && key!=='id');
    return `<article class="bcg-subpanel"><h3>${escapeHtml(title)}</h3>${subtitle?`<p class="bcg-muted">${escapeHtml(subtitle)}</p>`:''}<details><summary>Ver detalhes</summary><dl class="bcg-creation-details">${fields.map(([key,value])=>`<div><dt>${escapeHtml(LABELS[key])}</dt><dd>${escapeHtml(valueLabel(value))}</dd></div>`).join('')}<div><dt>Identificador</dt><dd>${escapeHtml(row.id||row.user_id||'')}</dd></div></dl></details></article>`;
  }).join('');
}
export async function initCreationPanel({client,root=document}){
  const el=id=>root.getElementById(id);
  const section=el('creationSection'),search=el('creationSearch'),list=el('creationList'),status=el('creationStatus');
  const prev=el('creationPrevious'),next=el('creationNext');
  let offset=0,version=0,hasMore=false;
  section.innerHTML=Object.entries(CREATION_SECTIONS).map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  async function refresh({canApply=()=>true}={}){
    const current=++version;
    status.textContent='Carregando…';prev.disabled=true;next.disabled=true;
    try{
      const {data,error}=await client.rpc('bc_creation_list',{p_section:section.value,p_offset:offset,p_search:search.value.trim(),p_cliente_id:null});
      if(current!==version || !canApply())return;
      if(error)throw error;
      if(!data || !Array.isArray(data.rows))throw new Error('Resposta de consulta inválida.');
      list.innerHTML=renderCreationRows(data.rows);hasMore=data.has_more===true;
      status.textContent=data.total?`${offset+1}–${offset+data.rows.length} de ${data.total} registros`:'0 registros';
      prev.disabled=offset===0;next.disabled=!hasMore;
    }catch(error){
      if(current!==version || !canApply())return;
      list.replaceChildren();status.textContent=error?.message||'Não foi possível consultar. Tente atualizar.';
      prev.disabled=offset===0;next.disabled=true;
    }
  }
  el('creationFilters').addEventListener('submit',event=>{event.preventDefault();offset=0;refresh();});
  section.addEventListener('change',()=>{offset=0;search.value='';refresh();});
  el('creationRefresh').addEventListener('click',()=>refresh());
  prev.addEventListener('click',()=>{offset=Math.max(0,offset-50);refresh();});
  next.addEventListener('click',()=>{if(hasMore){offset+=50;refresh();}});
  await refresh();return {refresh,openSection(key){if(!Object.hasOwn(CREATION_SECTIONS,key))throw Error('Área não disponível.');section.value=key;offset=0;search.value='';return refresh();}};
}
