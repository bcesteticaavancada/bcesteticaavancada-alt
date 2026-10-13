import test from 'node:test';
import assert from 'node:assert/strict';
import { generateClinicalPdf } from '../../gestao/js/clinical-documents-api.js';

test('gera PDF clínico 6C pela Edge Function dedicada', async()=>{
  const calls=[];
  const client={functions:{async invoke(name,options){calls.push([name,options]);return {data:{ok:true},error:null};}}};
  const result=await generateClinicalPdf({client,documentId:'doc-1'});
  assert.equal(result.ok,true);
  assert.deepEqual(calls,[['generate-clinical-pdf',{body:{documentId:'doc-1'}}]]);
});
