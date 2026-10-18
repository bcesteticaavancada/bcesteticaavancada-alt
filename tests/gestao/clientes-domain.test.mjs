import test from 'node:test';
import assert from 'node:assert/strict';

let domain = {};
try {
  domain = await import('../../gestao/js/clientes-domain.js');
} catch {
  domain = {};
}

const {
  normalizeCpf,
  formatCpf,
  calculateAge,
  isMinor,
  clientProfileChecklist,
} = domain;

const referenceDate = new Date(2026, 9, 12, 12);

test('cadastro básico fica completo só com nome e telefone', () => {
  assert.equal(clientProfileChecklist({ nome: 'Pessoa Fictícia', telefone: '31900000000' }).cadastroBasico, true);
  assert.equal(clientProfileChecklist({ nome: ' ', telefone: '31900000000' }).cadastroBasico, false);
  assert.equal(clientProfileChecklist({ nome: 'Pessoa Fictícia', telefone: ' ' }).cadastroBasico, false);
  assert.equal(calculateAge(null, referenceDate), null);
});

test('normaliza e formata CPF sem alterar a identidade', () => {
  assert.equal(typeof normalizeCpf, 'function');
  assert.equal(typeof formatCpf, 'function');
  assert.equal(normalizeCpf('123.456.789-00'), '12345678900');
  assert.equal(formatCpf('12345678900'), '123.456.789-00');
});

test('calcula idade antes, no dia e depois do aniversário sem persistir idade', () => {
  assert.equal(typeof calculateAge, 'function');
  assert.equal(calculateAge('2008-10-13', referenceDate), 17);
  assert.equal(calculateAge('2008-10-12', referenceDate), 18);
  assert.equal(calculateAge('2008-10-11', referenceDate), 18);
  assert.equal(calculateAge('2027-01-01', referenceDate), null);
});

test('menoridade muda exatamente ao completar 18 anos', () => {
  assert.equal(typeof isMinor, 'function');
  assert.equal(isMinor('2008-10-13', referenceDate), true);
  assert.equal(isMinor('2008-10-12', referenceDate), false);
  assert.equal(isMinor('2008-10-11', referenceDate), false);
});

test('checklist separa cadastro básico, endereço, foto e anamnese', () => {
  assert.equal(typeof clientProfileChecklist, 'function');
  const base = {
    nome: 'Cliente Teste',
    cpf: '12345678900',
    data_nascimento: '1990-01-01',
    telefone: '31999999999',
    cep: '30110000',
    logradouro: 'Rua Teste',
    numero: '',
    bairro: 'Centro',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    foto_identificacao_id: null,
  };
  assert.deepEqual(clientProfileChecklist(base), {
    cadastroBasico: true,
    enderecoCompleto: false,
    fotoIdentificacao: false,
    anamnese: 'pendente',
  });
  assert.deepEqual(clientProfileChecklist({ ...base, numero: '10', foto_identificacao_id: 'foto-1' }), {
    cadastroBasico: true,
    enderecoCompleto: true,
    fotoIdentificacao: true,
    anamnese: 'pendente',
  });
});
