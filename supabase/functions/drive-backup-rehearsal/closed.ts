// Final deployment after the explicitly authorized fictional rehearsal.
// No imports, credentials, network, storage, session or application access.
Deno.serve(() => Response.json({ error: "rehearsal_closed" }, {
  status: 410, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
}));
