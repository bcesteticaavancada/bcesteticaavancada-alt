import { createRehearsalHandler, type InvocationConfig } from "./core.ts";
import { json, limitedText } from "../_shared/drive-oauth/protocol.ts";

// Configuration is generated privately for one short-lived invocation, never a public UI.
export function serveRehearsal(invocation: InvocationConfig) {
  return async (request: Request): Promise<Response> => {
    try {
      const base = Deno.env.get("SUPABASE_URL") || "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const clientId = Deno.env.get("BC_DRIVE_CLIENT_ID") || "";
      const clientSecret = Deno.env.get("BC_DRIVE_CLIENT_SECRET") || "";
      if (base !== "https://tpqsmerlxquyrzrjbogj.supabase.co" || !serviceKey || clientSecret.length < 20 ||
        clientId !== "530925228983-23076omi6omga78n5vavvkfub0v7uaq5.apps.googleusercontent.com") throw Error("configuration");
      return await createRehearsalHandler({ ...invocation, clientId, clientSecret,
        writes: Deno.env.get("BC_DRIVE_BACKUP_ENABLE_WRITES") || "",
        setupEnabled: Deno.env.get("BC_DRIVE_OAUTH_ENABLE_SETUP") === "true",
      }, { now: Date.now, fetch, store: async (operation, payload) => {
        const r = await fetch(base + "/rest/v1/rpc/bc_drive_oauth_store", {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
          headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
          body: JSON.stringify({ p_operation: operation, p_payload: payload }),
        });
        if (!r.ok) throw Error("store_unavailable");
        return operation === "read" ? await json(r, 16384) : JSON.parse(await limitedText(r, 16384));
      } })(request);
    } catch {
      return Response.json({ ok: false, error: "rehearsal_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  };
}
