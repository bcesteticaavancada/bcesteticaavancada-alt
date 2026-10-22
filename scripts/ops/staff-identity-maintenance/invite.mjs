// One-use official invitation, gated by a completed identity separation task.
const REDIRECT='https://bcesteticaavancada.github.io/bcesteticaavancada-alt/gestao/redefinir-senha/';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export function createInvitationHandler({taskId,keyHash,expiresAt,clientFactory}){
 if(!/^[a-f0-9]{64}$/.test(keyHash)||!Number.isFinite(expiresAt)||!taskId)throw new Error('Invalid maintenance configuration');
 return async request=>{
  if(Date.now()>expiresAt)return reply(410,{ok:false,code:'maintenance_closed'});
  if(request.method!=='POST')return reply(405,{ok:false,code:'method_not_allowed'});
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')||header.length>200||await digest(header.slice(7))!==keyHash)return reply(401,{ok:false,code:'unauthorized'});
  let client,task,claimed=false,stage='read_task';
  try{
   client=clientFactory();
   const loaded=await client.from('audit_log').select('id,action,new_data').eq('id',taskId).maybeSingle();
   if(loaded.error)throw new Error('task_read');task=loaded.data;
   if(!task||task.action!=='staff_creation_invite_planned')return reply(409,{ok:false,code:'task_not_pending'});
   const job=task.new_data;
   if(!job?.email||!job.display_name||job.role!=='admin_criacao'||!job.predecessor_task_id)return reply(409,{ok:false,code:'invalid_task'});
   const previous=await client.from('audit_log').select('action,new_data').eq('id',job.predecessor_task_id).maybeSingle();
   if(previous.error)throw new Error('predecessor_read');
   if(previous.data?.action!=='staff_identity_reassigned'||previous.data.new_data?.old_email!==job.email||!previous.data.new_data?.user_id)return reply(409,{ok:false,code:'separation_incomplete'});
   stage='claim';
   const claim=await client.from('audit_log').update({action:'staff_creation_invite_running'}).eq('id',taskId).eq('action','staff_creation_invite_planned').select('id').maybeSingle();
   if(claim.error)throw new Error('claim_failed');
   if(!claim.data)return reply(409,{ok:false,code:'already_claimed'});claimed=true;
   stage='invite';
   const invited=await client.auth.admin.inviteUserByEmail(job.email,{redirectTo:REDIRECT,data:{display_name:job.display_name}});
   if(invited.error)throw new Error('invite_failed');
   const user=invited.data.user;
   if(!user?.id||user.id===previous.data.new_data.user_id||user.email?.toLowerCase()!==job.email.toLowerCase())throw new Error('identity_mismatch');
   stage='audit';
   const written=await client.from('audit_log').update({action:'staff_creation_invited',new_data:{...job,user_id:user.id,invitation_requested:true,completed_at:new Date().toISOString()}}).eq('id',taskId);
   if(written.error)throw new Error('audit_failed');
   return reply(200,{ok:true,user_id:user.id,invitation_requested:true});
  }catch{
   if(claimed)try{await client.from('audit_log').update({action:'staff_creation_invite_failed',new_data:{...task.new_data,failed_stage:stage,failed_at:new Date().toISOString()}}).eq('id',taskId);}catch{}
   return reply(500,{ok:false,code:'maintenance_failed',stage});
  }
 };
}
