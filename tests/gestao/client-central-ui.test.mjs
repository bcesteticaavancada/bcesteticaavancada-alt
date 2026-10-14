import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderClientFolder} from '../../gestao/js/clientes-folder.js';

const client={id:'c1',nome:'Cliente Teste',cpf:'12345678900',data_nascimento:'1990-10-12',telefone:'31999999999',ativo:true};

test('Central expõe ações rápidas e as cinco áreas clínicas aprovadas',()=>{
  const html=renderClientFolder({client,history:[],canArchive:false});
  for(const action of ['data-client-new-treatment','data-client-schedule','data-client-upload-document','data-client-edit-cadastro']) assert.match(html,new RegExp(action));
  for(const tab of ['resumo','atendimentos','anamnese','fotos','documentos']){
    assert.match(html,new RegExp(`data-folder-tab=["']${tab}["']`));
    assert.match(html,new RegExp(`data-folder-panel=["']${tab}["']`));
  }
  assert.match(html,/data-client-cadastro-panel/);
});

test('Central mantém alertas e checklist no Resumo e foto/galeria na aba Fotos',()=>{
  const html=renderClientFolder({client:{...client,foto_identificacao_id:'p1'},history:[],photoHistory:[{id:'p1',atual:true,created_at:'2026-10-12T12:00:00Z',url:''}],clinicalAlerts:[{id:'a1',level:'atencao',description:'Alerta fictício'}]});
  assert.match(html,/data-folder-panel=["']resumo["'][\s\S]*Alerta fictício/i);
  assert.match(html,/data-folder-panel=["']fotos["'][\s\S]*data-client-photo-input=["']camera["']/i);
  assert.match(html,/data-folder-panel=["']fotos["'][\s\S]*data-client-photo-input=["']gallery["']/i);
});

test('runtime clínico hidrata documentos e atendimentos por seção, não no carregamento inicial',async()=>{
  const source=await readFile(new URL('../../gestao/js/clinical-folder-runtime.js',import.meta.url),'utf8');
  assert.match(source,/bc:folder-tab-change/);
  assert.match(source,/section\s*===\s*['"]documentos['"]/);
  assert.match(source,/section\s*===\s*['"]atendimentos['"]/);
});

test('contratos HTML existentes da área Clientes permanecem intactos',async()=>{
  for(const path of ['../../gestao/admin/index.html','../../gestao/colaborador/index.html']){
    const html=await readFile(new URL(path,import.meta.url),'utf8');
    for(const id of ['clientsSearch','clientsList','clientCreateForm','clientEditor','clientHistoryTimeline']) assert.match(html,new RegExp(`id=["']${id}["']`));
  }
});
