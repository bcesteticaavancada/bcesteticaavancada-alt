import test from 'node:test';
import assert from 'node:assert/strict';
import * as preAnamnese from '../../agendamento/js/main.js';

test('step navigation scrolls to the clinical form rather than the calendar at the page top', () => {
  assert.equal(typeof preAnamnese.scrollPreAnamneseIntoView, 'function');
  const positions = [];
  const shell = { scrollIntoView: options => positions.push(options) };
  const form = { closest: selector => { assert.equal(selector, '.shell'); return shell; } };
  const view = { matchMedia: () => ({ matches: false }), scrollTo: () => assert.fail('must not return to page top') };
  preAnamnese.scrollPreAnamneseIntoView(form, view);
  assert.deepEqual(positions, [{ block: 'start', behavior: 'smooth' }]);
});

test('step scrolling respects the visitor reduced-motion preference', () => {
  assert.equal(typeof preAnamnese.scrollPreAnamneseIntoView, 'function');
  let options;
  const form = { scrollIntoView: value => { options = value; } };
  preAnamnese.scrollPreAnamneseIntoView(form, { matchMedia: () => ({ matches: true }) });
  assert.equal(options.behavior, 'auto');
});
