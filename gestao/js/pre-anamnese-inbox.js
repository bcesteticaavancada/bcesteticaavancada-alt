import {listClients} from './clientes-api.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const required=(value,label)=>{const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;};
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);if(error)throw new Error(error.message||'Não foi possível concluir.');return data;}
export async function listPreAnamneses({client,offset=0}){return await rpc(client,'bc_pre_anamnese_inbox_page',{p_limit:100,p_offset:offset})||[];}
export async function linkPreAnamnese({client,intakeId,clienteId}){return rpc(client,'bc_pre_anamnese_link',{p_intake_id:required(intakeId,'Ficha'),p_cliente_id:required(clienteId,'Selecione o cadastro correto')});}

export function renderPreAnamneseInbox(items=[],clients=[]){
  if(!items.length)return '<p class="bcg-empty">Nenhuma pré-anamnese recebida.</p>';
  return items.map(item=>`<article class="bcg-editor-card" data-intake-card="${esc(item.id)}"><h3>${esc(item.patient_name)}</h3><p>${esc(item.procedure)} • ${esc(item.patient_phone)}</p><p class="bcg-muted">${esc(item.public_code)} • ${esc(new Date(item.created_at||0).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}))} • ${item.status==='vinculada'?'Vinculada à pasta':'Aguardando revisão'}</p>${item.pdf_path?`<button type="button" class="bcg-small-button" data-intake-pdf="${esc(item.id)}">Revisar PDF privado</button>`:'<p>PDF em preparação. Atualize em instantes.</p>'}${item.status==='vinculada'?'<p class="bcg-status">Documento vinculado. A avaliação clínica deve ser registrada no prontuário.</p>':`<label>Vincular à pasta<select class="bcg-input" data-intake-client="${esc(item.id)}"><option value="">Selecione o cadastro correto</option>${clients.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)} • ${esc(c.telefone)}</option>`).join('')}</select></label><button type="button" class="bcg-small-button" data-intake-link="${esc(item.id)}"${item.pdf_path?'':' disabled'}>Revisei a ficha e confirmo o vínculo</button>`}<p class="bcg-status" data-intake-status></p></article>`).join('');
}

export async function initPreAnamneseInbox({client,root=document}){
  const host=root.getElementById('preAnamneseInbox');if(!host)return null;
  let items=[];let offset=0;let refreshVersion=0;
  const pager=root.createElement('div');pager.className='bcg-form-actions';
  const previous=root.createElement('button'),next=root.createElement('button');
  for(const button of [previous,next]){button.type='button';button.className='bcg-small-button';pager.appendChild(button);}
  previous.textContent='Fichas mais recentes';next.textContent='Fichas anteriores';host.after(pager);
  async function refresh({canApply=()=>true}={}){
    const version=++refreshVersion;
    const [rows,clients]=await Promise.all([listPreAnamneses({client,offset}),listClients({client})]);if(version!==refreshVersion || !canApply())return;items=rows;host.innerHTML=renderPreAnamneseInbox(items,clients);previous.disabled=offset===0;next.disabled=items.length<100;
  }
  previous.addEventListener('click',()=>{offset=Math.max(0,offset-100);refresh().catch(error=>{host.textContent=error.message;});});
  next.addEventListener('click',()=>{offset+=100;refresh().catch(error=>{host.textContent=error.message;});});
  root.getElementById('preAnamneseRefresh')?.addEventListener('click',()=>refresh().catch(error=>{host.textContent=error.message;}));
  host.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-intake-pdf],[data-intake-link]');if(!button)return;
    button.disabled=true;const card=button.closest('[data-intake-card]');const status=card.querySelector('[data-intake-status]');
    try{
      if(button.dataset.intakePdf){
        const item=items.find(r=>r.id===button.dataset.intakePdf);
        const {data,error}=await client.storage.from('bc-prontuario-private').createSignedUrl(item.pdf_path,300);
        if(error||!data?.signedUrl)throw new Error('Não foi possível abrir o PDF privado.');
        const anchor=root.createElement('a');anchor.href=data.signedUrl;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.click();
      }else{
        await linkPreAnamnese({client,intakeId:button.dataset.intakeLink,clienteId:card.querySelector('[data-intake-client]').value});
        offset=0;await refresh();
      }
    }catch(error){status.textContent=error.message||'Não foi possível concluir.';status.dataset.kind='error';}
    finally{button.disabled=false;}
  });
  await refresh();return {refresh};
}
