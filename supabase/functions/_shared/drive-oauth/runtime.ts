import { createOAuthHandler, type Config, type Dependencies } from "./handler.ts";
import { json, limitedText, SetupError } from "./protocol.ts";

const BASE = "https://tpqsmerlxquyrzrjbogj.supabase.co";
const CLIENT = "530925228983-23076omi6omga78n5vavvkfub0v7uaq5.apps.googleusercontent.com";

// Reads only Auth identity and the dedicated OAuth store. Never Storage/clinical tables.
export function serve(kind: "start" | "callback" | "setup") {
  return async (request: Request): Promise<Response> => {
    try {
      const baseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const clientId = Deno.env.get("BC_DRIVE_CLIENT_ID") || "";
      const clientSecret = Deno.env.get("BC_DRIVE_CLIENT_SECRET") || "";
      if (baseUrl !== BASE || clientId !== CLIENT || !serviceKey || clientSecret.length < 20) throw new SetupError();
      const config: Config = {
        baseUrl, clientId, clientSecret,
        appOrigin: "https://bcesteticaavancada.github.io",
        enabled: Deno.env.get("BC_DRIVE_OAUTH_ENABLE_SETUP") === "true",
        writes: Deno.env.get("BC_DRIVE_BACKUP_ENABLE_WRITES") || "",
        pickerKey: Deno.env.get("BC_DRIVE_PICKER_API_KEY") || "",
      };
      const deps: Dependencies = {
        now: Date.now,
        fetch,
        authenticate: async (token) => {
          const response = await fetch(baseUrl + "/auth/v1/user", {
            headers: { apikey: serviceKey, Authorization: "Bearer " + token },
            redirect: "error", signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) return null;
          const body = await json(response);
          if (typeof body.id !== "string") return null;
          return { id: body.id, email: typeof body.email === "string" ? body.email : undefined,
            email_confirmed_at: typeof body.email_confirmed_at === "string" ? body.email_confirmed_at : undefined };
        },
        store: async (operation, payload) => {
          const response = await fetch(baseUrl + "/rest/v1/rpc/bc_drive_oauth_store", {
            method: "POST", redirect: "error", headers: { apikey: serviceKey,
              Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
            body: JSON.stringify({ p_operation: operation, p_payload: payload }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new SetupError("store_unavailable", 503);
          return JSON.parse(await limitedText(response, 16384));
        },
      };
      return await createOAuthHandler(kind, config, deps)(request);
    } catch {
      // Do not include request URLs, codes, tokens, config or upstream responses.
      return new Response('{"error":"setup_unavailable"}', { status: 503,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    }
  };
}
