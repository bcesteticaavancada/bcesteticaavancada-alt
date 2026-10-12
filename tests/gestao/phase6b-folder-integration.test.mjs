import test from 'node:test';
import assert from 'node:assert/strict';
import { renderClientFolder } from '../../gestao/js/clientes-folder.js';

const client = { id: 'c1', nome: 'Cliente Teste', cpf: '12345678900', data_nascimento: '1990-10-12', telefone: '31999999999', ativo: true };

test('Pasta da Cliente expõe abas Anamnese e Documentos com dados 6B sem misturar financeiro', () => {
  const html = renderClientFolder({
    client,
    history: [],
    anamneseState: { id: 'a1', version: 1, status: 'finalizada', valid_until: '2027-10-12T12:00:00Z' },
    anamneseVersions: [{ id: 'a1', version: 1, status: 'finalizada' }],
    clinicalAlerts: [{ id: 'al1', level: 'critico', description: 'Alergia informada: látex' }],
    clinicalDocuments: [{ id: 'd1', source_version: 1, document_code: 'BC-ANM-TESTE', status: 'emitido', storage_path: 'documentos/anamnese/d1.pdf' }],
  });
  assert.match(html, /data-folder-tab=["']anamnese["']/);
  assert.match(html, /data-folder-tab=["']documentos["']/);
  assert.match(html, /Alergia informada: látex/i);
  assert.match(html, /BC-ANM-TESTE/);
  assert.doesNotMatch(html, /R\$|comiss|repasse|percentual/i);
});

test('checklist considera anamnese finalizada vigente como concluída', () => {
  const html = renderClientFolder({
    client,
    history: [],
    anamneseState: { id: 'a1', version: 1, status: 'finalizada', valid_until: '2027-10-12T12:00:00Z' },
  });
  assert.match(html, /Anamnese[\s\S]*Concluído/i);
});
