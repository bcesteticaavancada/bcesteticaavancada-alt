import {SUPABASE_URL} from '../js/config.js';
import {getCurrentProfile,installSessionGuard} from '../js/auth.js';
import {createBcGestaoClient} from '../js/supabase-client.js';
import {findAppGuide,listAppGuides} from '../maya-beta/app-guides.js';
const $=id=>document.getElementById(id);
const element=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
const number=(n,d=0)=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:d});
const brl=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const actions={search:'Busca no Google',analytics:'Visitas institucionais',checks:'Testes do site',vitals:'Desempenho mobile',cash:'Fluxo de caixa',brief:'Nota do Roque',workspace:'Documento no Drive',status:'Consulta de estado'};
const topics={seo:'SEO',operacao:'operação',comercial:'estratégia comercial'};
const commonGuides=new Set(['conexao','site','backup-recuperacao','dominio-proprio','propor-melhoria','publicar-site','central-integracoes']);
const panel=$('panel'),gate=$('gate');
let epoch=0,mode=null,exportRows=[],working=false,speech=null;
function clearReview(){mode=null;$('review').hidden=true;}
function clearSensitive(){
  epoch++;clearReview();exportRows=[];speech?.abort();
  for(const id of ['messages','metrics','history','services','actions'])$(id).replaceChildren();
  for(const id of ['observed','usage','metricStatus','chatStatus','reviewText'])$(id).textContent='';
  $('prompt').value='';$('doc').removeAttribute('href');$('doc').hidden=true;$('csv').hidden=true;
}
const liveHost=['www.bcesteticaavancada.com.br','bcesteticaavancada.com.br','bcesteticaavancada.github.io'].includes(location.hostname);
async function boot(){
  if(liveHost || new URL(SUPABASE_URL).hostname==='tpqsmerlxquyrzrjbogj.supabase.co'){
    gate.textContent='A Central aguarda a configuração de um Supabase de homologação isolado.';return;
  }
  if(!globalThis.supabase?.createClient){
    await new Promise((ok,fail)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=ok;s.onerror=fail;document.head.append(s);});
  }
  const client=createBcGestaoClient(globalThis.supabase.createClient),profile=await getCurrentProfile(client);
  if(!profile || !['admin','admin_criacao'].includes(profile.role)){
    gate.textContent='Esta área exige uma sessão administrativa de homologação.';return;
  }
  $('back').href=profile.role==='admin'?'../admin/':'../criacao/';
  const guard=installSessionGuard({client,profile,app:panel});
  async function authorized(){try{return await guard.authorize();}catch{panel.hidden=true;clearSensitive();gate.hidden=false;gate.textContent='Sessão indisponível. Entre novamente.';return false;}}
  async function invoke(data){
    const version=epoch;
    if(!await authorized())throw Error('Sessão indisponível.');
    const {data:result,error}=await client.functions.invoke('bc-central',{body:data});
    if(epoch!==version || panel.hidden || !await authorized())throw Error('Sessão encerrada.');
    if(error){
      const code=await error.context?.clone?.().json().catch(()=>({}));
      const messages={configuracao:'Falta a autorização deste serviço no ambiente de homologação.',limite:'Limite de uso atingido.',perfil:'Seu perfil não tem acesso.',pedido_ja_registrado:'Esta operação já está registrada. Confira o histórico antes de repetir.',provedor:'O provedor não confirmou o resultado. Consulte o histórico.',confirmacao:'A revisão expirou. Prepare uma nova ação.'};
      throw Error(messages[code?.error]||'Serviço indisponível. A operação não foi confirmada.');
    }
    return result;
  }
  const query=action=>invoke({action,key:crypto.randomUUID()});
  const showError=(id,error)=>{if(!panel.hidden)$(id).textContent=error.message;};
  function card(name,status,detail){
    const c=element('article','','card');c.append(element('h3',name),element('p',status),element('small',detail));$('services').append(c);
  }
  let configured={};
  async function refresh(){
    const data=await query('status');configured=data.configured;
    $('services').replaceChildren();$('observed').textContent='Sessão validada em '+new Date(data.observed).toLocaleString('pt-BR')+' · '+(profile.role==='admin'?'Administração':'Administração de criação');
    card('Supabase','Sessão e API verificadas','Perfil conferido pelo servidor nesta consulta.');
    for(const [id,title] of [['search','Search Console'],['analytics','Google Analytics 4'],['workspace','Google Workspace'],['brief','Roque generativo']]){
      const state=configured[id]?'Configuração disponível para teste':'Autorização pendente';
      card(title,state,id==='brief'?'Exige aprovação por nota e limite diário.':'Escopo solicitado: '+(data.scopes[id]||'—'));
    }
    card('Maya interna','Biblioteca revisada','Guias por perfil. A Maya atende na área interna.');
    card('Backup e recuperação','Última cópia não aferida','A confirmação depende do diário privado e de um ensaio de restauração.');
    card('Google Tag Manager','Coleta bloqueada','Destino e regras de privacidade aguardam validação.');
    $('usage').textContent=data.requests24h+' solicitações deste perfil nas últimas 24 horas.';
    $('history').replaceChildren(...data.operations.map(r=>element('li',new Date(r.started_at).toLocaleString('pt-BR')+' · '+actions[r.action]+' · '+r.state+(r.code?' · '+r.code:''))));
    if(!data.operations.length)$('history').append(element('li','Nenhuma operação anterior disponível.'));
    $('actions').replaceChildren();
    for(const id of ['search','analytics','checks','vitals',...(profile.role==='admin'?['cash']:[])]){
      const btn=element('button',actions[id]);btn.type='button';btn.disabled=configured[id]===false;btn.onclick=()=>measure(id);$('actions').append(btn);
    }
    for(const b of document.querySelectorAll('[data-topic]'))b.disabled=!configured.brief;
    $('workspace').disabled=!configured.workspace;
  }
  let serial=0;
  async function measure(id){
    const ticket=++serial;$('metrics').replaceChildren();$('csv').hidden=true;exportRows=[];$('metricStatus').textContent='Consultando…';
    try{
      const data=await query(id);if(ticket!==serial)return;
      const rows=[];
      if(data.available===false){$('metricStatus').textContent='O provedor não retornou dados para o período.';return;}
      if(id==='search')rows.push(['Cliques',number(data.clicks)],['Impressões',number(data.impressions)],['CTR',number(data.ctr*100,2)+'%'],['Posição média',number(data.position,1)]);
      if(id==='analytics')rows.push(['Sessões',number(data.sessions)],['Visualizações',number(data.views)]);
      if(id==='cash')rows.push(['Entradas',brl(data.income)],['Saídas',brl(data.expense)],['Saldo',brl(data.balance)]);
      if(id==='checks')for(const c of data.checks)rows.push([c.name,c.conclusion||c.status]);
      if(id==='vitals')for(const [key,label,unit] of [['lcp','LCP de campo',' ms'],['inp','INP de campo',' ms'],['cls','CLS de campo',''],['labScore','Desempenho de laboratório','/100']])rows.push([label,data[key]==null?'Sem amostra':number(data[key]*(key==='labScore'?100:1),2)+unit]);
      const grid=element('div','','metric-grid');
      for(const [label,value] of rows){const m=element('div','','metric');m.append(element('small',label),element('strong',value));grid.append(m);}
      $('metrics').append(grid);exportRows=rows;$('csv').hidden=!rows.length;
      $('metricStatus').textContent=data.period?data.period.start+' a '+data.period.end:id==='checks'?'Revisão '+data.revision.slice(0,8)+(rows.length?'':' · sem execução retornada'):('Estratégia mobile · campo: '+(data.fieldScope||'sem amostra'));
    }catch(e){if(ticket===serial)showError('metricStatus',e);}
  }
  $('csv').onclick=async()=>{if(!exportRows.length || !await authorized())return;const csv='\uFEFF'+[['Indicador','Valor'],...exportRows].map(row=>row.map(s=>'"'+String(s).replaceAll('"','""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=element('a','');a.href=url;a.download='bc-indicadores.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('refresh').onclick=()=>refresh().catch(e=>showError('observed',e));
  $('chat').onsubmit=async e=>{
    e.preventDefault();const text=$('prompt').value.trim();if(!text || !await authorized())return;
    const guides=listAppGuides(profile).filter(g=>commonGuides.has(g.id));
    const found=findAppGuide(text,profile);
    const g=found && commonGuides.has(found.id)?found:guides.find(x=>text.toLowerCase().includes(x.id.split('-')[0]));
    $('messages').append(element('p','Você · '+text),element('p',g?'Roque · '+g.title+'\n'+g.steps.join('\n'):'Roque · Posso orientar sobre '+guides.map(x=>x.title).join(', ')+'. Os botões de indicadores consultam as integrações autorizadas.'));
    $('prompt').value='';
  };
  $('clear').onclick=()=>{$('messages').replaceChildren();$('prompt').value='';clearReview();$('chatStatus').textContent='Conversa limpa.';};
  let preparation=0;
  async function prepare(action,topic){
    if(working)return;const ticket=++preparation;clearReview();$('doc').hidden=true;
    const item={action,key:crypto.randomUUID(),...(topic?{topic}:{})};
    try{
      const data=await invoke({...item,prepare:true});if(ticket!==preparation)return;
      mode={...item,approval:data.approval};$('reviewText').textContent=topic?'Gerar uma nota geral de '+topics[topic]+' na OpenAI usando a cota aprovada?':'Criar um novo Google Docs técnico na pasta de homologação configurada?';
      $('review').hidden=false;$('chatStatus').textContent='';
    }catch(e){showError('chatStatus',e);}
  }
  for(const b of document.querySelectorAll('[data-topic]'))b.onclick=()=>prepare('brief',b.dataset.topic);
  $('workspace').onclick=()=>prepare('workspace');
  $('cancel').onclick=()=>{preparation++;clearReview();$('chatStatus').textContent='Ação cancelada.';};
  $('confirm').onclick=async()=>{
    if(!mode || working)return;const item=mode;working=true;clearReview();$('chatStatus').textContent='Aguardando confirmação do servidor…';
    try{const r=await invoke(item);if(r.answer)$('messages').append(element('p','Roque · Rascunho gerado para revisão\n'+r.answer));
      if(r.document && /^[\w-]+$/.test(r.document)){$('doc').href='https://docs.google.com/document/d/'+r.document+'/edit';$('doc').hidden=false;}
      $('chatStatus').textContent='Operação concluída.';await refresh();
    }catch(e){showError('chatStatus',e);}finally{working=false;}
  };
  const Recognition=globalThis.SpeechRecognition;
  if(Recognition && 'processLocally' in Recognition.prototype){
    $('voice').hidden=false;$('voice').onclick=()=>{try{speech=new Recognition();speech.processLocally=true;speech.lang='pt-BR';speech.onresult=e=>{if(!panel.hidden)$('prompt').value=e.results[0][0].transcript.slice(0,350);};speech.onerror=()=>showError('chatStatus',Error('Ditado local indisponível. Digite a pergunta.'));speech.start();}catch{showError('chatStatus',Error('Ditado local indisponível.'));}};
  }
  window.addEventListener('pagehide',()=>{panel.hidden=true;clearSensitive();});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void authorized();});
  gate.hidden=true;panel.hidden=false;
  await refresh();
}
boot().catch(()=>{panel.hidden=true;clearSensitive();gate.hidden=false;gate.textContent='A conexão de homologação está indisponível. Verifique a sessão e a API da Central.';});
