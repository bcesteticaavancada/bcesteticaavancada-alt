import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import * as api from '../../gestao/js/agenda-api.js';
test('internal procedure list queries the selected professional, excluding unauthorized alternatives',async()=>{
 assert.equal(typeof api.listEligibleProcedures,'function');let call;
 const client={rpc:async(name,args)=>{call={name,args};return {data:[{id:'allowed',nome:'Liberado'}]};}};
 assert.deepEqual(await api.listEligibleProcedures({client,professionalUserId:'katia'}),[{id:'allowed',nome:'Liberado'}]);
 assert.deepEqual(call,{name:'bc_agenda_eligible_procedures',args:{p_professional_user_id:'katia'}});
 await assert.rejects(()=>api.listEligibleProcedures({client,professionalUserId:''}),/profissional/i);
});
