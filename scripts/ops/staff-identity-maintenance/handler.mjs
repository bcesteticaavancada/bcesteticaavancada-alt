// One-use maintenance handler. Deploy only with a short expiry and a random key hash.
// The live wrapper is retired immediately after the reviewed task. No server keys leave runtime.
const REDIRECT='https://bcesteticaavancada.github.io/bcesteticaavancada-alt/gestao/redefinir-senha/';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
function randomPassword(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('')+'aA1!';}
export function createMaintenanceHandler({taskId,keyHash,expiresAt,clientFactory}){
  if(!/^[a-f0-9]{64}$/.test(keyHash)||!Number.isFinite(expiresAt)||!taskId)throw new Error('Invalid maintenance configuration');
  return async request=>{
    if(Date.now()>expiresAt)return reply(410,{ok:false,code:'maintenance_closed'});
    if(request.method!=='POST')return reply(405,{ok:false,code:'method_not_allowed'});
    const header=request.headers.get('authorization')||'';
    if(!header.startsWith('Bearer ')||header.length>200||await digest(header.slice(7))!==keyHash)return reply(401,{ok:false,code:'unauthorized'});
    let client,task,stage='read_task',claimed=false;
    try{
      client=clientFactory();
      const loaded=await client.from('audit_log').select('id,action,new_data').eq('id',taskId).maybeSingle();
      task=loaded.data;
      if(loaded.error)throw new Error('task_read');
      if(!task||task.action!=='staff_identity_reassign_planned')return reply(409,{ok:false,code:'task_not_pending'});
      const job=task.new_data;
      if(!job?.user_id||!job.display_name||!job.old_email||!job.new_email||job.old_email===job.new_email||job.redirect_to!==REDIRECT)return reply(409,{ok:false,code:'invalid_task'});
      stage='verify_identity';
      const existing=await client.auth.admin.getUserById(job.user_id);
      if(existing.error)throw new Error('identity_read');
      if(existing.data.user?.email?.toLowerCase()!==job.old_email.toLowerCase())return reply(409,{ok:false,code:'identity_changed'});
      const account=existing.data.user;
      const providers=[...(account.app_metadata?.providers||[]),...(account.app_metadata?.provider?[account.app_metadata.provider]:[])];
      if(!Array.isArray(account.identities)||account.identities.length===0||account.identities.some(identity=>identity.provider!=='email')||providers.some(provider=>provider!=='email')||account.phone||account.factors?.length)return reply(409,{ok:false,code:'alternate_sign_in'});
      const staff=await client.from('staff_profiles').select('user_id,display_name,role,active').eq('user_id',job.user_id).maybeSingle();
      if(staff.error)throw new Error('staff_read');
      if(staff.data?.display_name!==job.display_name||staff.data?.role!=='colaborador'||staff.data?.active!==true)return reply(409,{ok:false,code:'staff_changed'});
      stage='claim';
      const claim=await client.from('audit_log').update({action:'staff_identity_reassign_running'}).eq('id',taskId).eq('action','staff_identity_reassign_planned').select('id').maybeSingle();
      if(claim.error)throw new Error('claim_failed');
      if(!claim.data)return reply(409,{ok:false,code:'already_claimed'});
      claimed=true;
      stage='auth_update';
      const changed=await client.auth.admin.updateUserById(job.user_id,{email:job.new_email,password:randomPassword()});
      if(changed.error)throw new Error('auth_update');
      if(changed.data.user?.id!==job.user_id||changed.data.user?.email?.toLowerCase()!==job.new_email.toLowerCase())throw new Error('identity_mismatch');
      stage='recovery';
      const recovery=await client.auth.resetPasswordForEmail(job.new_email,{redirectTo:REDIRECT});
      stage='audit';
      const written=await client.from('audit_log').update({action:'staff_identity_reassigned',new_data:{...job,password_rotated:true,recovery_requested:!recovery.error,completed_at:new Date().toISOString()}}).eq('id',taskId);
      if(written.error)throw new Error('audit_failed');
      return reply(200,{ok:true,user_id:job.user_id,recovery_requested:!recovery.error});
    }catch{
      if(claimed)try{await client.from('audit_log').update({action:'staff_identity_reassign_failed',new_data:{...task.new_data,failed_stage:stage,failed_at:new Date().toISOString()}}).eq('id',taskId);}catch{}
      return reply(500,{ok:false,code:'maintenance_failed',stage});
    }
  };
}
