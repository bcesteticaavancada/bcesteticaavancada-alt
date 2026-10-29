import { createPublicAgendaHandler } from '../../supabase/functions/public-agenda/index.ts';
import { createPreAnamneseHandler } from '../../supabase/functions/submit-pre-anamnese/index.ts';

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// Capture only the HTTP server registration. The real PDF entrypoints and their
// validation execute unchanged; no listener or hosted client is created.
async function pdfHandler(file: string): Promise<(request: Request) => Promise<Response>> {
  const serve = Deno.serve;
  let captured: ((request: Request) => Promise<Response>) | undefined;
  try {
    Deno.serve = ((handler: (request: Request) => Promise<Response>) => {
      captured = handler;
      return {};
    }) as typeof Deno.serve;
    await import(file);
  } finally { Deno.serve = serve; }
  if (!captured) throw Error('PDF entrypoint did not register its handler');
  return captured;
}

const handlers: [string, (request: Request) => Promise<Response>, number][] = [
  ['public-agenda', createPublicAgendaHandler(() => { throw Error('No database access in CORS tests'); }), 422],
  ['submit-pre-anamnese', createPreAnamneseHandler(() => { throw Error('No database access in CORS tests'); }), 422],
  ['generate-anamnese-pdf', await pdfHandler('../../supabase/functions/generate-anamnese-pdf/index.ts'), 401],
  ['generate-clinical-pdf', await pdfHandler('../../supabase/functions/generate-clinical-pdf/index.ts'), 401],
];

for (const [name, handler, unauthenticatedStatus] of handlers) {
  for (const origin of ['https://bcesteticaavancada.github.io',
    'https://www.bcesteticaavancada.com.br', 'https://bcesteticaavancada.com.br']) {
    Deno.test(`${name}: preflight and validation preserve exact official Origin ${origin}`, async () => {
      const preflight = await handler(new Request('https://example.invalid/' + name, {method:'OPTIONS', headers:{origin}}));
      equal(preflight.status, 204);
      equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
      equal(preflight.headers.get('Vary'), 'Origin');
      const post = await handler(new Request('https://example.invalid/' + name,
        {method:'POST', headers:{origin,'content-type':'application/json'}, body:'{}'}));
      equal(post.status, unauthenticatedStatus);
      equal(post.headers.get('Access-Control-Allow-Origin'), origin);
      await post.text();
    });
  }
  Deno.test(`${name}: foreign and lookalike origins fail before validation or database work`, async () => {
    for (const origin of ['https://www.bcesteticaavancada.com.br.evil.invalid',
      'http://www.bcesteticaavancada.com.br', 'https://evil.invalid', 'null']) {
      for (const method of ['OPTIONS','POST']) {
        const response = await handler(new Request('https://example.invalid/' + name,
          {method,headers:{origin},...(method === 'POST' ? {body:'{}'} : {})}));
        equal(response.status,403);
        if ([origin,'*'].includes(response.headers.get('Access-Control-Allow-Origin') || '')) throw Error('Origin reflected');
        await response.text();
      }
    }
  });
}
