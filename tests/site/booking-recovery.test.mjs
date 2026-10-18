import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicAgendaApi} from '../../agenda/js/api.js';
const payload={procedureId:'p1',professionalId:'s1',date:'2026-10-20',time:'14:00',name:'Pessoa fictícia',phone:'5531900000000'};
test('lost response preserves stable request key; changing booking data creates another key',async()=>{
 const calls=[];let first=true;
 const api=createPublicAgendaApi({fetchImpl:async(_url,options)=>{calls.push(JSON.parse(options.body));if(first){first=false;throw Error('rede');}return {ok:true,json:async()=>({booking:{id:'same'}})};}});
 await assert.rejects(()=>api.book(payload),/rede|reserva|resposta|confirm/i);
 assert.equal((await api.book(payload)).booking.id,'same');
 assert.match(calls[0].requestKey,/^[a-f0-9-]{36}$/);assert.equal(calls[0].requestKey,calls[1].requestKey);
 await api.book({...payload,time:'15:00'});assert.notEqual(calls[2].requestKey,calls[1].requestKey);
});
test('timeout aborts public transport with an explicit uncertain outcome and allows exact retry',async()=>{
 const calls=[];let cancel;
 const api=createPublicAgendaApi({timeoutMs:1,fetchImpl:async(_url,{body,signal})=>{calls.push(JSON.parse(body));await new Promise((_,reject)=>{cancel=()=>reject(new DOMException('Aborted','AbortError'));signal.addEventListener('abort',cancel,{once:true});});}});
 await assert.rejects(()=>api.book(payload),/mesmos dados|mesma reserva/i);assert.equal(calls.length,1);
});
