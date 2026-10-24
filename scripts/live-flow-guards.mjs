import assert from 'node:assert/strict';
import {resolve,dirname,join} from 'node:path';

export function testReportPath(identityPath){
 const identity=resolve(identityPath),report=join(dirname(identity),'api-results.json');
 assert.notEqual(report,identity,'Report must never overwrite the private identity file.');
 return report;
}

export function assertOwnTestClient(identity,record){
 assert.ok(identity?.run_id&&identity?.user_id&&identity?.fixture_client_id,'Test identity is incomplete.');
 const base='TESTE DE FLUXO '+identity.run_id.slice(0,8);
 assert.ok(record&&record.id===identity.fixture_client_id&&record.created_by===identity.user_id
  &&[base,base+' — cadastro revisado'].includes(record.nome)&&record.email==='cliente-fluxo@example.invalid',
 'Refusing to mutate a client that is not the exact fixture for this test run.');
 return record;
}

export function assertOwnTestDocument(identity,record){
 assert.ok(identity?.user_id&&identity?.fixture_client_id&&identity?.fixture_document_id,'Test document identity is incomplete.');
 assert.ok(record&&record.id===identity.fixture_document_id&&record.cliente_id===identity.fixture_client_id
  &&record.profissional_user_id===identity.user_id&&record.document_type==='treatment_record',
 'Refusing to mutate a document outside this fictional client and author.');
 return record;
}
