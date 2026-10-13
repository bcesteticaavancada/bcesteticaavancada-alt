import test from 'node:test';
import assert from 'node:assert/strict';
import { renderClinicalDocuments } from '../../gestao/js/clinical-folder-runtime.js';

test('documento pronto ou com erro oferece gerar PDF; emitido oferece download',()=>{
  const ready=renderClinicalDocuments([{id:'d1',document_type:'consentimento_procedimento',document_code:'BC-TCLE-1',source_version:1,status:'pronto_para_pdf',storage_path:null}]);
  assert.match(ready,/data-generate-clinical-document=["']d1["']/);
  assert.match(ready,/Gerar PDF/i);
  assert.doesNotMatch(ready,/data-download-clinical-document/);

  const retry=renderClinicalDocuments([{id:'d2',document_type:'treatment_record',document_code:'BC-ATD-1',source_version:1,status:'erro_pdf',storage_path:null}]);
  assert.match(retry,/data-generate-clinical-document=["']d2["']/);
  assert.match(retry,/Tentar gerar PDF/i);

  const emitted=renderClinicalDocuments([{id:'d3',document_type:'treatment_record',document_code:'BC-ATD-2',source_version:2,status:'emitido',storage_path:'documentos/x.pdf'}]);
  assert.match(emitted,/data-download-clinical-document=["']d3["']/);
  assert.doesNotMatch(emitted,/data-generate-clinical-document/);
});

test('documento aguardando assinatura não oferece geração prematura',()=>{
  const html=renderClinicalDocuments([{id:'d4',document_type:'consentimento_procedimento',document_code:'BC-TCLE-2',source_version:1,status:'aguardando_assinaturas'}]);
  assert.doesNotMatch(html,/data-generate-clinical-document|data-download-clinical-document/);
});
