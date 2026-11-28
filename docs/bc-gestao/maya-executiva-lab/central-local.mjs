import {canReadCash,createHandler} from '../../../supabase/functions/bc-central/handler.mjs';
import {clinicTimestamp} from './store.mjs';

// Only the Central's cash action is exposed here. Its local adapters share the
// same private database and server-side session as the Maya confirmation routes.
export function createLocalCash({origin,store,sessionFor,clock}){
 const {db}=store;
 const ledger={
  begin(actor,key){
   return store.transaction(()=>{
    const profile=store.profile(actor);
    if(!canReadCash(profile))throw Error('Perfil sem acesso ao caixa.');
    const seen=db.prepare("SELECT actor FROM audit WHERE op=? AND kind='caixa' AND event='iniciada'").get(key);
    if(seen)return {state:'conflito'};
    const recent=db.prepare("SELECT count(*) AS n FROM audit WHERE actor=? AND kind='caixa' AND event='iniciada' AND at>?").get(actor,clock()-60_000);
    if(recent.n>=20)return {state:'limite'};
    store.event(profile,{id:key,tipo:'caixa'},'iniciada');
    return {state:'nova'};
   });
  },
  finish(actor,key,state){
   store.event(store.profile(actor),{id:key,tipo:'caixa'},state);
  }
 };
 const totals=db.prepare(`SELECT
   COALESCE(SUM(CASE WHEN kind='recebimento' AND json_extract(body,'$.data')<=?
     THEN json_extract(body,'$.valor_centavos') ELSE 0 END),0) AS recebido_centavos,
   COALESCE(SUM(CASE WHEN kind='despesa' AND json_extract(body,'$.situacao')='paga'
     AND json_extract(body,'$.pago_em')<=? THEN json_extract(body,'$.valor_centavos') ELSE 0 END),0) AS pago_centavos
   FROM records WHERE kind IN ('recebimento','despesa')`);
 const identify=bearer=>sessionFor(bearer.slice(7));
 const handle=createHandler({origin,enabled:true,identify,ledger,providers:{configured:{}},
  clock:()=>new Date(clock()),cashWindow:now=>({start:null,end:clinicTimestamp(now).slice(0,10)}),
  cash(bearer,period){
   store.authorize(identify(bearer));
   const amounts=totals.get(period.end,period.end);
   const saldo_centavos=amounts.recebido_centavos-amounts.pago_centavos;
   if(!Object.values({...amounts,saldo_centavos}).every(Number.isSafeInteger))throw Error('Total fora do intervalo de inteiros.');
   return {...amounts,saldo_centavos};
  }
 });
 return (sid,key)=>handle(new Request(origin+'/api/cash',{
  method:'POST',headers:{origin,authorization:'Bearer '+sid,'content-type':'application/json'},
  body:JSON.stringify({action:'cash',key})
 }));
}
