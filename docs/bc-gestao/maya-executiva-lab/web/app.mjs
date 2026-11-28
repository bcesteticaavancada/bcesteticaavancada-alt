import {types} from './contract.mjs';
import {extract} from './extract.mjs';
import {readMedia,redoScan,makePdf,recorderMime,textSource} from './media.mjs';
import {cents} from '/maya-finance-preview/engine.mjs';
const $=s=>document.getElementById(s),node=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;return e;};
const items=[],cards=new Map(),tokens=new Map(),urls=new Set();let voice=false,rec=null,stream=null,audioTimer=null,busy=false;
const labels={finalidade:'Tipo de agendamento',nome:'Nome completo',telefone:'Telefone com DDD',email:'E-mail',data_nascimento:'Nascimento',cpf:'CPF',logradouro:'Rua',numero:'Número',complemento:'Complemento',bairro:'Bairro',cidade:'Cidade',uf:'UF',cep:'CEP',cliente_id:'Cliente',atendimento_id:'Atendimento',documento_id:'Documento',descricao:'Descrição',competencia:'Data de competência',situacao:'Situação',pago_em:'Data de pagamento',procedimento:'Procedimento',profissional:'Profissional',data:'Data',hora:'Horário',meio:'Forma de pagamento',valor_centavos:'Valor (R$)',saldo_centavos:'Saldo a receber (R$)',contratado_centavos:'Valor contratado (R$)',parcelas:'Número de parcelas',vencimento:'Primeiro vencimento',titulo:'Título',categoria:'Categoria',conferencia:'Verificação do recebimento'};
const optionText=s=>({agendamento:'Agendamento',retorno:'Retorno',recebimento_conferido:'Conferi o recebimento por outra fonte',a_pagar:'A pagar',paga:'Paga',pix:'Pix',credito:'Crédito',debito:'Débito',tcle_externo:'TCLE externo',exame_documento_apresentado:'Exame apresentado',documento_digitalizado:'Documento digitalizado',relatorio_externo:'Relatório externo',outro_clinico:'Outro documento clínico'})[s]||s;
const format=v=>(v/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const status=s=>{$('status').textContent=s;};
const objUrl=b=>{const url=URL.createObjectURL(b);urls.add(url);return url;};
function cleanup(){clearTimeout(audioTimer);if(rec?.state==='recording')rec.stop();stream?.getTracks().forEach(t=>t.stop());urls.forEach(u=>URL.revokeObjectURL(u));urls.clear();}
window.addEventListener('pagehide',cleanup);
async function api(path,data={},extra={}){
 const r=await fetch('/api/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),...extra});
 let result;try{result=await r.json();}catch{throw Error('Servidor local indisponível. As alterações ainda não foram confirmadas.');}
 if(!r.ok){
  if(path!=='session'&&(r.status===401||result.error==='perfil'||result.error==='Acesso indisponível para este perfil.')){
   cleanup();$('desk').hidden=true;$('history').hidden=true;$('gate').hidden=false;
   $('gate').textContent='Acesso operacional indisponível para esta sessão.';
   for(const id of ['balance','cards','client','log','attachments'])$(id).replaceChildren();
  }
  throw Error(result.error);
 }
 return result;
}
async function refreshCash(){
 const {saldo_centavos}=await api('cash');
 $('balance').textContent='Saldo realizado: R$ '+format(saldo_centavos);$('balance').hidden=false;
}
$('cash').onclick=()=>refreshCash().catch(e=>status(e.message));
async function openClient(id){
 const client=await api('client',{id}),section=$('client'),list=section.querySelector('ul');
 section.querySelector('p').textContent=client.nome+' · '+client.telefone;list.replaceChildren();
 for(const visit of client.atendimentos){
  const item=node('li',visit.data+' · '+visit.procedimento),details=node('ul');
  for(const r of visit.retornos)details.append(node('li','Retorno em '+r.data+' às '+r.hora));
  for(const d of visit.documentos)details.append(node('li','Documento vinculado · '+optionText(d.categoria)));
  for(const r of visit.recebimentos)details.append(node('li','Recebimento em '+r.data+' · R$ '+format(r.valor_centavos)));
  if(details.childElementCount)item.append(details);list.append(item);
 }
 section.hidden=false;section.scrollIntoView();
}
function button(label,fn,cls=''){const b=node('button',label);b.type='button';b.className=cls;b.onclick=async()=>{b.disabled=true;try{await fn(b);}catch(e){status(e.message);}finally{b.disabled=false;}};return b;}
function opt(select,value,label){const o=node('option',label);o.value=value;select.append(o);}
function paint(canvas,source){canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);}
function addPreview(item){
 const box=node('section');box.className='attachment';box.append(node('strong',item.file.name));
 if(item.scan){
  const canvas=node('canvas');paint(canvas,item.copy);box.append(canvas);
  const s=item.scan;let selecting=false,points=[];
  const refresh=async()=>{status('Reconhecendo o texto da cópia…');await redoScan(item);paint(canvas,item.copy);ta.value=item.text;status(item.warning||'Cópia atualizada. Original preservado.');};
  box.append(button('Girar 90°',async()=>{s.turns++;await refresh();}),button('Ajustar contraste',async()=>{s.contrast=s.contrast===1?1.45:1;await refresh();}),button('Marcar quatro cantos',()=>{selecting=true;points=[];paint(canvas,s.original);status('Toque no canto superior esquerdo, superior direito, inferior direito e inferior esquerdo.');}));
  canvas.onclick=async ev=>{if(!selecting)return;const r=canvas.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width,y=(ev.clientY-r.top)/r.height;points.push([x,y]);const c=canvas.getContext('2d');c.fillStyle='#b74030';c.fillRect(x*canvas.width-4,y*canvas.height-4,8,8);
   if(points.length===4){selecting=false;const prior=s.quad;s.quad=points;try{await refresh();}catch(e){s.quad=prior;paint(canvas,item.copy);status(e.message);}}};
 }else if(item.source.modalidade==='audio'){const a=node('audio');a.controls=true;a.src=objUrl(item.file);box.append(a);}
 if(item.warning)box.append(node('p',item.warning));const lab=node('label','Texto para conferência'),ta=node('textarea');ta.rows=2;ta.value=item.text;ta.maxLength=16000;ta.oninput=()=>{item.text=ta.value;};lab.append(ta);box.append(lab);
 box.append(button('Retirar anexo',()=>{items.splice(items.indexOf(item),1);box.remove();$('pdf').hidden=!items.some(i=>i.copy);}));
 $('attachments').append(box);$('pdf').hidden=!items.some(i=>i.copy);
}
async function addFiles(files){
 if(busy)throw Error('Aguarde a leitura atual.');busy=true;$('prepare').disabled=true;
 try{for(const file of files){if(items.length>=8){status('Limite de oito anexos por vez.');break;}status('Lendo '+file.name+' no aparelho…');
  try{const i=await readMedia(file,{voice,status});if(items.some(x=>x.source.sha256_arquivo===i.source.sha256_arquivo)){status('Original já adicionado.');continue;}items.push(i);addPreview(i);status(i.warning||'Leitura pronta para conferência.');}catch(e){status(file.name+' — '+e.message);}
 }}finally{busy=false;$('prepare').disabled=false;}
}
for(const id of ['camera','gallery','files'])$(id).onchange=async e=>{const f=[...e.target.files];e.target.value='';try{await addFiles(f);}catch(err){status(err.message);}};
$('mic').onclick=async()=>{
 if(rec?.state==='recording'){rec.stop();return;}
 if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder){status('Microfone indisponível. Você pode anexar um áudio.');return;}
 try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});const mime=recorderMime();rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
  const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onstop=async()=>{clearTimeout(audioTimer);stream.getTracks().forEach(t=>t.stop());$('mic').textContent='Gravar áudio';const type=rec.mimeType||mime;try{await addFiles([new File(chunks,'Ditado fictício',{type})]);}catch(e){status(e.message);}};
  rec.start();$('mic').textContent='Parar gravação';status('Gravando no aparelho. Limite de 60 segundos.');audioTimer=setTimeout(()=>{if(rec.state==='recording')rec.stop();},59500);
 }catch{stream?.getTracks().forEach(t=>t.stop());status('O microfone está indisponível. Você pode anexar o arquivo.');}
};
$('pdf').onclick=async()=>{try{const blob=await makePdf(items);const a=node('a');a.href=objUrl(blob);a.download='maya-scan-copia.pdf';a.click();status('Cópia multipágina preparada.');}catch(e){status(e.message);}};
function setSample(){$('message').value='Cadastre a cliente. Nome: Íris Exemplo; telefone: 31900001111. Ela realizou um procedimento de R$ 600, pagou R$ 200 no Pix, vai pagar o restante no próximo mês e precisa de retorno.';$('kind').value='auto';$('message').focus();}
$('example').onclick=setSample;
for(const [k,v] of Object.entries(types))opt($('kind'),k,v.label);
const records=async type=>api('list',{tipo:type});
async function showCard(op,original){
 const existing=cards.get(op.id);const box=node('article');box.className='card';box.dataset.kind=op.tipo;
 if(existing)existing.replaceWith(box);else $('cards').append(box);cards.set(op.id,box);
 const row=node('div');row.className='row';row.append(node('h3',types[op.tipo].label),node('span',({rascunho:'Para conferir',em_conferencia:'Aguardando confirmação',confirmada:'Registrado no laboratório',cancelada:'Cancelado'})[op.estado_revisao]));box.append(row);
 if(['cancelada','confirmada'].includes(op.estado_revisao)){
  const client=op.campos.cliente_id||(op.tipo==='cadastro'?op.referencia_homologacao:null);
  if(client&&op.estado_revisao==='confirmada')box.append(button('Abrir cadastro',()=>openClient(client),'link'));return;
 }
 if(op.dependencias.length)box.append(node('p','As etapas anteriores devem estar confirmadas. O cadastro e os vínculos serão preenchidos pela Maya.'));
 if(op.tipo==='recebimento')box.append(node('p','Confira o recebimento no extrato ou no caixa antes de registrar.'));
 const grid=node('div');grid.className='grid';const fields={},spec=types[op.tipo],reviewing=op.estado_revisao==='em_conferencia';
 const lockedRefs=new Set(op.dependencias.map(id=>({cadastro:'cliente_id',documento:'documento_id',atendimento:'atendimento_id'})[cards.get(id)?.dataset.kind]));
 for(const [key,s] of Object.entries(spec.fields)){
  const label=node('label',labels[key]||key),isRef=key.endsWith('_id'),money=key.endsWith('_centavos');
  let input;
  if(isRef||s.enum){
   input=node('select');opt(input,'',lockedRefs.has(key)?'Da etapa anterior':'Selecionar…');
   if(isRef){const entity=({cliente_id:'cadastro',atendimento_id:'atendimento',documento_id:'documento'})[key];
    if(op.campos[key])opt(input,op.campos[key],'Vínculo conferido');
    const fill=async()=>{const value=input.value;input.replaceChildren();opt(input,'',lockedRefs.has(key)?'Da etapa anterior':'Selecionar…');for(const r of await records(entity))opt(input,r.id,r.nome+(r.telefone?' · final '+r.telefone:''));input.value=value;};
    if(!lockedRefs.has(key))await fill();
   }else for(const value of s.enum)opt(input,value,optionText(value));
  }else{input=node('input');input.type=s.format==='date'?'date':key==='hora'?'time':s.format==='email'?'email':'text';if(money||s.type==='integer')input.inputMode='decimal';}
  input.name=key;if(op.campos[key]!=null)input.value=money?format(op.campos[key]):String(op.campos[key]);
  input.disabled=reviewing||lockedRefs.has(key);if(lockedRefs.has(key)&&op.campos[key])input.title='Vínculo da etapa anterior';
  label.append(input);fields[key]=input;grid.append(label);
 }
 box.append(grid);
 if(op.evidencias.length){const d=node('details'),ul=node('ul');d.append(node('summary','Ver trechos de origem'));for(const e of op.evidencias)ul.append(node('li',(labels[e.campo]||e.campo)+' · '+e.trecho+(e.pagina?' · página '+e.pagina:'')));d.append(ul);box.append(d);}
 const buttons=node('div');buttons.className='buttons';box.append(buttons);
 const ack=node('input');ack.type='checkbox';if(!reviewing&&['cadastro','atualizacao_cadastral'].includes(op.tipo)){const l=node('label');l.append(ack,document.createTextNode(' Conferi a identidade em caso de homônimo'));box.insertBefore(l,buttons);}
 if(reviewing){
  box.append(node('small','Revisão válida até '+new Date(op.expira_em).toLocaleTimeString('pt-BR')+'.'));
  buttons.append(button('Confirmar no laboratório',async()=>{
   const token=tokens.get(op.id);let done;
   if(op.tipo==='documento'){if(!original)throw Error('Selecione o original desta revisão.');done=await api('original',{}, {headers:{'Content-Type':'application/octet-stream','X-Review-ID':op.id,'X-Review-Token':token},body:original});}
   else done=await api('confirm',{id:op.id,token});
   await showCard(done,original);status('Operação conferida e registrada na base fictícia.');
   if(!$('balance').hidden&&['recebimento','despesa'].includes(done.tipo))await refreshCash();
  },'primary'),button('Voltar e corrigir',async()=>{await api('invalidate',{id:op.id});tokens.delete(op.id);await showCard({...op,estado_revisao:'rascunho'},original);}));
 }else buttons.append(button('Revisar campos',async()=>{
  const values={};for(const [k,i] of Object.entries(fields)){const value=i.value.trim();if(!value)continue;values[k]=k.endsWith('_centavos')?cents(value):spec.fields[k].type==='integer'?Number(value):value;}
  const r=await api('review',{id:op.id,campos:values,homonimo:ack.checked});tokens.set(op.id,r.token);await showCard(r.op,original);status('Confira os campos e confirme este cartão.');
 },'primary'));
 buttons.append(button('Cancelar',async()=>{const canceled=await api('cancel',{id:op.id});tokens.delete(op.id);await showCard(canceled,original);status('Cartão cancelado.');}));
}
$('prepare').onclick=async()=>{
 const b=$('prepare');if(busy)return;b.disabled=true;
 try{const message=$('message').value.trim(),kind=$('kind').value;if(!message&&!items.length)throw Error('Escreva um pedido ou selecione um anexo.');
  const inputs=items.length?[...items]:[{file:null,text:'',source:await textSource(message)}];let total=0;
  // The first attachment provides the business fields. Additional originals get their own document card.
  const proposed=[];for(const [index,item] of inputs.entries()){
   const typed=index===0?message:'',selected=index===0?kind:'documento';
   if(index>0&&item.source.modalidade==='audio')continue;
   const draft=extract({message:typed,text:item.text,source:item.source,kind:selected,filename:item.file?.name||''});
   for(const op of draft){if(index>0&&proposed.some(o=>o.tipo==='cadastro'))op.depends=['cadastro'];for(const ev of op.evidencias){const p=item.pages?.findIndex(t=>t.includes(ev.trecho))??-1;if(p>=0)ev.pagina=p+1;}proposed.push(op);}
  }
  if(!proposed.length)throw Error('Escolha o tipo de operação no menu Preparar.');const env=await api('intake',{propostas:proposed});
  for(const op of env.entidades){await showCard(op,inputs.find(i=>i.source.sha256_arquivo===op.origem_captura.sha256_arquivo)?.file);total++;}
  status(total+' cartão(ões) para conferir.');$('cards').scrollIntoView({block:'start'});
 }catch(e){status(e.message);}finally{b.disabled=false;}
};
$('history').onclick=async()=>{try{const ul=$('log').querySelector('ul');ul.replaceChildren();const events=await api('history');for(const e of events)ul.append(node('li',(types[e.kind]?.label||e.kind)+' · '+e.event+' · '+new Date(e.at).toLocaleTimeString('pt-BR')));if(!events.length)ul.append(node('li','Nenhuma operação registrada.'));$('log').hidden=false;$('log').scrollIntoView();}catch(e){status(e.message);}};
try{
 const ticket=location.hash.slice(1);history.replaceState(null,'',location.pathname);
 const session=await api('session',ticket?{ticket}:{});
 if(!session.operacional)throw Error('Seu perfil não tem acesso ao caixa nem aos registros deste laboratório.');
 voice=(await api('features')).voice;
 $('gate').hidden=true;$('desk').hidden=false;$('history').hidden=false;
}catch(e){$('gate').textContent=e.message;}
