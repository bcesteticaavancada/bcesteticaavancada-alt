export function resizeSignatureCanvas(canvas, ctx, dpr = 1) {
  const ratio = Math.max(1, Number(dpr) || 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.round(canvas.clientWidth || rect.width || 0);
  const height = Math.round(canvas.clientHeight || rect.height || 0);
  if (width <= 0 || height <= 0) return null;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height, ratio };
}

function pointFor(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function emptyMetrics() {
  return { moveCount: 0, totalDistance: 0, minX: null, minY: null, maxX: null, maxY: null };
}

function includePoint(metrics, point) {
  metrics.minX = metrics.minX === null ? point.x : Math.min(metrics.minX, point.x);
  metrics.minY = metrics.minY === null ? point.y : Math.min(metrics.minY, point.y);
  metrics.maxX = metrics.maxX === null ? point.x : Math.max(metrics.maxX, point.x);
  metrics.maxY = metrics.maxY === null ? point.y : Math.max(metrics.maxY, point.y);
}

export function createSignaturePad(canvas, options = {}) {
  if (!canvas?.getContext) throw new TypeError('Canvas de assinatura inválido.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');

  let empty = true;
  let drawing = false;
  let pointerId = null;
  let lastPoint = null;
  let metrics = emptyMetrics();
  const dpr = options.devicePixelRatio ?? globalThis.devicePixelRatio ?? 1;

  const applyStrokeStyle = () => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#28231f';
  };
  applyStrokeStyle();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const visibleWidth = Math.round(canvas.clientWidth || rect.width || 0);
    const visibleHeight = Math.round(canvas.clientHeight || rect.height || 0);
    if (visibleWidth <= 0 || visibleHeight <= 0) return null;

    let snapshot = null;
    if (!empty && canvas.ownerDocument?.createElement && canvas.width && canvas.height) {
      snapshot = canvas.ownerDocument.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      const snapshotCtx = snapshot.getContext?.('2d');
      snapshotCtx?.drawImage?.(canvas, 0, 0);
    }

    const size = resizeSignatureCanvas(canvas, ctx, dpr);
    if (!size) return null;
    applyStrokeStyle();

    if (snapshot) {
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, size.width, size.height);
    }
    return size;
  };

  const clear = () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width || canvas.clientWidth || 0, rect.height || canvas.clientHeight || 0);
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
    canvas.setPointerCapture?.(pointerId);
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
    if (lastPoint) metrics.totalDistance += Math.hypot(p.x - lastPoint.x, p.y - lastPoint.y);
    metrics.moveCount += 1;
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
    canvas.releasePointerCapture?.(pointerId);
    pointerId = null;
    lastPoint = null;
  };

  const getMetrics = () => ({ ...metrics });
  const isValid = () => {
    if (empty || metrics.moveCount < 2 || metrics.totalDistance < 20) return false;
    const width = metrics.minX === null || metrics.maxX === null ? 0 : metrics.maxX - metrics.minX;
    const height = metrics.minY === null || metrics.maxY === null ? 0 : metrics.maxY - metrics.minY;
    return Math.max(width, height) >= 10;
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
