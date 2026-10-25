import { createBackupHandler, type StorageItem } from "./worker.ts";
import { limitedText } from "../_shared/drive-oauth/protocol.ts";

const PROJECT = "https://tpqsmerlxquyrzrjbogj.supabase.co";
const CLIENT =
  "530925228983-23076omi6omga78n5vavvkfub0v7uaq5.apps.googleusercontent.com";
export async function handler(request: Request): Promise<Response> {
  try {
    const base = Deno.env.get("SUPABASE_URL") || "",
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const clientId = Deno.env.get("BC_DRIVE_CLIENT_ID") || "",
      clientSecret = Deno.env.get("BC_DRIVE_CLIENT_SECRET") || "";
    if (
      base !== PROJECT || !key || clientId !== CLIENT ||
      clientSecret.length < 20
    ) throw Error("configuration");
    async function server(path: string, payload?: unknown): Promise<Response> {
      const r = await fetch(base + path, {
        method: payload === undefined ? "GET" : "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!r.ok) throw Error("server_unavailable");
      return r;
    }
    async function rpc(name: string, op: string, p: Record<string, unknown>) {
      const r = await server("/rest/v1/rpc/" + name, {
        p_operation: op,
        p_payload: p,
      });
      return JSON.parse(await limitedText(r, 2 * 1024 * 1024));
    }
    return await createBackupHandler({
      clientId,
      clientSecret,
    }, {
      now: Date.now,
      fetch,
      store: (op, p) => rpc("bc_drive_backup_store_v2", op, p),
      oauth: (op, p) => rpc("bc_drive_oauth_store", op, p),
      list: async (prefix, offset) =>
        JSON.parse(
          await limitedText(
            await server("/storage/v1/object/list/bc-prontuario-private", {
              prefix,
              offset,
              limit: 100,
              sortBy: { column: "name", order: "asc" },
            }),
            256 * 1024,
          ),
        ) as StorageItem[],
      download: (path) =>
        server(
          "/storage/v1/object/authenticated/bc-prontuario-private/" +
            path.split("/").map(encodeURIComponent).join("/"),
        ),
    })(request);
  } catch {
    return Response.json({ ok: false, error: "backup_unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
