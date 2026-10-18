import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {initAdminAgenda} from '../../gestao/js/admin-agenda.js';
import {initCollaboratorAgenda} from '../../gestao/js/colaborador-agenda.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function fixture(kind){
 const {document,window}=parseHTML(readFileSync(new URL(`../../gestao/${kind}/index.html`,import.meta.url),'utf8'));
 // Supply standard native-select value behavior missing from LinkeDOM.
 Object.defineProperty(Object.getPrototypeOf(document.createElement('select')),'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(o=>o.selected)?.value||'';},set(value){for(const option of this.querySelectorAll('option'))option.selected=option.value===value;}});
 const a={id:'A',colaboradora_user_id:'pro-A',procedimento_id:'p-A',cliente_id:null,inicio:'2026-10-20T12:00:00Z',fim:'2026-10-20T13:00:00Z',status:'agendado',observacao_administrativa:'Reserva A'};
 const b={...a,id:'B',colaboradora_user_id:'pro-B',procedimento_id:'p-B',inicio:'2026-10-20T14:00:00Z',fim:'2026-10-20T15:00:00Z',observacao_administrativa:'Reserva B'};
 let pending=false;const waits={};
 const query={};for(const method of ['select','eq','order','or','limit','in'])query[method]=()=>query;query.then=(yes,no)=>Promise.resolve({data:[],error:null}).then(yes,no);
 const client={from:()=>query,rpc:async(name,args)=>{
  if(name==='bc_staff_directory')return {data:[{user_id:'pro-A',display_name:'Profissional A'},{user_id:'pro-B',display_name:'Profissional B'}]};
  if(name==='bc_agenda_list')return {data:[a,b]};
  if(name==='bc_agenda_eligible_procedures' && pending){const wait=deferred();waits[args.p_professional_user_id]=wait;return wait.promise;}
  if(name==='bc_schedule_month_get')return {data:{days:[],blocks:[],inactivations:[]}};
  return {data:[],error:null};
 }};
 const profile={user_id:'manager',role:'colaborador',pode_gerenciar_agendas:true};
 const controller=await (kind==='admin'?initAdminAgenda:initCollaboratorAgenda)({client,profile,root:document});pending=true;
 return {document,controller,waits};
}
for(const kind of ['admin','colaborador'])test(`${kind}: late opening A cannot replace identity or fields from B`,async()=>{
 const f=await fixture(kind);const open=kind==='admin'?f.controller.openEdit:f.controller.openAppointment;
 const first=open('A'),second=open('B');f.waits['pro-B'].resolve({data:[{id:'p-B',nome:'Procedimento B'}]});await second;
 f.waits['pro-A'].resolve({data:[{id:'p-A',nome:'Procedimento A'}]});await first;
 const target=f.document.getElementById(kind==='admin'?'adminAppointmentEditForm':'appointmentDetail');assert.equal(target.dataset.appointmentId,'B');
 if(kind==='admin')assert.equal(f.document.getElementById('adminEditNote').value,'Reserva B');
 else {assert.match(f.document.getElementById('appointmentDetailContent').innerHTML,/p-B/);assert.equal(f.controller.getCurrentAppointment(),null);}
});
