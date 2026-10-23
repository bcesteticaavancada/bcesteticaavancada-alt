import test from 'node:test';
import assert from 'node:assert/strict';
import {initAdminAgenda} from '../../gestao/js/admin-agenda.js';

function fixture() {
  const ids=['adminAgendaOriginFilter','adminAgendaDate','adminAgendaProfessionalFilter','adminAgendaList','adminAgendaStatus','appointmentForm','appointmentClient','appointmentCollaborator','appointmentProcedure','adminAppointmentEditForm','adminEditProfessional','adminEditProcedure','adminEditStart','adminEditEnd','adminEditNote'];
  const nodes=new Map(ids.map(id=>[id,{value:'',dataset:{},innerHTML:'',events:{},querySelectorAll(){return [];},addEventListener(type,fn){this.events[type]=fn;}}]));
  nodes.get('adminAgendaDate').value='2026-10-16';nodes.get('adminAgendaOriginFilter').value='all';
  const pending=new Map();
  const client={from(){return {select(){return this;},eq(){return this;},order(){return Promise.resolve({data:[],error:null});}};},rpc(name,args){
    if(name==='bc_staff_directory'||args.p_origin==='all')return Promise.resolve({data:[],error:null});
    return new Promise(resolve=>pending.set(args.p_origin,resolve));
  }};
  return {nodes,pending,client,root:{getElementById:id=>nodes.get(id)||null}};
}
const appointment=(id,channel)=>({id,booking_channel:channel,colaboradora_user_id:'p',inicio:'2026-10-16T12:00:00Z',status:'agendado',public_booking_name:id});

for(const staleError of [false,true])test(`filtro ignora ${staleError?'erro':'resposta'} de requisição ultrapassada`,async()=>{
  const {nodes,pending,client,root}=fixture();
  await assert.rejects(initAdminAgenda({client,profile:{user_id:'reviewer'},root}),/Área de agenda administrativa/);
  // Only the unrelated availability panel is absent; real agenda listeners exist.
  const filter=nodes.get('adminAgendaOriginFilter');
  filter.value='site';const old=filter.events.change().catch(()=>{});
  filter.value='internal';const latest=filter.events.change();
  pending.get('internal')({data:[appointment('INTERNAL_ROW','internal')],error:null});await latest;
  pending.get('site')(staleError?{data:null,error:{message:'STALE_ERROR'}}:{data:[appointment('SITE_ROW','site')],error:null});await old;
  assert.match(nodes.get('adminAgendaList').innerHTML,/INTERNAL_ROW/);
  assert.doesNotMatch(nodes.get('adminAgendaList').innerHTML,/SITE_ROW/);
  assert.doesNotMatch(nodes.get('adminAgendaStatus').textContent,/STALE_ERROR/);
});
