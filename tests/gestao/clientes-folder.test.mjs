import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderClientFolder,
  renderClientFolderChecklist,
  renderClientTimeline,
  renderClientCadastroForm,
} from '../../gestao/js/clientes-folder.js';

const client = {
  id: 'c1',
  nome: 'Cliente Teste',
  cpf: '12345678900',
  data_nascimento: '1990-10-12',
  telefone: '31999999999',
  email: 'cliente@example.com',
  ativo: true,
  cep: '30110000',
  logradouro: 'Rua Teste',
  numero: '10',
  bairro: 'Centro',
  cidade: 'Belo Horizonte',
  uf: 'MG',
};

const history = [{
  id: 'h1',
  data_atendimento: '2026-10-08T15:00:00Z',
  colaboradora_user_id: 'alice-id',
  queixa_objetivo: 'Sensibilidade',
  observacoes: 'Pele íntegra',
  procedimentos: { nome: 'Peeling' },
}];

const staffMap = new Map([['alice-id', 'Alice']]);

test('checklist da pasta mostra cadastro, endereço, foto e anamnese', () => {
  const html = renderClientFolderChecklist(client);
  assert.match(html, /Cadastro básico/i);
  assert.match(html, /Endereço/i);
  assert.match(html, /Foto de identificação/i);
  assert.match(html, /Anamnese/i);
  assert.match(html, /Pendente/i);
});

test('linha do tempo mostra procedimento, profissional e conteúdo clínico sem valores financeiros', () => {
  const html = renderClientTimeline(history, staffMap);
  for (const text of ['Peeling', 'Alice', 'Sensibilidade', 'Pele íntegra']) {
    assert.match(html, new RegExp(text));
  }
  assert.doesNotMatch(html, /R\$|comiss|repasse|percentual|valor total/i);
});

test('pasta abre com as cinco abas clínicas sem financeiro', () => {
  const html = renderClientFolder({ client, history, staffMap, canArchive: false, photoUrl: '' });
  assert.match(html, /Cliente Teste/);
  assert.match(html, /36\s*anos/i);
  assert.match(html, /data-client-photo-placeholder/);
  for (const tab of ['timeline','cadastro','anamnese','atendimentos','documentos']) {
    assert.match(html, new RegExp(`data-folder-tab=["']${tab}["']`));
    assert.match(html, new RegExp(`data-folder-panel=["']${tab}["']`));
  }
  assert.match(html, /Atendimentos/i);
  assert.doesNotMatch(html, /Financeiro|Comiss|Repasse/i);
  assert.doesNotMatch(html, /Arquivar cliente|data-toggle-client/);
});

test('pasta ativa oferece câmera e galeria e mostra histórico imutável da identificação', () => {
  const html = renderClientFolder({
    client: { ...client, foto_identificacao_id: 'p1' },
    history: [],
    staffMap,
    canArchive: false,
    photoUrl: 'https://signed.example/current.jpg',
    photoHistory: [
      { id: 'p1', atual: true, created_at: '2026-10-12T12:00:00Z', url: 'https://signed.example/current.jpg' },
      { id: 'p0', atual: false, created_at: '2026-10-01T12:00:00Z', url: 'https://signed.example/old.jpg' },
    ],
  });
  assert.match(html, /Tirar foto/i);
  assert.match(html, /Escolher da galeria/i);
  assert.match(html, /data-client-photo-input=["']camera["']/);
  assert.match(html, /capture=["']environment["']/);
  assert.match(html, /data-client-photo-input=["']gallery["']/);
  assert.match(html, /Histórico de identificação/i);
  assert.match(html, /Atual/);
  assert.match(html, /Anterior/);
  assert.doesNotMatch(html, /Excluir foto|data-delete-photo/i);
});

test('admin recebe arquivamento na pasta; colaboradora não', () => {
  const admin = renderClientFolder({ client, history: [], staffMap, canArchive: true, photoUrl: '' });
  const collaborator = renderClientFolder({ client, history: [], staffMap, canArchive: false, photoUrl: '' });
  assert.match(admin, /data-toggle-client=["']false["']/);
  assert.match(admin, /Arquivar cliente/);
  assert.doesNotMatch(collaborator, /data-toggle-client|Arquivar cliente/);
});

test('cadastro completo contém identidade, endereço estruturado e responsável', () => {
  const html = renderClientCadastroForm(client, true);
  for (const name of ['nome','cpf','data_nascimento','telefone','email','cep','logradouro','numero','complemento','bairro','cidade','uf','responsavel_nome','responsavel_cpf','responsavel_parentesco','responsavel_telefone']) {
    assert.match(html, new RegExp(`name=["']${name}["']`));
  }
  assert.match(html, /data-client-edit-form/);
});
