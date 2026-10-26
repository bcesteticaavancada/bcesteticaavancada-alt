export const SUPPORT_FIELDS=Object.freeze(['nome','telefone','email','cpf','data_nascimento','cep','logradouro','numero','complemento','bairro','cidade','uf','responsavel_nome','responsavel_cpf','responsavel_parentesco','responsavel_telefone']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function id(value){if(typeof value!=='string'||!UUID.test(value))throw Error('Identificador inválido.');return value;}
async function invoke(client,body){
  const {data,error}=await client.functions.invoke('client-support',{body});
  if(error){let message;try{message=(await error.context?.clone?.().json())?.error;}catch{}throw Error(message||error.message||'Não foi possível concluir o apoio.');}
  if(data?.error)throw Error(data.error);return data;
}
export function getSupportClient({client,clientId,reason='Apoio cadastral'}){return invoke(client,{action:'client_get',clientId:id(clientId),reason});}
export function updateSupportClient({client,clientId,expectedUpdatedAt,patch,reason='Correção cadastral'}){
  if(!patch||Object.keys(patch).some(key=>!SUPPORT_FIELDS.includes(key)))throw Error('Campo cadastral não permitido.');
  return invoke(client,{action:'client_update',clientId:id(clientId),expectedUpdatedAt,patch,reason});
}
export function inviteSupportCollaborator({client,name,email}){return invoke(client,{action:'invite',name:String(name||'').trim(),email:String(email||'').trim().toLowerCase()});}
export function activateSupportCollaborator({client,userId}){return invoke(client,{action:'activate_staff',userId:id(userId)});}
export function downloadSupportDocument({client,clientId,documentId,kind,reason='Envio de cópia solicitado'}){if(!['original','returned'].includes(kind))throw Error('Tipo de documento inválido.');return invoke(client,{action:'download',clientId:id(clientId),documentId:id(documentId),kind,reason});}
export function uploadSupportConsent({client,clientId,documentId,file,reason='Cópia de consentimento devolvida'}){
  if(!file||file.type!=='application/pdf'||file.size<5||file.size>8*1024*1024)throw Error('Selecione um PDF de até 8 MB.');
  const form=new FormData();for(const [key,value] of Object.entries({action:'upload_returned',clientId:id(clientId),documentId:id(documentId),reason}))form.set(key,value);form.set('file',file);
  return invoke(client,form);
}
