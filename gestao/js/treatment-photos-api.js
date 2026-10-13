const BUCKET='bc-prontuario-private';
const MAX_BYTES=8*1024*1024;
const TYPE_EXTENSIONS=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]);
const PHOTO_KINDS=new Set(['antes','depois','adicional']);

function required(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function optional(value){const clean=String(value??'').trim();return clean||null;}
function ensureClient(client){if(!client?.storage||typeof client.storage.from!=='function'||typeof client.rpc!=='function')throw new Error('Cliente Supabase indisponível.');}
function fail(error,fallback){if(error)throw new Error(error.message||fallback);}
function uniqueId(){return globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():`clinical-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function validateFile(file){
  if(!file||typeof file!=='object')throw new Error('Selecione uma imagem JPEG, PNG ou WebP.');
  if(!TYPE_EXTENSIONS.has(file.type))throw new Error('A foto deve ser uma imagem JPEG, PNG ou WebP.');
  if(!Number.isFinite(file.size)||file.size<=0)throw new Error('Tamanho da imagem inválido.');
  if(file.size>MAX_BYTES)throw new Error('A foto deve ter no máximo 8 MB.');
}
function validateKind(kind){const clean=required(kind,'Classificação da foto');if(!PHOTO_KINDS.has(clean))throw new Error('Classificação da foto deve ser Antes, Depois ou Adicional.');return clean;}
async function rpc(client,name,payload,fallback){ensureClient(client);const {data,error}=await client.rpc(name,payload);fail(error,fallback);return data;}

export async function listTreatmentPhotos({client,treatmentId}){
  const data=await rpc(client,'bc_treatment_photo_list',{p_treatment_id:required(treatmentId,'Atendimento')},'Não foi possível carregar as fotos clínicas.');
  return data??[];
}

export async function uploadTreatmentPhoto({client,treatmentId,clienteId,kind,region=null,view=null,caption=null,capturedAt=null,file}){
  ensureClient(client);
  const treatment=required(treatmentId,'Atendimento');
  const cliente=required(clienteId,'Cliente');
  const photoKind=validateKind(kind);
  validateFile(file);
  const extension=TYPE_EXTENSIONS.get(file.type);
  const storagePath=`fotos-clinicas/${cliente}/${treatment}/${uniqueId()}.${extension}`;
  const bucket=client.storage.from(BUCKET);
  const {error:uploadError}=await bucket.upload(storagePath,file,{contentType:file.type,upsert:false});
  fail(uploadError,'Não foi possível enviar a foto clínica.');
  const photoId=await rpc(client,'bc_treatment_photo_register',{
    p_treatment_id:treatment,p_storage_path:storagePath,p_mime_type:file.type,p_size_bytes:file.size,p_kind:photoKind,
    p_region:optional(region),p_view:optional(view),p_caption:optional(caption),p_captured_at:capturedAt?required(capturedAt,'Data da captura'):null,
  },'A foto foi enviada, mas não foi possível registrá-la no atendimento.');
  return {photoId,storagePath};
}

export async function voidTreatmentPhoto({client,photoId,reason}){
  return await rpc(client,'bc_treatment_photo_void',{p_photo_id:required(photoId,'Foto'),p_reason:required(reason,'Motivo')},'Não foi possível anular a foto clínica.');
}

export async function getTreatmentPhotoUrl({client,storagePath,expiresIn=300}){
  ensureClient(client);
  const path=required(storagePath,'Caminho da foto');
  if(!Number.isInteger(expiresIn)||expiresIn<30||expiresIn>3600)throw new Error('Validade da URL assinada inválida.');
  const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,expiresIn);
  fail(error,'Não foi possível abrir a foto clínica.');
  const url=data?.signedUrl||data?.signedURL;
  if(!url)throw new Error('URL assinada da foto não foi retornada.');
  return url;
}

export {BUCKET as TREATMENT_PHOTO_BUCKET,MAX_BYTES as TREATMENT_PHOTO_MAX_BYTES};
