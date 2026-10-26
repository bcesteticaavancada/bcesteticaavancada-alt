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
const SECTION_GROUPS={
  'Dia a dia':['agenda','clientes','equipe','procedimentos','disponibilidade','bloqueios'],
  'Atendimentos e documentos':['atendimentos','anamneses','preanamneses','documentos','alertas','intercorrencias'],
  'Materiais e equipamentos':['produtos','lotes','equipamentos'],
  'Histórico da operação':['auditoria'],
};
function valueLabel(value){
  if(typeof value==='boolean')return value?'Sim':'Não';
  const text=String(value);
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)){
    const date=new Date(text);if(!Number.isNaN(date.valueOf()))return date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  }
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text.split('-').reverse().join('/');
  return VALUES[text]||text;
}
export function renderCreationRows(rows=[],{section=null}={}){
  if(!rows.length)return '<div class="bcg-empty">Nenhum registro encontrado nesta consulta.</div>';
  return rows.map(row=>{
    const title=row.cliente||row.nome||row.name||row.display_name||row.patient_name||row.profissional||row.document_code||'Registro';
    const subtitle=[row.procedimento,row.profissional!==title&&row.profissional,row.inicio&&valueLabel(row.inicio),row.local_date&&valueLabel(row.local_date)].filter(Boolean).join(' • ');
    const fields=Object.entries(row).filter(([key,value])=>LABELS[key] && value!==null && value!=='' && !key.endsWith('_id') && key!=='id');
    return `<article class="bcg-creation-row" data-creation-record="${escapeHtml(row.id||row.user_id||'')}"><div class="bcg-creation-record-head"><h3>${escapeHtml(title)}</h3>${row.status?`<span class="bcg-creation-state">${escapeHtml(valueLabel(row.status))}</span>`:''}</div>${subtitle?`<p class="bcg-muted">${escapeHtml(subtitle)}</p>`:''}${section==='clientes'&&row.id&&row.ativo!==false?`<button class="bcg-small-button" type="button" data-support-client="${escapeHtml(row.id)}">Abrir cadastro</button>`:''}<details><summary>Ver detalhes</summary><dl class="bcg-creation-details">${fields.map(([key,value])=>`<div><dt>${escapeHtml(LABELS[key])}</dt><dd>${escapeHtml(valueLabel(value))}</dd></div>`).join('')}<div><dt>Identificador</dt><dd>${escapeHtml(row.id||row.user_id||'')}</dd></div></dl></details></article>`;
  }).join('');
}
export async function initCreationPanel({client,root=document,view=root.defaultView||globalThis.window}){
  const el=id=>root.getElementById(id);
  const section=el('creationSection'),search=el('creationSearch'),list=el('creationList'),status=el('creationStatus');
  const prev=el('creationPrevious'),next=el('creationNext'),clear=el('creationClear');
  const states=new Map();
  const valid=key=>Object.hasOwn(CREATION_SECTIONS,key);
  const fromHash=()=>view?.location?.hash?.slice(1);
  let selected=valid(fromHash())?fromHash():'agenda',version=0,hasMore=false,busy=false,rendered='';
  const state=()=>{if(!states.has(selected))states.set(selected,{offset:0,search:''});return states.get(selected);};
  section.innerHTML=Object.entries(SECTION_GROUPS).map(([group,keys])=>`<optgroup label="${group}">${keys.map(key=>`<option value="${key}">${CREATION_SECTIONS[key]}</option>`).join('')}</optgroup>`).join('');
  function syncNavigation(){
    section.value=selected;search.value=state().search;
    el('creationTitle').textContent=CREATION_SECTIONS[selected];
    if(el('creationInvite')){el('creationInvite').hidden=selected!=='equipe';if(selected!=='equipe')root.dispatchEvent(new root.defaultView.Event('bc:support-hide-invitation'));}
    root.querySelectorAll('[data-creation-target]').forEach(link=>{if(link.dataset.creationTarget===selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    updateControls();
  }
  function updateControls(){
    const draft=search.value.trim()!==state().search;
    clear.hidden=!search.value;
    prev.disabled=busy||draft||state().offset===0;next.disabled=busy||draft||!hasMore;
    el('creationPagination').hidden=state().offset===0&&!hasMore;
  }
  function updateHash(method='replaceState'){
    if(view?.location && fromHash()!==selected)view.history?.[method]?.(null,'',`#${selected}`);
  }
  function renderRows(rows){
    const html=renderCreationRows(rows,{section:selected});
    if(html===rendered)return;
    const open=new Set([...list.querySelectorAll('details[open]')].map(detail=>detail.closest('[data-creation-record]').dataset.creationRecord));
    list.innerHTML=html;rendered=html;
    list.querySelectorAll('[data-creation-record]').forEach(row=>{if(open.has(row.dataset.creationRecord))row.querySelector('details').setAttribute('open','');});
  }
  async function refresh({quiet=false,canApply=()=>true}={}){
    if(quiet&&busy)return;
    const current=++version;
    const query={p_section:selected,p_offset:state().offset,p_search:state().search,p_cliente_id:null};
    if(!quiet){busy=true;list.setAttribute('aria-busy','true');status.textContent='Carregando…';updateControls();}
    try{
      const {data,error}=await client.rpc('bc_creation_list',query);
      if(current!==version || !canApply())return;
      if(error)throw error;
      if(!data || !Array.isArray(data.rows))throw new Error('Resposta de consulta inválida.');
      renderRows(data.rows);hasMore=data.has_more===true;
      status.textContent=data.total?`${query.p_offset+1}–${query.p_offset+data.rows.length} de ${data.total} registros`:'0 registros';
      delete status.dataset.kind;
    }catch(error){
      if(current!==version || !canApply())return;
      if(!quiet){list.replaceChildren();rendered='';hasMore=false;}
      status.textContent=error?.message||'Não foi possível consultar. Tente atualizar.';
      status.dataset.kind='error';
    }finally{
      if(current===version){busy=false;list.setAttribute('aria-busy','false');updateControls();}
    }
  }
  function openSection(key,{history=true}={}){
    if(!valid(key))throw Error('Área não disponível.');
    const changed=selected!==key;
    selected=key;
    if(changed){hasMore=false;rendered='';list.replaceChildren();}
    syncNavigation();if(history)updateHash('pushState');
    return refresh();
  }
  el('creationFilters').addEventListener('submit',event=>{event.preventDefault();state().offset=0;state().search=search.value.trim();search.value=state().search;refresh();});
  search.addEventListener('input',updateControls);
  clear.addEventListener('click',()=>{state().offset=0;state().search='';search.value='';refresh();search.focus();});
  section.addEventListener('change',()=>openSection(section.value));
  root.addEventListener('click',event=>{
    const link=event.target.closest?.('[data-creation-target]');if(!link)return;
    event.preventDefault();openSection(link.dataset.creationTarget);
    const toggle=el('menuToggle');if(toggle?.getAttribute('aria-expanded')==='true')toggle.click();
  });
  view?.addEventListener('hashchange',()=>{const key=valid(fromHash())?fromHash():'agenda';if(key!==selected)openSection(key,{history:false});updateHash();});
  el('creationRefresh').addEventListener('click',()=>refresh());
  prev.addEventListener('click',()=>{state().offset=Math.max(0,state().offset-50);refresh();});
  next.addEventListener('click',()=>{if(hasMore){state().offset+=50;refresh();}});
  syncNavigation();updateHash();
  await refresh();return {refresh,openSection};
}
