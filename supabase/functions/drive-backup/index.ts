import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import {
  destination, safeFileName, secureEqual, selectPending, sha256Hex, sourceKey,
  type DriveRecord, type Entry,
} from "./core.ts";

// Internal worker. Not connected to the public site, agenda, or Maya.
const BUCKET = "bc-prontuario-private";
const MAX_OBJECTS = 3000;
const BATCH_LIMIT = 12;
const MAX_BYTES = 12 * 1024 * 1024;
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

type StorageItem = {
  id?: string | null;
  name: string;
  updated_at?: string;
  metadata?: { size?: number; mimetype?: string; contentType?: string } | null;
};
type RemoteFile = {
  id: string;
  appProperties?: Record<string, string>;
  size?: string;
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function required(name: string): string {
  const value = Deno.env.get(name)?.trim() || "";
  if (!value) throw new Error("Missing server configuration: " + name);
  return value;
}
function isFinancialPath(path: string): boolean {
  return path.split("/").some((part) => /^(financeiro|finance|comiss(?:ao|oes)|comissões|recibos?|caixa|pagamentos?|payouts?)$/i.test(part));
}
function looksLikeFolderId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{12,120}$/.test(id);
}
async function enumerateStorage(service: ReturnType<typeof createClient>): Promise<Entry[]> {
  const folders = [""];
  const result: Entry[] = [];
  for (let folderNumber = 0; folderNumber < folders.length; folderNumber++) {
    if (folders.length > MAX_OBJECTS) throw new Error("Folder scan safety cap reached");
    const prefix = folders[folderNumber];
    let offset = 0;
    while (true) {
      const { data, error } = await service.storage.from(BUCKET).list(prefix, {
        limit: 100, offset, sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error("Private Storage listing failed");
      const items = (data || []) as StorageItem[];
      for (const item of items) {
        if (!item.name || item.name === ".emptyFolderPlaceholder") continue;
        const path = prefix ? prefix + "/" + item.name : item.name;
        if (isFinancialPath(path)) continue;
        if (!item.id) {
          folders.push(path);
        } else {
          result.push({
            path,
            updatedAt: String(item.updated_at || ""),
            mime: String(item.metadata?.mimetype || item.metadata?.contentType || "application/octet-stream"),
            size: Number(item.metadata?.size || 0),
          });
        }
        if (result.length + folders.length > MAX_OBJECTS) {
          throw new Error("Storage scan safety cap reached; increase capacity before enabling");
        }
      }
      if (items.length < 100) break;
      offset += items.length;
    }
  }
  result.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return result;
}
async function accessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("BC_DRIVE_CLIENT_ID"),
      client_secret: required("BC_DRIVE_CLIENT_SECRET"),
      refresh_token: required("BC_DRIVE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error("Google OAuth refresh failed: HTTP " + response.status);
  const body = await response.json();
  if (!body?.access_token) throw new Error("Google OAuth returned no access token");
  return String(body.access_token);
}
async function googleRequest(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", "Bearer " + token);
  const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    // Never expose OAuth tokens, Drive response bodies, patient paths, or names.
    throw new Error("Google Drive API HTTP " + response.status);
  }
  return response;
}
async function assertWritableFolder(id: string, token: string): Promise<void> {
  if (!looksLikeFolderId(id)) throw new Error("Invalid destination folder ID");
  const response = await googleRequest(
    DRIVE_API + "/" + encodeURIComponent(id) + "?fields=id,mimeType,trashed,capabilities(canAddChildren)",
    token,
  );
  const folder = await response.json();
  if (folder.trashed || folder.mimeType !== "application/vnd.google-apps.folder" ||
    folder.capabilities?.canAddChildren !== true) {
    throw new Error("Drive folder is not an accessible writable private folder");
  }
}
async function listBackups(folders: string[], token: string): Promise<Map<string, DriveRecord>> {
  const results = new Map<string, DriveRecord>();
  for (const folderId of folders) {
    let page = "";
    do {
      const q = "'" + folderId + "' in parents and trashed = false";
      const params = new URLSearchParams({
        q, fields: "nextPageToken,files(id,appProperties,size)",
        pageSize: "1000",
      });
      if (page) params.set("pageToken", page);
      const response = await googleRequest(DRIVE_API + "?" + params.toString(), token);
      const json = await response.json();
      for (const file of (json.files || []) as RemoteFile[]) {
        const props = file.appProperties || {};
        if (/^[0-9a-f]{64}$/.test(props.bcSourceKey || "") && file.id) {
          const current = results.get(props.bcSourceKey);
          if (!current || (props.bcSourceUpdated || "") >= current.updatedAt) {
            results.set(props.bcSourceKey, {
              id: file.id,
              updatedAt: props.bcSourceUpdated || "",
              hash: props.bcContentSha256 || "",
            });
          }
        }
      }
      page = String(json.nextPageToken || "");
    } while (page);
  }
  return results;
}
function safeMime(input: string): string {
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(input) ? input : "application/octet-stream";
}
async function uploadToDrive(
  token: string, folderId: string, path: string, key: string, bytes: Uint8Array,
  mime: string, updatedAt: string, hash: string,
): Promise<void> {
  const metadata: Record<string, unknown> = {
    name: safeFileName(path, key).replace(/(\.[^.]+)$/, '-' + hash.slice(0, 12) + '$1'),
    appProperties: {
      bcSourceKey: key,
      bcSourceUpdated: updatedAt,
      bcContentSha256: hash,
      bcBackupVersion: "1",
    },
  };
  metadata.parents = [folderId];
  const boundary = "bcbackup" + crypto.randomUUID().replaceAll("-", "");
  const prefix = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) + "\r\n--" + boundary + "\r\nContent-Type: " + safeMime(mime) + "\r\n\r\n";
  const suffix = "\r\n--" + boundary + "--\r\n";
  const body = new Blob([prefix, bytes, suffix], {
    type: "multipart/related; boundary=" + boundary,
  });
  const url = DRIVE_UPLOAD + "?uploadType=multipart&fields=id,size,appProperties";
  const response = await googleRequest(url, token, {
    method: "POST",
    headers: { "Content-Type": body.type },
    body,
  });
  const uploaded = await response.json();
  if (!uploaded.id || Number(uploaded.size) !== bytes.length ||
    uploaded.appProperties?.bcContentSha256 !== hash) {
    throw new Error("Remote file metadata verification failed");
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  const expected = Deno.env.get("BC_DRIVE_BACKUP_RUN_SECRET") || "";
  const supplied = request.headers.get("x-bc-backup-secret") || "";
  if (expected.length < 32 || !secureEqual(supplied, expected)) {
    return reply({ error: "Não autorizado." }, 401);
  }
  const counters = { scanned: 0, selected: 0, uploaded: 0, failed: 0, oversized: 0, dryRun: true };
  try {
    const url = required("SUPABASE_URL");
    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
    const service = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const objects = await enumerateStorage(service);
    counters.scanned = objects.length;
    // Safety gate: code can be deployed for inspection with uploads disabled.
    if (Deno.env.get("BC_DRIVE_BACKUP_ENABLE_WRITES") !== "true") {
      counters.selected = Math.min(objects.length, BATCH_LIMIT);
      return reply({ ok: true, ...counters, note: "Uploads desativados no servidor." });
    }
    counters.dryRun = false;
    const folders = {
      clinical: required("BC_DRIVE_FOLDER_CLINICAL"),
      client: required("BC_DRIVE_FOLDER_CLIENT"),
    };
    const token = await accessToken();
    await assertWritableFolder(folders.clinical, token);
    await assertWritableFolder(folders.client, token);
    const known = await listBackups([folders.clinical, folders.client], token);
    const keyed = [];
    for (const entry of objects) {
      keyed.push({ ...entry, sourceKey: await sourceKey(BUCKET, entry.path) });
    }
    counters.oversized = keyed.filter((entry) => entry.size > MAX_BYTES).length;
    const pending = selectPending(keyed.filter((entry) => entry.size <= MAX_BYTES), known, BATCH_LIMIT);
    counters.selected = pending.length;
    for (const candidate of pending) {
      try {
        if (candidate.entry.size > MAX_BYTES) throw new Error("File exceeds backup v1 size cap");
        const { data, error } = await service.storage.from(BUCKET).download(candidate.entry.path);
        if (error || !data) throw new Error("Source download failed");
        const bytes = new Uint8Array(await data.arrayBuffer());
        if (bytes.length > MAX_BYTES) throw new Error("File exceeds backup v1 size cap");
        const hash = await sha256Hex(bytes);
        // If unchanged bytes but the updated_at changed, a metadata refresh is still safe.
        await uploadToDrive(
          token, folders[destination(candidate.entry.path)], candidate.entry.path,
          candidate.sourceKey, bytes, candidate.entry.mime,
          candidate.entry.updatedAt, hash,
        );
        counters.uploaded++;
      } catch (error) {
        counters.failed++;
        console.error("BC Drive backup item failed:", error instanceof Error ? error.message : "unknown");
      }
    }
    return reply({ ok: counters.failed === 0 && counters.oversized === 0, ...counters, batchLimit: BATCH_LIMIT, note: counters.oversized ? 'Arquivos grandes pendentes de tratamento.' : undefined },
      counters.failed || counters.oversized ? 503 : 200);
  } catch (error) {
    // Server logs contain only operational error types; never clinical identifiers.
    console.error("BC Drive backup batch failed:", error instanceof Error ? error.message : "unknown");
    return reply({ ok: false, ...counters, error: "Backup indisponível; verifique logs privados." }, 503);
  }
});
