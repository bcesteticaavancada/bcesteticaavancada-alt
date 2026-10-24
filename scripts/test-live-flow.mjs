// Explicitly invoked, one-run production QA with a wholly fictional identity.
// Credentials remain in a private caller-supplied file; no service key is used.
// Financial mutations are deliberately excluded: the SQL rehearsal rolls them back.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../gestao/js/config.js';
import {getCurrentProfile} from '../gestao/js/auth.js';
import {createClientV2,updateClientV2,getClient,setClientActive,findPotentialDuplicates} from '../gestao/js/clientes-api.js';
import {getFinanceOverview,getFinanceReport,getOwnFinance} from '../gestao/js/finance-simple-api.js';
import {financeReportCsv,financeReportPdf} from '../gestao/js/finance-report.js';
import {initAdminFinance} from '../gestao/js/admin-finance.js';
import {initCollaboratorFinance} from '../gestao/js/colaborador-finance.js';
import {testReportPath,assertOwnTestClient,assertOwnTestDocument} from './live-flow-guards.mjs';
import {uploadClientFile,getClientFileUrl} from '../gestao/js/client-files-api.js';
import {uploadClinicalSignature,generateClinicalPdf,getClinicalDocumentUrl} from '../gestao/js/clinical-documents-api.js';
import {dirname,join} from 'node:path';

const [identityPath,sdkPath,phase='admin']=process.argv.slice(2);
assert.ok(identityPath&&sdkPath,'Pass private identity file, downloaded SDK and phase explicitly.');
const identity=JSON.parse(await readFile(identityPath,'utf8'));
assert.match(identity.email,/@example\.invalid$/);
assert.ok(identity.session?.access_token&&identity.user_id&&identity.run_id);
const {createClient}=Function((await readFile(sdkPath,'utf8'))+';return supabase;')();
const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const {error:sessionError}=await client.auth.setSession(identity.session);if(sessionError)throw sessionError;
const {data:userData,error:userError}=await client.auth.getUser();if(userError)throw userError;
assert.equal(userData.user.id,identity.user_id);
assert.equal(userData.user.app_metadata.test_run_id,identity.run_id);
const reportPath=testReportPath(identityPath);
let report;try{report=JSON.parse(await readFile(reportPath,'utf8'));}catch{report={classification:'TESTE DE FLUXO',run_id:identity.run_id,checks:[],fixtures:{}};}
let failures=0;
async function check(name,fn){try{await fn();report.checks.push({name,phase,result:'pass'});console.log('PASS',phase,name);}catch(e){failures++;report.checks.push({name,phase,result:'fail',message:e.message,code:e.code});console.error('FAIL',phase,name,e.code||'',e.message);}finally{await writeFile(reportPath,JSON.stringify(report,null,2),{mode:0o600});}}
async function rpc(name,payload={}){const {data,error}=await client.rpc(name,payload);if(error)throw Object.assign(Error(error.message),{code:error.code});return data;}
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const profile=await getCurrentProfile(client);
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
const memoryStorage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
async function ownTestClient(){const {data,error}=await client.from('clientes').select('id,nome,email,created_by').eq('id',identity.fixture_client_id).single();if(error)throw error;return assertOwnTestClient(identity,data);}
async function ownTestDocument(){const {data,error}=await client.from('clinical_documents').select('id,cliente_id,profissional_user_id,document_type,status').eq('id',identity.fixture_document_id).eq('cliente_id',identity.fixture_client_id).single();if(error)throw error;return assertOwnTestDocument(identity,data);}

