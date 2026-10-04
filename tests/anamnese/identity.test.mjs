import test from 'node:test';
import assert from 'node:assert/strict';
import { CPF_FIELD_HTML, DATA_AUTHORIZATION_HTML } from '../../agendamento/js/identity.js';

test('CPF identification component defines the approved field and authorization copy', () => {
  assert.match(CPF_FIELD_HTML, /id="cpf"/);
  assert.match(CPF_FIELD_HTML, /name="cpf"/);
  assert.match(CPF_FIELD_HTML, /autocomplete="off"/);
  assert.match(DATA_AUTHORIZATION_HTML, /id="dataAuthorization"/);
  assert.match(DATA_AUTHORIZATION_HTML, /incluindo CPF/);
  assert.match(DATA_AUTHORIZATION_HTML, /exclusivamente para identificação, preparação e continuidade do atendimento/);
});
