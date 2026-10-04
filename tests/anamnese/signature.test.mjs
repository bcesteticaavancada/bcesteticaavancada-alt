import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignaturePad, resizeSignatureCanvas } from '../../agendamento/js/signature.js';

function fakeCanvas({ width = 300, height = 150 } = {}) {
  const handlers = new Map();
  const calls = [];
  const ctx = {
    setTransform: (...args) => calls.push(['setTransform', ...args]),
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    stroke: () => calls.push(['stroke']),
    drawImage: (...args) => calls.push(['drawImage', ...args]),
    lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '',
  };
  const canvas = {
    width: 0,
    height: 0,
    clientWidth: width,
    clientHeight: height,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: canvas.clientWidth, height: canvas.clientHeight }),
    addEventListener: (name, fn) => handlers.set(name, fn),
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    toDataURL: () => 'data:image/png;base64,AAAA',
    ownerDocument: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({ drawImage: (...args) => calls.push(['snapshotDrawImage', ...args]) }),
      }),
    },
  };
  return { canvas, ctx, handlers, calls };
}

test('resizeSignatureCanvas scales backing pixels by devicePixelRatio', () => {
  const { canvas, ctx, calls } = fakeCanvas();
  resizeSignatureCanvas(canvas, ctx, 2);
  assert.equal(canvas.width, 600);
  assert.equal(canvas.height, 300);
  assert.deepEqual(calls.find((c) => c[0] === 'setTransform'), ['setTransform', 2, 0, 0, 2, 0, 0]);
});

test('hidden signature canvas does not collapse and becomes crisp when shown', () => {
  const { canvas, handlers } = fakeCanvas({ width: 0, height: 0 });
  const pad = createSignaturePad(canvas, { devicePixelRatio: 2 });
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
  assert.equal(pad.isEmpty(), true);

  canvas.clientWidth = 320;
  canvas.clientHeight = 190;
  pad.resize();
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 380);
  assert.equal(typeof handlers.get('pointerdown'), 'function');
});

test('signature pad starts empty, becomes non-empty after a stroke and clears', () => {
  const { canvas, handlers, calls } = fakeCanvas();
  const pad = createSignaturePad(canvas, { devicePixelRatio: 2 });
  assert.equal(pad.isEmpty(), true);

  handlers.get('pointerdown')({ pointerId: 1, clientX: 40, clientY: 50, preventDefault() {} });
  handlers.get('pointermove')({ pointerId: 1, clientX: 90, clientY: 100, preventDefault() {} });
  handlers.get('pointerup')({ pointerId: 1, clientX: 90, clientY: 100, preventDefault() {} });

  assert.equal(pad.isEmpty(), false);
  assert.ok(calls.some((c) => c[0] === 'moveTo' && c[1] === 30 && c[2] === 30));
  assert.ok(calls.some((c) => c[0] === 'lineTo' && c[1] === 80 && c[2] === 80));
  assert.match(pad.toDataUrl(), /^data:image\/png;base64,/);

  pad.clear();
  assert.equal(pad.isEmpty(), true);
  assert.deepEqual(pad.getMetrics(), { moveCount: 0, totalDistance: 0, minX: null, minY: null, maxX: null, maxY: null });
});

test('isolated tap and micro-stroke are not accepted as a valid rubric', () => {
  const { canvas, handlers } = fakeCanvas();
  const pad = createSignaturePad(canvas, { devicePixelRatio: 2 });

  handlers.get('pointerdown')({ pointerId: 1, clientX: 30, clientY: 40, preventDefault() {} });
  handlers.get('pointerup')({ pointerId: 1, clientX: 30, clientY: 40, preventDefault() {} });
  assert.equal(pad.isValid(), false);

  handlers.get('pointerdown')({ pointerId: 2, clientX: 30, clientY: 40, preventDefault() {} });
  handlers.get('pointermove')({ pointerId: 2, clientX: 33, clientY: 42, preventDefault() {} });
  handlers.get('pointermove')({ pointerId: 2, clientX: 35, clientY: 43, preventDefault() {} });
  handlers.get('pointerup')({ pointerId: 2, clientX: 35, clientY: 43, preventDefault() {} });
  assert.equal(pad.isValid(), false);
});

test('a short real rubric passes the minimum movement metrics', () => {
  const { canvas, handlers } = fakeCanvas();
  const pad = createSignaturePad(canvas, { devicePixelRatio: 2 });
  handlers.get('pointerdown')({ pointerId: 3, clientX: 20, clientY: 30, preventDefault() {} });
  handlers.get('pointermove')({ pointerId: 3, clientX: 30, clientY: 30, preventDefault() {} });
  handlers.get('pointermove')({ pointerId: 3, clientX: 55, clientY: 35, preventDefault() {} });
  handlers.get('pointerup')({ pointerId: 3, clientX: 55, clientY: 35, preventDefault() {} });
  assert.equal(pad.isValid(), true);
  assert.ok(pad.getMetrics().moveCount >= 2);
  assert.ok(pad.getMetrics().totalDistance >= 20);
});

test('signature resize redraws the existing signature and preserves rubric validity', () => {
  const { canvas, handlers, calls } = fakeCanvas();
  const pad = createSignaturePad(canvas, { devicePixelRatio: 2 });
  handlers.get('pointerdown')({ pointerId: 7, clientX: 30, clientY: 40, preventDefault() {} });
  handlers.get('pointermove')({ pointerId: 7, clientX: 70, clientY: 50, preventDefault() {} });
  handlers.get('pointermove')({ pointerId: 7, clientX: 120, clientY: 80, preventDefault() {} });
  handlers.get('pointerup')({ pointerId: 7, clientX: 120, clientY: 80, preventDefault() {} });
  assert.equal(pad.isValid(), true);
  calls.length = 0;
  pad.resize();
  assert.ok(calls.some((c) => c[0] === 'snapshotDrawImage'), 'captures the existing canvas before resize');
  assert.ok(calls.some((c) => c[0] === 'drawImage'), 'redraws captured signature after resize');
  assert.equal(pad.isEmpty(), false);
  assert.equal(pad.isValid(), true);
});