if(phase==='admin'){
 assert.equal(profile?.role,'admin');assert.match(profile.display_name,/^TESTE DE FLUXO/);
 await check('login real e perfil temporário',async()=>assert.equal(profile.user_id,identity.user_id));
 await check('criar cliente mínimo e editar cadastro',async()=>{
  if(!identity.fixture_client_id){identity.fixture_client_id=await createClientV2({client,payload:{nome:'TESTE DE FLUXO '+identity.run_id.slice(0,8),telefone:'31000000000',email:'cliente-fluxo@example.invalid'}});await writeFile(identityPath,JSON.stringify(identity),{mode:0o600});}
  await ownTestClient();
  await updateClientV2({client,clienteId:identity.fixture_client_id,payload:{nome:'TESTE DE FLUXO '+identity.run_id.slice(0,8)+' — cadastro revisado',telefone:'31000000000',email:'cliente-fluxo@example.invalid'}});
  const c=await getClient({client,clienteId:identity.fixture_client_id});assert.match(c.nome,/^TESTE DE FLUXO/);report.fixtures.client=c;
  const dup=await findPotentialDuplicates({client,nome:c.nome,telefone:c.telefone});assert.ok(Array.isArray(dup));
 });
 assert.ok(identity.fixture_client_id,'Client fixture must exist before testing dependent areas.');
 await check('agenda, disponibilidade e biblioteca respondem',async()=>{
  const {error}=await client.from('agendamentos').select('id').gte('inicio',today+'T00:00:00-03:00').limit(2);if(error)throw error;
  assert.ok(Array.isArray(await rpc('bc_staff_directory')));
  assert.ok(await rpc('bc_schedule_month_get',{p_professional_user_id:identity.user_id,p_month:today.slice(0,7)+'-01'}));
  const {error:e}=await client.from('procedimentos').select('id').eq('ativo',true).limit(2);if(e)throw e;
 });
 await check('prontuário, alertas e documentos do cliente fictício',async()=>{
  for(const [name,p]of [
   ['bc_anamnese_state',{p_cliente_id:identity.fixture_client_id}],
   ['bc_anamnese_versions',{p_cliente_id:identity.fixture_client_id}],
   ['bc_treatment_list_client',{p_cliente_id:identity.fixture_client_id}],
   ['bc_clinical_alert_list',{p_cliente_id:identity.fixture_client_id,p_active_only:true}],
   ['bc_client_document_feed',{p_cliente_id:identity.fixture_client_id}],
   ['bc_clinical_document_list',{p_cliente_id:identity.fixture_client_id}],
  ])assert.notEqual(await rpc(name,p),undefined);
 });
 await check('pré-anamneses, produtos e equipamentos',async()=>{
  for(const [name,p]of [['bc_pre_anamnese_inbox_page',{p_limit:10,p_offset:0}],['bc_clinical_product_list',{p_include_inactive:false}],['bc_clinical_equipment_list',{p_include_inactive:false}]])assert.notEqual(await rpc(name,p),undefined);
 });
 await check('caixa, PDF e CSV compartilham o mesmo resultado real',async()=>{
  const overview=await getFinanceOverview({client,from:today,to:today}),data=await getFinanceReport({client,from:today,to:today});
  assert.deepEqual(overview.totals,data.totals);report.baseline_totals=data.totals;
  assert.ok(financeReportCsv(data).startsWith('\uFEFF'));assert.ok(financeReportPdf(data).length>500);
  const {document}=parseHTML(await readFile(new URL('../gestao/admin/index.html',import.meta.url),'utf8'));
  await initAdminFinance({client,profile,root:document,storage:memoryStorage()});
  assert.match(document.getElementById('adminFinanceStatus').textContent,/atualizado/i);
 });
 await check('arquivar e reativar somente o cliente fictício',async()=>{await ownTestClient();await setClientActive({client,clienteId:identity.fixture_client_id,active:false});assert.equal((await getClient({client,clienteId:identity.fixture_client_id})).ativo,false);await ownTestClient();await setClientActive({client,clienteId:identity.fixture_client_id,active:true});});
}else if(phase==='files'){
 assert.equal(profile?.role,'admin');await ownTestClient();
 await check('upload, registro, URL privada e download de PDF fictício',async()=>{
  if(!identity.fixture_file_id){const bytes=financeReportPdf({clinic:'TESTE DE FLUXO — SEM VALIDADE CLINICA',from:today,to:today,generated_at:new Date().toISOString(),rows:[],totals:{income:0,expense:0,balance:0}});const file=new File([bytes],'TESTE-DE-FLUXO.pdf',{type:'application/pdf'});const uploaded=await uploadClientFile({client,clienteId:identity.fixture_client_id,file,title:'TESTE DE FLUXO — TCLE fictício sem validade clínica',category:'tcle_externo',origin:'upload_manual'});identity.fixture_file_id=uploaded.id;identity.fixture_file_path=uploaded.storagePath;await writeFile(identityPath,JSON.stringify(identity),{mode:0o600});}
  assert.ok(identity.fixture_file_path.startsWith('arquivos-clientes/'+identity.fixture_client_id+'/'));
  const url=await getClientFileUrl({client,storagePath:identity.fixture_file_path,expiresIn:30});const response=await fetch(url);assert.equal(response.status,200);const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');report.fixtures.external_file={id:identity.fixture_file_id,path:identity.fixture_file_path,bytes:bytes.length};
 });
}else if(phase==='signature'){
 assert.equal(profile?.role,'admin');await ownTestClient();
 await check('upload privado de assinatura gráfica TESTE DE FLUXO',async()=>{
  const doc=await ownTestDocument();assert.equal(doc.status,'aguardando_assinaturas');
  if(!identity.fixture_signature_path){const bytes=await readFile(join(dirname(identityPath),'test-signature.png'));const file=new Blob([bytes],{type:'image/png'});identity.fixture_signature_path=await uploadClinicalSignature({client,documentId:identity.fixture_document_id,signerKind:'profissional',file});identity.fixture_signature_sha=await crypto.subtle.digest('SHA-256',bytes).then(b=>Buffer.from(b).toString('hex'));await writeFile(identityPath,JSON.stringify(identity),{mode:0o600});}
  report.fixtures.signature={path:identity.fixture_signature_path,sha256:identity.fixture_signature_sha};
 });
}else if(phase==='clinical_pdf'){
 assert.equal(profile?.role,'admin');await ownTestClient();
 await check('gerador publicado, download privado e repetição do PDF clínico',async()=>{
  await ownTestDocument();
  const first=await generateClinicalPdf({client,documentId:identity.fixture_document_id});assert.equal(first.status,'emitido');
  const again=await generateClinicalPdf({client,documentId:identity.fixture_document_id});assert.equal(again.storagePath,first.storagePath);assert.equal(again.idempotent,true);
  const url=await getClinicalDocumentUrl({client,storagePath:first.storagePath,expiresIn:30});const response=await fetch(url);assert.equal(response.status,200);const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');await writeFile(join(dirname(identityPath),'test-clinical.pdf'),bytes,{mode:0o600});report.fixtures.clinical_pdf={document_id:identity.fixture_document_id,path:first.storagePath,bytes:bytes.length,sha256:first.sha256};
 });
}else if(phase==='colaborador'){
 assert.equal(profile?.role,'colaborador');
 await check('colaboradora lê comissão própria e não o caixa geral',async()=>{
  const own=await getOwnFinance({client,from:today,to:today});assert.equal(Number(own.pending_total),0);
  await denied(()=>getFinanceOverview({client,from:today,to:today}));await denied(()=>getFinanceReport({client,from:today,to:today}));
  const {document}=parseHTML(await readFile(new URL('../gestao/colaborador/index.html',import.meta.url),'utf8'));await initCollaboratorFinance({client,profile,root:document});assert.match(document.getElementById('collaboratorFinanceStatus').textContent,/atualizada/i);
 });
 await check('cadastro compartilhado e agenda própria acessíveis',async()=>{assert.match((await getClient({client,clienteId:identity.fixture_client_id})).nome,/^TESTE DE FLUXO/);assert.ok(Array.isArray(await rpc('bc_staff_directory')));});
}else if(phase==='admin_criacao'){
 assert.equal(profile?.role,'admin_criacao');
 await check('criação consulta suas áreas sem dados financeiros',async()=>{
  for(const section of ['agenda','clientes','equipe','procedimentos','atendimentos','anamneses','preanamneses','documentos','alertas','produtos','equipamentos','auditoria']){const d=await rpc('bc_creation_list',{p_section:section,p_offset:0,p_search:'TESTE DE FLUXO',p_cliente_id:null});assert.ok(Array.isArray(d.rows));}
  await denied(()=>getFinanceOverview({client,from:today,to:today}));await denied(()=>getOwnFinance({client,from:today,to:today}));await denied(()=>getFinanceReport({client,from:today,to:today}));
  await denied(()=>rpc('bc_clinical_product_list',{p_include_inactive:false}));await denied(()=>rpc('bc_clinical_equipment_list',{p_include_inactive:false}));
  const {data,error}=await client.from('clientes').select('id').eq('id',identity.fixture_client_id);assert.ok(error||data.length===0);
 });
}else if(phase==='inactive'){
 assert.equal(profile,null);
 await check('token antigo perde acesso ao desativar o perfil',async()=>{await denied(()=>getOwnFinance({client,from:today,to:today}));await denied(()=>getFinanceOverview({client,from:today,to:today}));await denied(()=>rpc('bc_clinical_product_list',{p_include_inactive:false}));await denied(()=>rpc('bc_clinical_equipment_list',{p_include_inactive:false}));const {data,error}=await client.from('clientes').select('id').eq('id',identity.fixture_client_id);assert.ok(error||data.length===0);});
}else throw Error('Unknown phase');
await client.removeAllChannels();console.log('RESULT',phase,'completed; failures:',failures);process.exitCode=failures?1:0;
