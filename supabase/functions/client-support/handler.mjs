const ORIGIN='https://bcesteticaavancada.github.io';
const REDIRECT=ORIGIN+'/bcesteticaavancada-alt/gestao/redefinir-senha/';
const BUCKET='bc-prontuario-private',MAX_PDF=8*1024*1024;
const FIELDS=new Set(['nome','telefone','email','cpf','data_nascimento','cep','logradouro','numero','complemento','bairro','cidade','uf','responsavel_nome','responsavel_cpf','responsavel_parentesco','responsavel_telefone']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class PublicError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const required=(value,label,max=500)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new PublicError(`${label} inválido.`);return value.trim();};
const uuid=(value,label)=>{if(typeof value!=='string'||!UUID.test(value))throw new PublicError(`${label} inválido.`);return value;};
function exactKeys(object,keys){if(!object||typeof object!=='object'||Array.isArray(object)||Object.keys(object).some(key=>!keys.includes(key)))throw new PublicError('Dados não permitidos nesta operação.');}
function dbError(error){const code=error?.code;if(code==='42501')return new PublicError('Acesso operacional não autorizado.',403);if(code==='P0002')return new PublicError('Cadastro ou documento indisponível.',404);if(code==='40001')return new PublicError('Cadastro atualizado por outra pessoa. Reabra a ficha.',409);if(code==='23505')return new PublicError('Já existe um cadastro, convite ou arquivo para esta solicitação.',409);if(['22023','22P02','22007','22008'].includes(code))return new PublicError('Confira os dados informados.',400);return new PublicError('Não foi possível concluir agora. Tente novamente.',500);}
async function boundedBody(request,limit){
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();let length=0;const chunks=[];
  try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new PublicError('Arquivo ou solicitação acima do limite permitido.',413);}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
