import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import { buildClinicalPdf } from './pdf.ts';

const BUCKET='bc-prontuario-private';
const ALLOWED_ORIGINS=new Set([
  'https://bcesteticaavancada.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);

function corsHeaders(origin:string|null):HeadersInit{return {
  'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGINS.has(origin)?origin:'https://bcesteticaavancada.github.io',
  'Access-Control-Allow-Headers':'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Expose-Headers':'Content-Disposition',
  'Vary':'Origin',
};}
function json(body:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...corsHeaders(origin)}});}
function isUuid(value:unknown):value is string{return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
async function sha256Hex(bytes:Uint8Array){const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2,'0')).join('');}
async function downloadBytes(supabase:any,path:string|null|undefined){if(!path)return null;const {data,error}=await supabase.storage.from(BUCKET).download(path);if(error||!data)return null;return new Uint8Array(await data.arrayBuffer());}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  if(req.method==='OPTIONS'){
    if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:'Origem não autorizada.'},403,origin);
    return new Response(null,{status:204,headers:corsHeaders(origin)});
  }
  if(req.method!=='POST')return json({error:'Método não permitido.'},405,origin);
  if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:'Origem não autorizada.'},403,origin);

  const authorization=req.headers.get('Authorization')||'';
  const token=authorization.startsWith('Bearer ')?authorization.slice(7).trim():'';
  if(!token)return json({error:'Autenticação obrigatória.'},401,origin);

  const url=Deno.env.get('SUPABASE_URL');
  const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
  const serverKey=Deno.env.get(['SUPABASE','SERVICE','ROLE','KEY'].join('_'));
  if(!url||!anonKey||!serverKey)return json({error:'Serviço temporariamente indisponível.'},503,origin);

  const userClient=createClient(url,anonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const service=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
  let documentId:string|null=null;
  try{
    const {data:userData,error:userError}=await userClient.auth.getUser(token);
    const user=userData?.user;
    if(userError||!user?.id)return json({error:'Sessão inválida.'},401,origin);
    const {data:staff,error:staffError}=await service.from('staff_profiles').select('user_id,role,active').eq('user_id',user.id).maybeSingle();
    if(staffError)throw staffError;
    if(!staff?.active||!['admin','colaborador'].includes(staff.role))return json({error:'Acesso restrito à equipe clínica ativa.'},403,origin);

    let body:Record<string,unknown>;
    try{body=await req.json();}catch{return json({error:'JSON inválido.'},400,origin);}
    const keys=Object.keys(body||{});
    const externalCopy=keys.length===2&&keys.includes('documentId')&&keys.includes('mode')&&body.mode==='professional_signed_for_external';
    if(!isUuid(body.documentId)||!(externalCopy||(keys.length===1&&keys[0]==='documentId')))return json({error:'Informe um documentId válido e um modo permitido.'},400,origin);
    documentId=body.documentId;

    const {data:document,error:documentError}=await service.from('clinical_documents').select('*').eq('id',documentId).single();
    if(documentError||!document)return json({error:'Documento clínico não encontrado.'},404,origin);
    if(!['consentimento_procedimento','treatment_record'].includes(document.document_type))return json({error:'Tipo de documento não suportado por este gerador.'},409,origin);

    // A cópia intermediária não altera o estado do TCLE e não grava um documento final.
    if(externalCopy){
      if(document.document_type!=='consentimento_procedimento'||document.status!=='aguardando_assinaturas')return json({error:'TCLE fora da etapa de assinatura externa.'},409,origin);
      const {data:consent,error:consentError}=await service.from('procedure_consents').select('*').eq('id',document.source_id).single();
      if(consentError||!consent||consent.status!=='aguardando_assinaturas'||consent.cliente_id!==document.cliente_id)return json({error:'TCLE pendente não encontrado.'},409,origin);
      if(staff.role!=='admin'&&consent.profissional_user_id!==user.id)return json({error:'Apenas a profissional responsável pode baixar esta via.'},403,origin);
      const [clientResult,templateResult,signaturesResult]=await Promise.all([
        service.from('clientes').select('*').eq('id',document.cliente_id).single(),
        service.from('consent_template_versions').select('*').eq('id',consent.consent_template_version_id).single(),
        service.from('clinical_signatures').select('*').eq('document_id',documentId),
      ]);
      if(clientResult.error||templateResult.error||signaturesResult.error)throw clientResult.error||templateResult.error||signaturesResult.error;
      const signed=signaturesResult.data||[];
      const professional=signed.find((item:any)=>item.signer_kind==='profissional');
      if(!professional)return json({error:'A profissional deve assinar no aplicativo antes de baixar o PDF.'},409,origin);
      if(signed.some((item:any)=>item.signer_kind==='paciente'||item.signer_kind==='responsavel'))return json({error:'Já existe assinatura interna da cliente neste documento.'},409,origin);
      const bytes=await downloadBytes(service,professional.storage_path);
      if(!bytes||await sha256Hex(bytes)!==String(professional.sha256||'').trim().toLowerCase())return json({error:'Integridade da assinatura profissional inválida.'},409,origin);
      const pdfBytes=await buildClinicalPdf({document,client:clientResult.data,signatures:[{...professional,bytes}],consent,consentTemplate:templateResult.data,externalSignatureCopy:true});
      return new Response(new Blob([pdfBytes],{type:'application/pdf'}),{
        status:200,
        headers:{...corsHeaders(origin),'Content-Type':'application/pdf','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="BC_TCLE_para_assinatura.pdf"'},
      });
    }
    if(document.status==='emitido'&&document.storage_path)return json({ok:true,documentId,status:'emitido',storagePath:document.storage_path,idempotent:true},200,origin);
    if(!['pronto_para_pdf','erro_pdf'].includes(document.status))return json({error:'Documento ainda não está pronto para geração do PDF.'},409,origin);

    const {data:locked,error:lockError}=await service.from('clinical_documents').update({status:'gerando_pdf'}).eq('id',documentId).in('status',['pronto_para_pdf','erro_pdf']).select('id').maybeSingle();
    if(lockError)throw lockError;
    if(!locked){
      const {data:latest}=await service.from('clinical_documents').select('status,storage_path').eq('id',documentId).maybeSingle();
      if(latest?.status==='emitido'&&latest.storage_path)return json({ok:true,documentId,status:'emitido',storagePath:latest.storage_path,idempotent:true},200,origin);
      return json({error:'O documento está sendo processado por outra solicitação.'},409,origin);
    }

    const [clientResult,signaturesResult]=await Promise.all([
      service.from('clientes').select('*').eq('id',document.cliente_id).single(),
      service.from('clinical_signatures').select('*').eq('document_id',documentId).order('signed_at',{ascending:true}),
    ]);
    if(clientResult.error)throw clientResult.error;
    if(signaturesResult.error)throw signaturesResult.error;

    const signatures=[];
    for(const signature of signaturesResult.data||[]){
      const bytes=await downloadBytes(service,signature.storage_path);
      if(!bytes)throw new Error('Assinatura privada não encontrada.');
      const hash=await sha256Hex(bytes);
      if(hash!==String(signature.sha256||'').trim().toLowerCase())throw new Error('Integridade da assinatura inválida.');
      signatures.push({...signature,bytes});
    }

    let consent=null;
    let consentTemplate=null;
    let treatmentVersion=null;
    if(document.document_type==='consentimento_procedimento'){
      const {data:consentData,error:consentError}=await service.from('procedure_consents').select('*').eq('id',document.source_id).single();
      if(consentError||!consentData)throw consentError||new Error('Consentimento não encontrado.');
      const {data:templateData,error:templateError}=await service.from('consent_template_versions').select('*').eq('id',consentData.consent_template_version_id).single();
      if(templateError||!templateData)throw templateError||new Error('Template de consentimento não encontrado.');
      consent=consentData;consentTemplate=templateData;
    }else{
      const {data:versionData,error:versionError}=await service.from('clinical_treatment_versions').select('*').eq('id',document.source_id).single();
      if(versionError||!versionData)throw versionError||new Error('Versão do atendimento não encontrada.');
      treatmentVersion=versionData;
    }

    const pdfBytes=await buildClinicalPdf({document,client:clientResult.data,signatures,consent,consentTemplate,treatmentVersion});
    const sha256=await sha256Hex(pdfBytes);
    const folder=document.document_type==='consentimento_procedimento'?'consentimentos':'atendimentos';
    const storagePath=`documentos/${folder}/${document.cliente_id}/${document.id}-v${document.document_version}.pdf`;
    const {error:uploadError}=await service.storage.from(BUCKET).upload(storagePath,pdfBytes,{contentType:'application/pdf',upsert:true,cacheControl:'0'});
    if(uploadError)throw uploadError;

    const generatedAt=new Date().toISOString();
    const {error:updateError}=await service.from('clinical_documents').update({status:'emitido',storage_path:storagePath,sha256,generated_at:generatedAt}).eq('id',documentId);
    if(updateError)throw updateError;
    const {error:auditError}=await service.from('audit_log').insert({actor_user_id:user.id,action:'clinical_document_pdf_generated',entity_type:'clinical_documents',entity_id:documentId,new_data:{document_type:document.document_type,storage_path:storagePath,sha256}});
    if(auditError)console.error('audit clinical pdf failed',auditError.message);
    return json({ok:true,documentId,status:'emitido',storagePath,sha256,generatedAt},200,origin);
  }catch(error){
    console.error('generate-clinical-pdf failed',error instanceof Error?error.message:'unknown error');
    if(documentId)await service.from('clinical_documents').update({status:'erro_pdf'}).eq('id',documentId).eq('status','gerando_pdf');
    return json({error:'Não foi possível gerar o PDF agora. O documento e as assinaturas foram preservados para nova tentativa.'},500,origin);
  }
});
