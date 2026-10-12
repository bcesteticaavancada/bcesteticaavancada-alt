function emptyMetrics() {
  return { moveCount: 0, totalDistance: 0, minX: null, minY: null, maxX: null, maxY: null };
}

function includePoint(metrics, point) {
  metrics.minX = metrics.minX === null ? point.x : Math.min(metrics.minX, point.x);
  metrics.minY = metrics.minY === null ? point.y : Math.min(metrics.minY, point.y);
  metrics.maxX = metrics.maxX === null ? point.x : Math.max(metrics.maxX, point.x);
  metrics.maxY = metrics.maxY === null ? point.y : Math.max(metrics.maxY, point.y);
}

export function isSignatureMetricsValid(metrics = {}) {
  if ((metrics.moveCount || 0) < 2 || (metrics.totalDistance || 0) < 20) return false;
  const width = metrics.minX == null || metrics.maxX == null ? 0 : metrics.maxX - metrics.minX;
  const height = metrics.minY == null || metrics.maxY == null ? 0 : metrics.maxY - metrics.minY;
  return Math.max(width, height) >= 10;
}

export async function sha256Blob(blob) {
  if (!blob?.arrayBuffer) throw new TypeError('Arquivo de assinatura inválido.');
  const bytes = await blob.arrayBuffer();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 indisponível neste navegador.');
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function resizeSignatureCanvas(canvas, ctx, dpr = globalThis.devicePixelRatio || 1) {
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

export function createSignaturePad(canvas, options = {}) {
  if (!canvas?.getContext) throw new TypeError('Canvas de assinatura inválido.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');

  let drawing = false;
  let pointerId = null;
  let lastPoint = null;
  let empty = true;
  let metrics = emptyMetrics();
  const dpr = options.devicePixelRatio ?? globalThis.devicePixelRatio ?? 1;

  const applyStyle = () => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2a2019';
  };

  const pointFor = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

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
      snapshot.getContext?.('2d')?.drawImage?.(canvas, 0, 0);
    }

    const size = resizeSignatureCanvas(canvas, ctx, dpr);
    applyStyle();
    if (snapshot && size) {
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, size.width, size.height);
    }
    return size;
  };

  const clear = () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width || canvas.clientWidth || 0, rect.height || canvas.clientHeight || 0);
    drawing = false;
    pointerId = null;
    lastPoint = null;
    empty = true;
    metrics = emptyMetrics();
  };

  const start = (event) => {
    event.preventDefault?.();
    drawing = true;
    pointerId = event.pointerId ?? null;
    canvas.setPointerCapture?.(pointerId);
    const point = pointFor(event);
    lastPoint = point;
    includePoint(metrics, point);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const move = (event) => {
    if (!drawing || (pointerId !== null && event.pointerId !== undefined && event.pointerId !== pointerId)) return;
    event.preventDefault?.();
    const point = pointFor(event);
    if (lastPoint) metrics.totalDistance += Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    metrics.moveCount += 1;
    includePoint(metrics, point);
    lastPoint = point;
    ctx.lineTo(point.x, point.y);
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

  applyStyle();
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  resize();

  return {
    clear,
    resize,
    isEmpty: () => empty,
    isValid: () => !empty && isSignatureMetricsValid(metrics),
    getMetrics: () => ({ ...metrics }),
    toBlob: (type = 'image/png', quality) => new Promise((resolve, reject) => {
      canvas.toBlob?.((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a assinatura.')), type, quality);
    }),
    toDataUrl: () => canvas.toDataURL('image/png'),
  };
}
