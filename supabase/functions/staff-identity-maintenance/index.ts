// Retired one-use maintenance entrypoint.
Deno.serve(() => new Response('Maintenance closed', {status:410}));
