import test from 'node:test';
import assert from 'node:assert/strict';
import {testReportPath,assertOwnTestClient,assertOwnTestDocument} from '../../scripts/live-flow-guards.mjs';

test('report stays separate from credentials for any identity filename',()=>{
 assert.equal(testReportPath('/tmp/qa/custom-secrets.json'),'/tmp/qa/api-results.json');
 assert.equal(testReportPath('/tmp/qa/identity.json'),'/tmp/qa/api-results.json');
 assert.throws(()=>testReportPath('/tmp/qa/api-results.json'),/never overwrite/);
});
test('PDF and signature actions require the exact fictional client and author',()=>{
 const identity={user_id:'test-user',fixture_client_id:'test-client',fixture_document_id:'test-document'};
 const valid={id:'test-document',cliente_id:'test-client',profissional_user_id:'test-user',document_type:'treatment_record'};
 assert.equal(assertOwnTestDocument(identity,valid),valid);
 for(const record of [null,{...valid,id:'real-document'},{...valid,cliente_id:'real-client'},{...valid,profissional_user_id:'real-author'},{...valid,document_type:'anamnese_geral'}])assert.throws(()=>assertOwnTestDocument(identity,record),/Refusing/);
});
test('a stale client ID or mismatched run never passes the mutation guard',()=>{
 const identity={run_id:'12345678-current',user_id:'test-user',fixture_client_id:'client-test'};
 const valid={id:'client-test',created_by:'test-user',nome:'TESTE DE FLUXO 12345678',email:'cliente-fluxo@example.invalid'};
 assert.equal(assertOwnTestClient(identity,valid),valid);
 assert.doesNotThrow(()=>assertOwnTestClient(identity,{...valid,nome:valid.nome+' — cadastro revisado'}));
 for(const record of [null,{...valid,id:'real-client'},{...valid,created_by:'real-user'},{...valid,nome:'Cliente real'},{...valid,nome:'TESTE DE FLUXO previous'},{...valid,email:'real@example.com'}])assert.throws(()=>assertOwnTestClient(identity,record),/Refusing/);
});
