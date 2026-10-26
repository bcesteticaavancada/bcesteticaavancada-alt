import test from 'node:test';
import assert from 'node:assert/strict';
test('Auditoria de contas recusa produção antes de qualquer requisição',async()=>{
 let module;try{module=await import('../../scripts/test-auth-rls-audit.mjs');}catch{}
 assert.ok(module,'Rotina isolada de auditoria disponível');
 for(const url of ['https://tpqsmerlxquyrzrjbogj.supabase.co','https://localhost:54321','http://127.0.0.1.evil.example:54321','http://user:password@localhost:54321','http://localhost:54321/other']){
  assert.throws(()=>module.validateAuditConfig({API_URL:url,ANON_KEY:'test',SERVICE_ROLE_KEY:'test'}),/local isolado/);
 }
});
test('Auditoria aceita somente configuração local completa e sem credenciais na URL',async()=>{
 let module;try{module=await import('../../scripts/test-auth-rls-audit.mjs');}catch{}
 assert.ok(module,'Rotina isolada de auditoria disponível');
 assert.throws(()=>module.validateAuditConfig({API_URL:'http://127.0.0.1:54321'}),/incompleta/);
 const result=module.validateAuditConfig({API_URL:'http://127.0.0.1:54321',ANON_KEY:'public-test',SERVICE_ROLE_KEY:'server-test'});
 assert.equal(result.url,'http://127.0.0.1:54321');
});
