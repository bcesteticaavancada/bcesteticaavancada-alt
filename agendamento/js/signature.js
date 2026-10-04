function cssSizeFor(canvas) {
  const rect = canvas.getBoundingClientRect?.() || { width: 0, height: 0 };
  const width = Math.max(0, Math.round(Number(canvas.clientWidth || rect.width || 0)));
  const height = Math.max(0, Math.round(Number(canvas.clientHeight || rect.height || 0)));
  return { width, height, ready: width > 0 && height > 0 };
}

export function resizeSignatureCanvas(canvas, ctx, dpr = 1) {
  const ratio = Math.max(1, Number(dpr) || 1);
  const size = cssSizeFor(canvas);
  if (!size.ready) return { ...size, ratio };

  canvas.width = Math.round(size.width * ratio);
  canvas.height = Math.round(size.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ...size, ratio };
}

function pointFor(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function emptyMetrics() {
  return {
    moveCount: 0,
    totalDistance: 0,
    minX: null,
    minY: null,
    maxX: null,
    maxY: null,
  };
}

function includePoint(metrics, point) {
  metrics.minX = metrics.minX === null ? point.x : Math.min(metrics.minX, point.x);
  metrics.minY = metrics.minY === null ? point.y : Math.min(metrics.minY, point.y);
  metrics.maxX = metrics.maxX === null ? point.x : Math.max(metrics.maxX, point.x);
  metrics.maxY = metrics.maxY === null ? point.y : Math.max(metrics.maxY, point.y);
}

export function createSignaturePad(canvas, options = {}) {
  if (!canvas?.getContext) throw new TypeError('Canvas de rubrica inválido.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');

  let empty = true;
  let drawing = false;
  let pointerId = null;
  let lastPoint = null;
  let metrics = emptyMetrics();
  const dpr = options.devicePixelRatio ?? globalThis.devicePixelRatio ?? 1;

  const applyBrush = () => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#28231f';
  };
  applyBrush();

  const resize = () => {
    const target = cssSizeFor(canvas);
    if (!target.ready) return { ...target, ratio: Math.max(1, Number(dpr) || 1) };

    let snapshot = null;
    if (!empty && canvas.ownerDocument?.createElement && canvas.width && canvas.height) {
      snapshot = canvas.ownerDocument.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      const snapshotCtx = snapshot.getContext?.('2d');
      snapshotCtx?.drawImage?.(canvas, 0, 0);
    }

    const size = resizeSignatureCanvas(canvas, ctx, dpr);
    applyBrush();

    if (snapshot && size.ready) {
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, size.width, size.height);
    }
    return size;
  };

  const clear = () => {
    const size = cssSizeFor(canvas);
    const width = size.width || canvas.width || 0;
    const height = size.height || canvas.height || 0;
    ctx.clearRect(0, 0, width, height);
    empty = true;
    drawing = false;
    pointerId = null;
    lastPoint = null;
    metrics = emptyMetrics();
  };

  const start = (event) => {
    event.preventDefault?.();
    drawing = true;
    pointerId = event.pointerId ?? null;
    if (pointerId !== null) canvas.setPointerCapture?.(pointerId);
    const p = pointFor(canvas, event);
    lastPoint = p;
    includePoint(metrics, p);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (event) => {
    if (!drawing || (pointerId !== null && event.pointerId !== undefined && event.pointerId !== pointerId)) return;
    event.preventDefault?.();
    const p = pointFor(canvas, event);
    if (lastPoint) {
      metrics.moveCount += 1;
      metrics.totalDistance += Math.hypot(p.x - lastPoint.x, p.y - lastPoint.y);
    }
    includePoint(metrics, p);
    lastPoint = p;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    empty = false;
  };

  const end = (event) => {
    if (!drawing) return;
    event.preventDefault?.();
    drawing = false;
    if (pointerId !== null) canvas.releasePointerCapture?.(pointerId);
    pointerId = null;
    lastPoint = null;
  };

  const getMetrics = () => ({ ...metrics });
  const isValid = () => {
    if (empty || metrics.minX === null || metrics.minY === null || metrics.maxX === null || metrics.maxY === null) return false;
    const width = metrics.maxX - metrics.minX;
    const height = metrics.maxY - metrics.minY;
    return metrics.moveCount >= 2 && metrics.totalDistance >= 20 && Math.max(width, height) >= 10;
  };

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  resize();

  return {
    clear,
    isEmpty: () => empty,
    isValid,
    getMetrics,
    toDataUrl: () => canvas.toDataURL('image/png'),
    resize,
  };
}
