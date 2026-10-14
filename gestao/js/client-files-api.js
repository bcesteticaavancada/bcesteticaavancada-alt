const BUCKET='bc-prontuario-private';
const MAX_BYTES=8*1024*1024;
const TYPE_EXTENSIONS=new Map([
  ['application/pdf','pdf'],
  ['image/jpeg','jpg'],
  ['image/png','png'],
  ['image/webp','webp'],
]);
const CATEGORIES=new Set(['tcle_externo','exame_documento_apresentado','documento_digitalizado','relatorio_externo','outro_clinico']);
const ORIGINS=new Set(['gov_br','digitalizado','upload_manual','outro']);

function required(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function optional(value){const clean=String(value??'').trim();return clean||null;}
function ensureClient(client){if(!client?.storage||typeof client.storage.from!=='function'||typeof client.rpc!=='function')throw new Error('Cliente Supabase indisponível.');}
function fail(error,fallback){if(error)throw error instanceof Error?error:new Error(error?.message||fallback);}
function uniqueId(){return globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():`file-${Date.now()}-${Math.random().toString(16).slice(2)}`;}

function validateFile(file){
  if(!file||typeof file!=='object')throw new Error('Selecione um arquivo PDF, JPEG, PNG ou WebP.');
  if(!TYPE_EXTENSIONS.has(file.type))throw new Error('O arquivo deve ser PDF, JPEG, PNG ou WebP.');
  if(!Number.isFinite(file.size)||file.size<=0)throw new Error('Tamanho do arquivo inválido.');
  if(file.size>MAX_BYTES)throw new Error('O arquivo deve ter no máximo 8 MB.');
  if(typeof file.arrayBuffer!=='function')throw new Error('Não foi possível ler o arquivo selecionado.');
}
function validateCategory(value){const clean=required(value,'Categoria');if(!CATEGORIES.has(clean))throw new Error('Categoria de documento inválida.');return clean;}
function validateOrigin(value){const clean=required(value,'Origem');if(!ORIGINS.has(clean))throw new Error('Origem do documento inválida.');return clean;}
async function sha256File(file){
  if(!globalThis.crypto?.subtle)throw new Error('SHA-256 indisponível neste navegador.');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte)=>byte.toString(16).padStart(2,'0')).join('');
}

export async function uploadClientFile({client,clienteId,file,title,category,origin,documentDate=null}){
  ensureClient(client);
  const cliente=required(clienteId,'Cliente');
  const documentTitle=required(title,'Título');
  const documentCategory=validateCategory(category);
  const documentOrigin=validateOrigin(origin);
  validateFile(file);
  const sha256=await sha256File(file);
  const extension=TYPE_EXTENSIONS.get(file.type);
  const storagePath=`arquivos-clientes/${cliente}/${uniqueId()}.${extension}`;
  const bucket=client.storage.from(BUCKET);
  const {error:uploadError}=await bucket.upload(storagePath,file,{contentType:file.type,upsert:false});
  fail(uploadError,'Não foi possível enviar o documento.');

  let result;
  try{
    result=await client.rpc('bc_client_file_register',{
      p_cliente_id:cliente,
      p_title:documentTitle,
      p_category:documentCategory,
      p_origin:documentOrigin,
      p_document_date:optional(documentDate),
      p_storage_path:storagePath,
      p_mime_type:file.type,
      p_size_bytes:file.size,
      p_sha256:sha256,
    });
    fail(result?.error,'O arquivo foi enviado, mas não foi possível registrá-lo na Pasta da Cliente.');
  }catch(error){
    try{await bucket.remove([storagePath]);}catch{}
    throw error;
  }

  return {id:result?.data,storagePath};
}

export async function getClientFileUrl({client,storagePath,downloadFilename=null,expiresIn=300}){
  ensureClient(client);
  const path=required(storagePath,'Caminho do arquivo');
  if(!Number.isInteger(expiresIn)||expiresIn<30||expiresIn>3600)throw new Error('Validade da URL assinada inválida.');
  const options=downloadFilename?{download:required(downloadFilename,'Nome do arquivo')}:undefined;
  const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,expiresIn,options);
  fail(error,'Não foi possível preparar o download do documento.');
  const url=data?.signedUrl||data?.signedURL;
  if(!url)throw new Error('URL assinada do documento não foi retornada.');
  return url;
}

export async function voidClientFile({client,fileId,reason}){
  ensureClient(client);
  const {data,error}=await client.rpc('bc_client_file_void',{
    p_file_id:required(fileId,'Documento'),
    p_reason:required(reason,'Motivo'),
  });
  fail(error,'Não foi possível anular o documento.');
  return data;
}

export {
  BUCKET as CLIENT_FILES_BUCKET,
  MAX_BYTES as CLIENT_FILES_MAX_BYTES,
};
