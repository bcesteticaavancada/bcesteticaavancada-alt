export function resizeSignatureCanvas(canvas, ctx, dpr = 1) {
  const ratio = Math.max(1, Number(dpr) || 1);
  const width = Math.max(1, Math.round(canvas.clientWidth || canvas.getBoundingClientRect().width || 1));
  const height = Math.max(1, Math.round(canvas.clientHeight || canvas.getBoundingClientRect().height || 1));
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height, ratio };
}

function pointFor(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export function createSignaturePad(canvas, options = {}) {
  if (!canvas?.getContext) throw new TypeError('Canvas de assinatura inválido.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');

  let empty = true;
  let drawing = false;
  let pointerId = null;
  const dpr = options.devicePixelRatio ?? globalThis.devicePixelRatio ?? 1;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#28231f';

  const resize = () => {
    resizeSignatureCanvas(canvas, ctx, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#28231f';
  };

  const clear = () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width || canvas.clientWidth || 0, rect.height || canvas.clientHeight || 0);
    empty = true;
  };

  const start = (event) => {
    event.preventDefault?.();
    drawing = true;
    pointerId = event.pointerId ?? null;
    canvas.setPointerCapture?.(pointerId);
    const p = pointFor(canvas, event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (event) => {
    if (!drawing || (pointerId !== null && event.pointerId !== undefined && event.pointerId !== pointerId)) return;
    event.preventDefault?.();
    const p = pointFor(canvas, event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    empty = false;
  };

  const end = (event) => {
    if (!drawing) return;
    event.preventDefault?.();
    drawing = false;
    canvas.releasePointerCapture?.(pointerId);
    pointerId = null;
  };

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  resize();

  return {
    clear,
    isEmpty: () => empty,
    toDataUrl: () => canvas.toDataURL('image/png'),
    resize,
  };
}
