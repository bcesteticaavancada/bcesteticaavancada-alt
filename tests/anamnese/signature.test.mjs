import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignaturePad, resizeSignatureCanvas } from '../../agendamento/js/signature.js';

function fakeCanvas(initial = { width: 300, height: 150 }) {
  const handlers = new Map();
  const calls = [];
  const size = { width: initial.width, height: initial.height };
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
    style: {},
    get clientWidth() { return size.width; },
    get clientHeight() { return size.height; },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: size.width, height: size.height }),
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
  return { canvas, ctx, handlers, calls, setSize: (width, height) => { size.width = width; size.height = height; } };
}

function pointer(handlers, name, { x, y, pointerId = 1 }) {
  handlers.get(name)({ pointerId, clientX: x + 10, clientY: y + 20, preventDefault() {} });
}

test('resizeSignatureCanvas scales backing pixels by devicePixelRatio', () => {
  const { canvas, ctx, calls } = fakeCanvas();
  const result = resizeSignatureCanvas(canvas, ctx, 2);
  assert.equal(result.ready, true);
  assert.equal(canvas.width, 600);
  assert.equal(canvas.height, 300);
  assert.deepEqual(calls.find((c) => c[0] === 'setTransform'), ['setTransform', 2, 0, 0, 2, 0, 0]);
});

test('hidden canvas is not collapsed and becomes ready when step becomes visible', () => {
  const { canvas, handlers, calls, setSize } = fakeCanvas({ width: 0, height: 0 });
  const pad = createSignaturePad(canvas, { devicePixelRatio: 2 });
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
  assert.equal(calls.some((c) => c[0] === 'setTransform'), false);

  setSize(320, 190);
  const result = pad.resize();
  assert.equal(result.ready, true);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 380);

  pointer(handlers, 'pointerdown', { x: 20, y: 20 });
  pointer(handlers, 'pointermove', { x: 35, y: 20 });
  pointer(handlers, 'pointermove', { x: 50, y: 20 });
  pointer(handlers, 'pointerup', { x: 50, y: 20 });
  assert.equal(pad.isValid(), true);
});

test('rubric requires real movement metrics instead of a tap or micro-stroke', () => {
  const { canvas, handlers } = fakeCanvas();
  const pad = createSignaturePad(canvas, { devicePixelRatio: 2 });
  assert.equal(pad.isEmpty(), true);
  assert.equal(pad.isValid(), false);

  pointer(handlers, 'pointerdown', { x: 20, y: 20 });
  pointer(handlers, 'pointermove', { x: 22, y: 21 });
  pointer(handlers, 'pointermove', { x: 24, y: 22 });
  pointer(handlers, 'pointerup', { x: 24, y: 22 });
  assert.equal(pad.isEmpty(), false);
  assert.equal(pad.isValid(), false);
  assert.equal(pad.getMetrics().moveCount, 2);
  assert.ok(pad.getMetrics().totalDistance < 20);

  pad.clear();
  pointer(handlers, 'pointerdown', { x: 20, y: 20 });
  pointer(handlers, 'pointermove', { x: 35, y: 20 });
  pointer(handlers, 'pointermove', { x: 50, y: 20 });
  pointer(handlers, 'pointerup', { x: 50, y: 20 });
  assert.equal(pad.isValid(), true);
  const metrics = pad.getMetrics();
  assert.equal(metrics.moveCount, 2);
  assert.ok(metrics.totalDistance >= 20);
  assert.ok(Math.max(metrics.maxX - metrics.minX, metrics.maxY - metrics.minY) >= 10);
});

test('rubric resize redraws existing content and preserves validity metrics', () => {
  const { canvas, handlers, calls, setSize } = fakeCanvas();
  const pad = createSignaturePad(canvas, { devicePixelRatio: 2 });
  pointer(handlers, 'pointerdown', { x: 20, y: 20, pointerId: 7 });
  pointer(handlers, 'pointermove', { x: 50, y: 25, pointerId: 7 });
  pointer(handlers, 'pointermove', { x: 90, y: 50, pointerId: 7 });
  pointer(handlers, 'pointerup', { x: 90, y: 50, pointerId: 7 });
  assert.equal(pad.isValid(), true);
  const before = pad.getMetrics();

  calls.length = 0;
  setSize(190, 320);
  pad.resize();
  assert.ok(calls.some((c) => c[0] === 'snapshotDrawImage'), 'captures the existing canvas before resize');
  assert.ok(calls.some((c) => c[0] === 'drawImage'), 'redraws captured rubric after resize');
  assert.equal(pad.isValid(), true);
  assert.deepEqual(pad.getMetrics(), before);

  pad.clear();
  assert.equal(pad.isEmpty(), true);
  assert.equal(pad.isValid(), false);
  assert.equal(pad.getMetrics().moveCount, 0);
});
