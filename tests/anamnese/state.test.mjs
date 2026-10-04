import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAFT_KEY,
  createInitialState,
  loadDraft,
  saveDraft,
  clearDraft,
  serializeForm,
  stripSensitiveDraftValues,
} from '../../agendamento/js/state.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    has: (key) => map.has(key),
  };
}

test('loadDraft returns initial state when storage is empty', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadDraft(storage), createInitialState());
});

test('loadDraft returns initial state when stored JSON is corrupted', () => {
  const storage = memoryStorage({ [DRAFT_KEY]: '{bad-json' });
  assert.deepEqual(loadDraft(storage), createInitialState());
});

test('saveDraft and loadDraft round-trip state', () => {
  const storage = memoryStorage();
  const state = { step: 4, values: { nome: 'Ana', whatsapp: '(31) 99999-9999' } };
  saveDraft(storage, state);
  assert.deepEqual(loadDraft(storage), state);
});

test('CPF is never persisted in the durable local draft', () => {
  const storage = memoryStorage();
  saveDraft(storage, {
    step: 1,
    values: { nome: 'Teste', cpf: '529.982.247-25', whatsapp: '(31) 99999-9999' },
  });

  const raw = storage.getItem(DRAFT_KEY);
  assert.equal(raw.includes('cpf'), false);
  assert.equal(raw.includes('52998224725'), false);
  assert.equal(raw.includes('529.982.247-25'), false);
  assert.deepEqual(loadDraft(storage), {
    step: 1,
    values: { nome: 'Teste', whatsapp: '(31) 99999-9999' },
  });
});

test('loadDraft strips CPF from a legacy draft before returning state', () => {
  const storage = memoryStorage({
    [DRAFT_KEY]: JSON.stringify({
      step: 2,
      values: { nome: 'Legado', cpf: '52998224725', whatsapp: '31999999999' },
    }),
  });

  assert.deepEqual(loadDraft(storage), {
    step: 2,
    values: { nome: 'Legado', whatsapp: '31999999999' },
  });
});

test('stripSensitiveDraftValues returns a copy without CPF', () => {
  const source = { nome: 'Teste', cpf: '52998224725', whatsapp: '31999999999' };
  assert.deepEqual(stripSensitiveDraftValues(source), { nome: 'Teste', whatsapp: '31999999999' });
  assert.equal(source.cpf, '52998224725');
});

test('clearDraft removes the canonical draft key', () => {
  const storage = memoryStorage();
  saveDraft(storage, { step: 2, values: {} });
  assert.equal(storage.has('bc.preAnamnese.draft.v1'), true);
  clearDraft(storage);
  assert.equal(storage.has('bc.preAnamnese.draft.v1'), false);
});

test('serializeForm preserves text, radio, checkbox groups and boolean checkbox', () => {
  const form = {
    elements: [
      { id: 'nome', name: '', type: 'text', value: '  João da Silva  ', disabled: false },
      { id: 'histS', name: 'histEst', type: 'radio', value: 'Sim', checked: true, disabled: false },
      { id: 'histN', name: 'histEst', type: 'radio', value: 'Não', checked: false, disabled: false },
      { id: 'p1', name: 'procedimentos', type: 'checkbox', value: 'Cryo Lift', checked: true, disabled: false },
      { id: 'p2', name: 'procedimentos', type: 'checkbox', value: 'Sculpt Cryo', checked: true, disabled: false },
      { id: 'cons1', name: '', type: 'checkbox', value: 'on', checked: true, disabled: false },
    ],
  };

  assert.deepEqual(serializeForm(form), {
    nome: 'João da Silva',
    histEst: 'Sim',
    procedimentos: ['Cryo Lift', 'Sculpt Cryo'],
    cons1: true,
  });
});
