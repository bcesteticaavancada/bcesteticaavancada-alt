const origins = new Set([
  'https://www.bcesteticaavancada.com.br',
  'https://bcesteticaavancada.com.br',
  'https://bcesteticaavancada.github.io',
]);

async function readToken(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const bytes = new Uint8Array(256);
  let size = 0;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (size + value.byteLength > bytes.byteLength) {
        await reader.cancel();
        return null;
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
    const payload = JSON.parse(new TextDecoder().decode(bytes.subarray(0, size)));
    const token = payload?.token;
    return Object.keys(payload ?? {}).length === 1
      && typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? token : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function createClientPortalHandler({ getSchedule }) {
  return async function handleClientPortal(request) {
    const origin = request.headers.get('origin');
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
    });
    const json = (data, status) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !origins.has(origin)) return json({ error: 'origem_indisponivel' }, 403);
    if (origin) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'content-type');
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'metodo_indisponivel' }, 405);

    const token = await readToken(request);
    if (!token) return json({ error: 'link_indisponivel' }, 404);

    try {
      const schedule = await getSchedule(token);
      if (schedule === null) return json({ error: 'link_indisponivel' }, 404);
      const appointments = schedule.appointments.map(({ starts_at }) => {
        if (typeof starts_at !== 'string' || !Number.isFinite(Date.parse(starts_at))) {
          throw new Error('Invalid schedule response');
        }
        return { starts_at };
      });
      return json({ appointments }, 200);
    } catch {
      return json({ error: 'consulta_indisponivel' }, 503);
    }
  };
}
