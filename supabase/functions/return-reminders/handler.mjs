const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function createReturnReminderHandler({service,sendNotification}){
 return async req=>{
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  const secret=req.headers.get('x-bc-reminder-key');if(!secret||secret.length>256)return reply(401,{error:'unauthorized'});
  const config=await service.rpc('bc_return_push_worker_config',{p_secret:secret});
  if(config.error||!config.data)return reply(401,{error:'unauthorized'});
  const claimed=await service.rpc('bc_return_push_claim');if(claimed.error)return reply(503,{error:'queue_unavailable'});
  let delivered=0,failed=0;
  for(const job of claimed.data||[]){
   let outcome='delivered';
   try{
    // Recheck after claim so a cancelled/revised reminder is not sent by a stale worker.
    const valid=await service.rpc('bc_return_push_is_current',{p_delivery_id:job.id,p_claim_token:job.claim_token});
    if(valid.error)throw Error('queue_revalidation_unavailable');
    if(valid.data!==true){outcome='cancelled';}
    else await sendNotification(job.subscription,JSON.stringify({title:'BC Gestão — retorno',body:'Você tem um lembrete de retorno. Abra a gestão para conferir.'}),{TTL:3600,timeout:10000,vapidDetails:{subject:'mailto:mluisafdeassis@gmail.com',publicKey:config.data.public_key,privateKey:config.data.private_key}});
   }catch(error){outcome=[404,410].includes(error?.statusCode)?'expired':'retry';}
   const finished=await service.rpc('bc_return_push_finish',{p_delivery_id:job.id,p_claim_token:job.claim_token,p_outcome:outcome});
   if(outcome==='delivered'&&!finished.error)delivered++;else failed++;
  }
  return reply(200,{processed:(claimed.data||[]).length,delivered,failed});
 };
}
