import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleQuestionIds, getVisibleModuleKeys } from '../../agendamento/js/conditional.js';

function state(values = {}) {
  return { step: 1, values };
}

test('history details are visible only after positive history answer', () => {
  assert.equal(getVisibleQuestionIds(state({ histEst: 'Não' })).includes('histQual'), false);
  assert.equal(getVisibleQuestionIds(state({ histEst: 'Sim' })).includes('histQual'), true);
});

test('alcohol and nicotine details follow their answers', () => {
  const hidden = getVisibleQuestionIds(state({ alcool: 'Não', nic: 'Não' }));
  assert.equal(hidden.includes('alcFreq'), false);
  assert.equal(hidden.includes('nicFreq'), false);

  const visible = getVisibleQuestionIds(state({ alcool: 'Sim', nic: 'Sim' }));
  assert.equal(visible.includes('alcFreq'), true);
  assert.equal(visible.includes('nicFreq'), true);
});

test('procedure modules map to selected procedures', () => {
  const modules = getVisibleModuleKeys(state({ procedimentos: ['Peeling Coreano', 'Microagulhamento', 'Outro'] }));
  assert.deepEqual(modules.sort(), ['facial', 'microagulhamento', 'outro', 'peeling'].sort());
});