function sessionClaims(token){try{const part=token.split('.')[1];const claims=JSON.parse(atob(part.replaceAll('-','+').replaceAll('_','/')));if(!UUID.test(claims.session_id)||!UUID.test(claims.sub))throw Error();return claims;}catch{throw new PublicError('Sessão inválida.',401);}}
function filename(name){return 'BC_'+String(name||'Cliente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)+'_documento.pdf';}

export function createSupportHandler({makeClients,crypto=globalThis.crypto}={}){
  return async request=>{
    const origin=request.headers.get('origin');
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS',Vary:'Origin'};
    const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&origin!==ORIGIN)return json({error:'Origem não autorizada.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return json({error:'Método não permitido.'},405);
    let uploadedPath=null,service=null,committed=false;
    try{
      const authorization=request.headers.get('authorization')||'';
      if(!authorization.startsWith('Bearer '))throw new PublicError('Autenticação obrigatória.',401);
      const token=authorization.slice(7).trim();const claims=sessionClaims(token);
      const clients=makeClients({authorization});service=clients.service;
      const {data:auth,error:authError}=await clients.caller.auth.getUser(token);
      if(authError||!auth?.user?.id||auth.user.id!==claims.sub)throw new PublicError('Sessão inválida.',401);
      const call=async(action,payload)=>{const {data,error}=await service.rpc('bc_support_service',{p_actor_id:auth.user.id,p_session_id:claims.session_id,p_action:action,p_payload:payload});if(error)throw dbError(error);return data;};
      const multipart=(request.headers.get('content-type')||'').startsWith('multipart/form-data');
      if(multipart){
        const bytes=await boundedBody(request,MAX_PDF+65536);
        let form;try{form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')}}).formData();}catch{throw new PublicError('Arquivo inválido.');}
        const keys=[...form.keys()];if(keys.some(key=>!['action','clientId','documentId','reason','file'].includes(key))||new Set(keys).size!==keys.length||form.get('action')!=='upload_returned')throw new PublicError('Dados não permitidos nesta operação.');
        const clientId=uuid(form.get('clientId'),'Cliente'),documentId=uuid(form.get('documentId'),'Documento'),reason=required(form.get('reason'),'Motivo');
        const file=form.get('file');if(!(file instanceof Blob)||file.type!=='application/pdf'||file.size<5||file.size>MAX_PDF)throw new PublicError('Selecione um PDF de até 8 MB.');
        const pdf=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(pdf.slice(0,5))!=='%PDF-')throw new PublicError('O arquivo selecionado não é um PDF.');
        await call('upload_check',{clientId,documentId,reason});
        const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',pdf))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
        const path=`arquivos-clientes/${clientId}/${crypto.randomUUID()}.pdf`;
        const {error}=await service.storage.from(BUCKET).upload(path,pdf,{contentType:'application/pdf',upsert:false});if(error)throw new PublicError('Não foi possível enviar o PDF.',500);
        uploadedPath=path;
        const result=await call('register_returned',{clientId,documentId,reason,storagePath:path,sizeBytes:pdf.byteLength,sha256});committed=true;
        return json(result);
      }
      let body;try{body=JSON.parse(new TextDecoder().decode(await boundedBody(request,16384)));}catch(error){if(error instanceof PublicError)throw error;throw new PublicError('Dados inválidos.');}
      const action=body?.action;
      if(action==='invite'){
        exactKeys(body,['action','name','email']);const name=required(body.name,'Nome',120),email=required(body.email,'E-mail',254).toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new PublicError('E-mail inválido.');
        const {invitationId}=await call('invite_reserve',{name,email});
        const {data,error}=await service.auth.admin.inviteUserByEmail(email,{redirectTo:REDIRECT,data:{display_name:name}});
        if(error||!data?.user?.id){await call('invite_fail',{invitationId});throw new PublicError('Não foi possível enviar o convite. Confira o e-mail e tente novamente.',502);}
        try{await call('invite_finish',{invitationId,userId:data.user.id});}catch{throw new PublicError('O convite foi enviado, mas o cadastro precisa ser concluído pela administração.',409);}
        return json({ok:true});
      }
      if(action==='client_get'){
        exactKeys(body,['action','clientId','reason']);return json(await call(action,{clientId:uuid(body.clientId,'Cliente'),reason:required(body.reason,'Motivo')}));
      }
      if(action==='client_update'){
        exactKeys(body,['action','clientId','reason','patch','expectedUpdatedAt']);
        exactKeys(body.patch,[...FIELDS]);for(const value of Object.values(body.patch)){if(value!==null&&(typeof value!=='string'||value.length>500))throw new PublicError('Dados cadastrais inválidos.');}
        if(typeof body.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(body.expectedUpdatedAt)))throw new PublicError('Versão do cadastro inválida.');
        return json(await call(action,{clientId:uuid(body.clientId,'Cliente'),reason:required(body.reason,'Motivo'),patch:body.patch,expectedUpdatedAt:body.expectedUpdatedAt}));
      }
      if(action==='download'){
        exactKeys(body,['action','clientId','documentId','kind','reason']);if(!['original','returned'].includes(body.kind))throw new PublicError('Tipo de documento inválido.');
        const record=await call(action,{clientId:uuid(body.clientId,'Cliente'),documentId:uuid(body.documentId,'Documento'),kind:body.kind,reason:required(body.reason,'Motivo')});
        const downloadName=filename(record.clientName);const {data,error}=await service.storage.from(BUCKET).createSignedUrl(record.path,60,{download:downloadName});
        if(error||!data?.signedUrl)throw new PublicError('Não foi possível preparar o download.',500);
        return json({url:data.signedUrl,filename:downloadName});
      }
      throw new PublicError('Operação indisponível.');
    }catch(error){
      if(uploadedPath&&!committed){try{await service.storage.from(BUCKET).remove([uploadedPath]);}catch{/* No metadata grants access to an orphan. */}}
      return json({error:error instanceof PublicError?error.message:'Serviço indisponível. Tente novamente.'},error instanceof PublicError?error.status:500);
    }
  };
}
