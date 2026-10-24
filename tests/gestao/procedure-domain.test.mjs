import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProcedureDraft,
  validateProcedureDraft,
  deriveConsentClass,
  formatProcedurePrice,
} from '../../gestao/js/procedure-domain.js';

test('normaliza rascunho sem aceitar lixo comercial', () => {
  const draft = normalizeProcedureDraft({
    nome: '  Limpeza de pele  ',
    classe_documental: 'nao_injetavel',
    price_mode: 'fixed',
    base_price: '190,00',
    suggested_duration: '60',
    protocol_mode: 'simple',
  });

  assert.equal(draft.nome, 'Limpeza de pele');
  assert.equal(draft.classe_documental, 'nao_injetavel');
  assert.equal(draft.price_mode, 'fixed');
  assert.equal(draft.base_price, 190);
  assert.equal(draft.suggested_duration, 60);
  assert.equal(draft.protocol_mode, 'simple');
});

test('valida nome, classe, modo de preco, preco e duracao', () => {
  const invalid = validateProcedureDraft({
    nome: ' ',
    classe_documental: 'experimental',
    price_mode: 'free',
    base_price: -1,
    suggested_duration: 0,
    protocol_mode: 'simple',
  });

  assert.equal(invalid.valid, false);
  for (const field of ['nome', 'classe_documental', 'price_mode', 'base_price', 'suggested_duration']) {
    assert.ok(invalid.errors[field], `esperava erro em ${field}`);
  }

  const valid = validateProcedureDraft({
    nome: 'Peeling',
    classe_documental: 'nao_injetavel',
    price_mode: 'starting_at',
    base_price: 195,
    suggested_duration: 45,
    protocol_mode: 'simple',
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('protocolo composto exige composicao valida', () => {
  const invalid = validateProcedureDraft({
    nome: 'Protocolo composto',
    classe_documental: 'nao_injetavel',
    price_mode: 'fixed',
    base_price: 500,
    suggested_duration: 60,
    protocol_mode: 'compound',
    component_version_ids: [],
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.component_version_ids);

  const valid = validateProcedureDraft({
    nome: 'Protocolo composto',
    classe_documental: 'nao_injetavel',
    price_mode: 'fixed',
    base_price: 500,
    suggested_duration: 60,
    protocol_mode: 'compound',
    component_version_ids: ['version-a', 'version-b'],
  });
  assert.equal(valid.valid, true);
});

test('protocolo de via variável pode declarar opções de componentes da sessão sem IDs artificiais', () => {
  const valid = validateProcedureDraft({
    nome: 'Fort Hair™',
    classe_documental: 'nao_injetavel',
    price_mode: 'fixed',
    base_price: 490,
    suggested_duration: 60,
    protocol_mode: 'compound',
    component_version_ids: [],
    specific_schema: {
      component_options: [
        { key: 'led', label: 'LED', classe_documental: 'nao_injetavel' },
        { key: 'microestimulacao', label: 'Microestimulação invasiva', classe_documental: 'injetavel' },
      ],
    },
  });
  assert.equal(valid.valid, true);
});

test('classe de consentimento escala para injetavel quando qualquer componente for injetavel', () => {
  assert.equal(deriveConsentClass({
    procedureVersion: { classe_documental: 'nao_injetavel', protocol_mode: 'simple' },
    componentVersions: [],
  }), 'nao_injetavel');

  assert.equal(deriveConsentClass({
    procedureVersion: { classe_documental: 'injetavel', protocol_mode: 'simple' },
    componentVersions: [],
  }), 'injetavel');

  assert.equal(deriveConsentClass({
    procedureVersion: { classe_documental: 'nao_injetavel', protocol_mode: 'compound' },
    componentVersions: [
      { classe_documental: 'nao_injetavel' },
      { classe_documental: 'injetavel' },
    ],
  }), 'injetavel');
});

test('formata preco fixo e a partir de em pt-BR', () => {
  assert.equal(formatProcedurePrice({ price_mode: 'fixed', base_price: 180 }), 'R$ 180,00');
  assert.equal(formatProcedurePrice({ price_mode: 'starting_at', base_price: 195 }), 'A partir de R$ 195,00');
});
test('procedimento gratuito ou valor a definir não exige preço fictício',()=>{
 for(const base_price of [0,null,'']){const result=validateProcedureDraft({nome:'Avaliação',classe_documental:'nao_injetavel',price_mode:'fixed',base_price,protocol_mode:'simple'});assert.equal(result.valid,true);assert.equal(result.value.base_price,base_price===0?0:null);}
 for(const base_price of [-1,NaN,Infinity,'1.001'])assert.equal(validateProcedureDraft({nome:'Avaliação',classe_documental:'nao_injetavel',price_mode:'fixed',base_price,protocol_mode:'simple'}).valid,false);
});
