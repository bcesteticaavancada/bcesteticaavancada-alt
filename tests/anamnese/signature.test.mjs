import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignaturePad, resizeSignatureCanvas } from '../../agendamento/js/signature.js';

function fakeCanvas() {
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
    clientWidth: 300,
    clientHeight: 150,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 300, height: 150 }),
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
});

test('signature resize redraws the existing signature instead of losing it', () => {
  const { canvas, handlers, calls } = fakeCanvas();
  const pad = createSignaturePad(canvas, { devicePixelRatio: 2 });
  handlers.get('pointerdown')({ pointerId: 7, clientX: 30, clientY: 40, preventDefault() {} });
  handlers.get('pointermove')({ pointerId: 7, clientX: 120, clientY: 80, preventDefault() {} });
  handlers.get('pointerup')({ pointerId: 7, clientX: 120, clientY: 80, preventDefault() {} });
  calls.length = 0;
  pad.resize();
  assert.ok(calls.some((c) => c[0] === 'snapshotDrawImage'), 'captures the existing canvas before resize');
  assert.ok(calls.some((c) => c[0] === 'drawImage'), 'redraws captured signature after resize');
  assert.equal(pad.isEmpty(), false);
});
