import { createPublicAgendaHandler } from './index.ts';

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const origin='https://bcesteticaavancada.github.io';
const procedureId='a1000000-0000-4000-8000-000000000006';
const professionalId='a1000000-0000-4000-8000-000000000003';
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function request(payload: unknown, method='POST', site=origin) {
  return new Request('http://localhost/public-agenda',{method,headers:{origin:site,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(payload)}:{})});
}
Deno.test('HTTP público valida método, origem, payload e indisponibilidade sem consultar dados', async () => {
  const handler=createPublicAgendaHandler(()=>null);
  equal((await handler(request(null,'OPTIONS'))).status,204);
  equal((await handler(request(null,'GET'))).status,405);
  equal((await handler(request(null,'OPTIONS','https://example.invalid'))).status,403);
  equal((await handler(request({action:'list-clients'}))).status,422);
  equal((await handler(request({action:'catalog'}))).status,503);
});
Deno.test('catálogo HTTP retorna somente id, nome e duração', async () => {
  const handler=createPublicAgendaHandler(()=>({rpc:async()=>({data:[{id:procedureId,name:'Teste',duration:30,client_name:'NUNCA',internal_note:'NUNCA'}],error:null})}));
  const response=await handler(request({action:'catalog'}));
  equal(response.status,200);
  equal(await response.json(),{procedures:[{id:procedureId,name:'Teste',durationMinutes:30}]});
  equal(response.headers.get('Cache-Control'),'no-store');
});
Deno.test('overview HTTP consulta um mês e retorna somente disponibilidade diária', async () => {
  const calls: unknown[]=[];
  const handler=createPublicAgendaHandler(()=>({rpc:async(name: string,args?: Record<string,unknown>)=>{
    calls.push([name,args]);
    return {data:[{date:'2027-10-01',available:true,patient_name:'NUNCA',professional_user_id:'NUNCA',reason:'NUNCA'}],error:null};
  }}));
  const response=await handler(request({action:'overview',month:'2027-10'}));
  equal(response.status,200);
  equal(await response.json(),{month:'2027-10',days:[{date:'2027-10-01',available:true,state:'available'}]});
  equal(calls,[['bc_public_agenda_overview',{p_month:'2027-10-01'}]]);
  equal(response.headers.get('Cache-Control'),'no-store');
});
for(const [code,status] of [['23P01',409],['53300',429],['22023',422],['XX000',500]] as const) {
  Deno.test(`reserva HTTP traduz erro ${code} sem expor conteúdo interno`,async()=>{
    Deno.env.set('PUBLIC_AGENDA_RATE_LIMIT_SALT','fictitious-ci-salt-0000000000');
    const handler=createPublicAgendaHandler(()=>({rpc:async(name: string)=>({error:null,data:
      name==='bc_public_agenda_catalog'?[{id:procedureId,name:'Teste',duration:30}]:
      name==='bc_public_agenda_professionals'?[{id:professionalId,name:'Profissional CI'}]:
      {error_code:code,error:'NUNCA_EXPOR_DETALHE_INTERNO'}})}));
    const response=await handler(request({action:'book',procedureId,professionalId,date,time:'23:45',name:'Pessoa Fictícia',phone:'31900000000'}));
    equal(response.status,status);
    const body=JSON.stringify(await response.json());
    if(body.includes('NUNCA'))throw Error('Internal error leaked');
  });
}
