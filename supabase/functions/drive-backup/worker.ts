import {
  ACCOUNT,
  FOLDERS,
  checkFolder,
  checkToken,
  json,
  object,
} from "../_shared/drive-oauth/protocol.ts";
import {
  destination,
  isAllowedRoot,
  isFinancialPath,
  isPrivatePermissionSet,
  safeFileName,
  sha256Hex,
  sourceKey,
  type Entry,
} from "./core.ts";

export type Config = { clientId: string; clientSecret: string };
export type StorageItem = {
  id?: string | null;
  name: string;
  updated_at?: string;
  metadata?: { size?: number; mimetype?: string; contentType?: string } | null;
};
export type Dependencies = {
  now: () => number;
  store: (op: string, payload: Record<string, unknown>) => Promise<unknown>;
  oauth: (op: string, payload: Record<string, unknown>) => Promise<unknown>;
  list: (prefix: string, offset: number) => Promise<StorageItem[]>;
  download: (path: string) => Promise<Response>;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
};
const BUCKET = "bc-prontuario-private",
  MAX_OBJECTS = 3000,
  BATCH = 12,
  MAX_BYTES = 12 * 1024 * 1024;
const DRIVE = "https://www.googleapis.com/drive/v3/";
const FILE_FIELDS =
  "id,name,size,mimeType,trashed,driveId,parents,owners(emailAddress),appProperties";
const MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED = new Set([ACCOUNT, "mluisafdeassis@gmail.com"]);
type Kind = "clinical" | "client";
type Version = {
  source_key: string;
  source_path: string;
  source_updated: string;
  hash: string;
  file_id: string;
  kind: Kind;
  bytes: number;
  mime: string;
  status: string;
  verified_at?: string;
};
class Failure extends Error {
  constructor(public code: string) {
    super(code);
  }
}
function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
export async function limitedBytes(
  r: Response,
  limit: number,
): Promise<Uint8Array> {
  const reader = r.body?.getReader();
  if (!reader) throw new Failure("missing_body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const v = await reader.read();
      if (v.done) break;
      size += v.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Failure("object_too_large");
      }
      chunks.push(v.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const b of chunks) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}
export function createBackupHandler(config: Config, deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    let runId = "",
      stage = "request",
      lastError = "",
      copyCursor = "",
      auditCursor = "";
    const deadline = deps.now() + 110000;
    const c = {
      scanned: 0,
      eligible: 0,
      pending: 0,
      selected: 0,
      uploaded: 0,
      reused: 0,
      verified: 0,
      audited: 0,
      failed: 0,
      oversized: 0,
      excluded: 0,
      remaining: 0,
    };
    function time() {
      const left = deadline - deps.now();
      if (left < 1500) throw new Failure("deadline");
      return Math.max(1, Math.floor(Math.min(20000, left)));
    }
    async function store(op: string, p: Record<string, unknown> = {}) {
      time();
      return await deps.store(op, {
        ...p,
        ...(runId ? { run_id: runId } : {}),
      });
    }
    try {
      if (req.method !== "POST")
        return response({ ok: false, error: "method_not_allowed" }, 405);
      if (req.headers.has("origin"))
        return response({ ok: false, error: "browser_not_allowed" }, 403);
      const secret = req.headers.get("x-bc-backup-secret") || "";
      if (secret.length < 32 || secret.length > 256)
        return response({ ok: false, error: "unauthorized" }, 401);
      let body: Record<string, unknown>;
      try {
        body = await json(req, 128);
      } catch {
        return response({ ok: false, error: "invalid_request" }, 400);
      }
      if (body.action !== "run" || Object.keys(body).length !== 1)
        return response({ ok: false, error: "invalid_request" }, 400);
      if (
        (await store("authorize", {
          secret_hash: await sha256Hex(new TextEncoder().encode(secret)),
        })) !== true
      )
        return response({ ok: false, error: "unauthorized" }, 401);
      const claim = object(await store("begin"));
      if (claim.disabled === true)
        return response({ ok: false, error: "backup_disabled" }, 503);
      if (claim.busy === true)
        return response({ ok: false, error: "backup_running" }, 409);
      if (
        typeof claim.run_id !== "string" ||
        !/^[a-f0-9-]{36}$/.test(claim.run_id) ||
        typeof claim.user_id !== "string"
      )
        throw new Failure("invalid_lease");
      runId = claim.run_id;
      copyCursor =
        typeof claim.copy_cursor === "string" ? claim.copy_cursor : "";
      auditCursor =
        typeof claim.audit_cursor === "string" ? claim.audit_cursor : "";
      stage = "storage_inventory";
      const prefixes = [""],
        entries: Entry[] = [];
      let nodes = 0;
      for (let f = 0; f < prefixes.length; f++) {
        for (let offset = 0; ;) {
          time();
          const items = await deps.list(prefixes[f], offset);
          if (!Array.isArray(items) || items.length > 100)
            throw new Failure("invalid_inventory");
          for (const item of items) {
            if (++nodes > MAX_OBJECTS) throw new Failure("inventory_limit");
            if (item.name === ".emptyFolderPlaceholder") continue;
            if (
              !item.name ||
              item.name.includes("/") ||
              item.name === "." ||
              item.name === ".."
            )
              throw new Failure("invalid_source_path");
            const path = prefixes[f]
              ? prefixes[f] + "/" + item.name
              : item.name;
            if (isFinancialPath(path)) {
              c.excluded++;
              continue;
            }
            if (!isAllowedRoot(path)) throw new Failure("unclassified_source");
            if (!item.id) {
              prefixes.push(path);
              continue;
            }
            if (
              !destination(path) ||
              !item.updated_at ||
              !Number.isFinite(Date.parse(item.updated_at))
            )
              throw new Failure("invalid_source_metadata");
            const size = Number(item.metadata?.size),
              mime = String(
                item.metadata?.mimetype || item.metadata?.contentType || "",
              );
            if (!Number.isSafeInteger(size) || size < 1 || !MIME.has(mime))
              throw new Failure("invalid_source_metadata");
            entries.push({ path, updatedAt: item.updated_at, size, mime });
          }
          if (items.length < 100) break;
          offset += items.length;
        }
      }
      entries.sort((a, b) => a.path.localeCompare(b.path));
      c.scanned = entries.length;
      c.eligible = entries.length;
      c.oversized = entries.filter((e) => e.size > MAX_BYTES).length;
      stage = "oauth";
      const identity = { user_id: claim.user_id, client_id: config.clientId };
      const status = object(await deps.oauth("status", identity));
      if (status.connected !== true || status.folders_ready !== true)
        throw new Failure("oauth_not_ready");
      const credential = object(await deps.oauth("read", identity));
      if (
        credential.user_id !== claim.user_id ||
        credential.client_id !== config.clientId ||
        credential.account !== ACCOUNT ||
        typeof credential.refresh_token !== "string" ||
        credential.refresh_token.length < 16
      )
        throw new Failure("oauth_not_ready");
      async function google(
        url: string,
        init: RequestInit = {},
        token?: string,
        allow404 = false,
        allow409 = false,
      ) {
        const headers = new Headers(init.headers);
        if (token) headers.set("Authorization", "Bearer " + token);
        const r = await deps.fetch(url, {
          ...init,
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(time()),
        });
        if (
          !r.ok &&
          !(allow404 && r.status === 404) &&
          !(allow409 && r.status === 409)
        )
          throw new Failure("google_http_" + r.status);
        return r;
      }
      const token = checkToken(
        await json(
          await google("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: config.clientId,
              client_secret: config.clientSecret,
              refresh_token: credential.refresh_token,
            }),
          }),
        ),
        false,
      ).access;
      const about = await json(
        await google(DRIVE + "about?fields=user(emailAddress)", {}, token),
      );
      if (object(about.user).emailAddress !== ACCOUNT)
        throw new Failure("wrong_google_account");
      stage = "folder_privacy";
      for (const folder of Object.values(FOLDERS)) {
        const meta = await json(
          await google(
            DRIVE +
              "files/" +
              folder +
              "?fields=id,mimeType,trashed,driveId,owners(emailAddress),capabilities(canAddChildren)",
            {},
            token,
          ),
        );
        const ps = await json(
          await google(
            DRIVE +
              "files/" +
              folder +
              "/permissions?fields=nextPageToken,permissions(type,role,emailAddress,deleted,pendingOwner)&pageSize=100",
            {},
            token,
          ),
        );
        checkFolder(meta, ps, folder);
      }
      async function getFile(id: string) {
        if (!/^[\w-]{3,200}$/.test(id)) throw new Failure("invalid_file_id");
        const r = await google(
          DRIVE + "files/" + id + "?fields=" + encodeURIComponent(FILE_FIELDS),
          {},
          token,
          true,
        );
        return r.status === 404 ? null : await json(r);
      }
      async function verify(meta: Record<string, unknown>, v: Version) {
        const p = object(meta.appProperties);
        if (
          meta.id !== v.file_id ||
          meta.trashed !== false ||
          meta.driveId ||
          meta.mimeType !== v.mime ||
          Number(meta.size) !== v.bytes ||
          !Array.isArray(meta.parents) ||
          meta.parents.length !== 1 ||
          meta.parents[0] !== FOLDERS[v.kind] ||
          !Array.isArray(meta.owners) ||
          meta.owners.length !== 1 ||
          object(meta.owners[0]).emailAddress !== ACCOUNT ||
          p.bcSourceKey !== v.source_key ||
          p.bcContentSha256 !== v.hash ||
          p.bcBackupVersion !== "2"
        )
          throw new Failure("remote_metadata_mismatch");
        const info = await json(
          await google(
            DRIVE +
              "files/" +
              v.file_id +
              "/permissions?fields=nextPageToken,permissions(type,role,emailAddress,deleted,pendingOwner)&pageSize=100",
            {},
            token,
          ),
        );
        if (
          info.nextPageToken ||
          !Array.isArray(info.permissions) ||
          info.permissions.length > 2 ||
          !isPrivatePermissionSet(info.permissions, ALLOWED) ||
          info.permissions.some(
            (p) => p.deleted === true || p.pendingOwner === true,
          ) ||
          !info.permissions.some(
            (p) => p.role === "owner" && p.emailAddress === ACCOUNT,
          )
        )
          throw new Failure("remote_not_private");
        const restored = await limitedBytes(
          await google(DRIVE + "files/" + v.file_id + "?alt=media", {}, token),
          MAX_BYTES,
        );
        if (
          restored.length !== v.bytes ||
          (await sha256Hex(restored)) !== v.hash
        )
          throw new Failure("restoration_mismatch");
        await store("record", {
          source_key: v.source_key,
          hash: v.hash,
          file_id: v.file_id,
        });
      }
      stage = "journal";
      const keyed = [];
      for (const e of entries)
        keyed.push({ ...e, key: await sourceKey(BUCKET, e.path) });
      keyed.sort((a, b) => a.key.localeCompare(b.key));
      const known = new Map<string, Version>();
      // Bound each response and ignore historical paths absent from the current bucket.
      for (let offset = 0; offset < keyed.length; offset += 100) {
        const keys = keyed.slice(offset, offset + 100).map((e) => e.key);
        const raw = await store("snapshot", { source_keys: keys });
        if (!Array.isArray(raw) || raw.length > keys.length)
          throw new Failure("invalid_journal");
        for (const value of raw) {
          const v = object(value) as unknown as Version;
          if (!keys.includes(v.source_key))
            throw new Failure("invalid_journal");
          known.set(v.source_key, v);
        }
      }
      function rotate<T>(
        items: T[],
        key: (v: T) => string,
        cursor: string,
      ): T[] {
        const i = items.findIndex((v) => key(v) > cursor);
        return i < 0 ? items : [...items.slice(i), ...items.slice(0, i)];
      }
      const pending = rotate(
        keyed.filter((e) => {
          const v = known.get(e.key);
          return (
            e.size <= MAX_BYTES &&
            (!v || v.status !== "verified" || v.source_updated !== e.updatedAt)
          );
        }),
        (e) => e.key,
        copyCursor,
      );
      c.pending = pending.length;
      c.selected = Math.min(BATCH, pending.length);
      c.remaining = pending.length;
      const touched = new Set<string>();
      for (const entry of pending.slice(0, BATCH)) {
        try {
          stage = "source_download";
          time();
          copyCursor = entry.key;
          const r = await deps.download(entry.path);
          if (!r.ok) throw new Failure("source_download_failed");
          const bytes = await limitedBytes(r, MAX_BYTES);
          if (bytes.length !== entry.size)
            throw new Failure("source_changed_during_copy");
          const hash = await sha256Hex(bytes),
            kind = destination(entry.path);
          if (!kind) throw new Failure("unclassified_source");
          const ids = await json(
            await google(
              DRIVE + "files/generateIds?count=1&space=drive&type=files",
              {},
              token,
            ),
          );
          if (
            !Array.isArray(ids.ids) ||
            ids.ids.length !== 1 ||
            typeof ids.ids[0] !== "string"
          )
            throw new Failure("id_reservation_failed");
          const v = object(
            await store("reserve", {
              source_key: entry.key,
              source_path: entry.path,
              source_updated: entry.updatedAt,
              hash,
              kind,
              bytes: bytes.length,
              mime: entry.mime,
              file_id: ids.ids[0],
            }),
          ) as unknown as Version;
          if (
            v.source_key !== entry.key ||
            v.hash !== hash ||
            v.kind !== kind ||
            v.bytes !== bytes.length ||
            v.mime !== entry.mime
          )
            throw new Failure("journal_mismatch");
          stage = "remote_copy";
          let remote = await getFile(v.file_id);
          if (!remote) {
            await store("assert");
            const name = safeFileName(entry.path, entry.key).replace(
              /(\.[^.]+)$/,
              "-" + hash.slice(0, 12) + "$1",
            );
            const meta = {
              id: v.file_id,
              name,
              mimeType: entry.mime,
              parents: [FOLDERS[kind]],
              appProperties: {
                bcSourceKey: entry.key,
                bcSourceUpdated: entry.updatedAt,
                bcContentSha256: hash,
                bcBackupVersion: "2",
              },
            };
            const boundary =
              "bcbackup" + crypto.randomUUID().replaceAll("-", "");
            const multipart = new Blob(
              [
                `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${entry.mime}\r\n\r\n`,
                new Uint8Array(bytes).buffer,
                `\r\n--${boundary}--\r\n`,
              ],
              { type: "multipart/related; boundary=" + boundary },
            );
            const uploaded = await google(
              "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=" +
                encodeURIComponent(FILE_FIELDS),
              {
                method: "POST",
                headers: { "Content-Type": multipart.type },
                body: multipart,
              },
              token,
              false,
              true,
            );
            if (uploaded.status === 409) {
              remote = await getFile(v.file_id);
              c.reused++;
            } else {
              remote = await json(uploaded);
              c.uploaded++;
            }
          } else c.reused++;
          stage = "restoration";
          if (!remote) throw new Failure("remote_missing");
          await verify(remote, v);
          c.verified++;
          c.remaining--;
          touched.add(entry.key);
        } catch (error) {
          c.failed++;
          lastError =
            error instanceof Failure ? error.code : "item_unavailable";
          if (lastError === "deadline") break;
        }
      }
      // Independent circular audit cursor advances on attempted failures as well.
      const audits = rotate(
        keyed
          .filter(
            (e) => !touched.has(e.key) && !pending.some((p) => p.key === e.key),
          )
          .map((e) => known.get(e.key))
          .filter((v): v is Version => Boolean(v && v.status === "verified")),
        (v) => v.source_key,
        auditCursor,
      );
      for (const v of audits.slice(0, BATCH)) {
        try {
          stage = "audit";
          time();
          auditCursor = v.source_key;
          const meta = await getFile(v.file_id);
          if (!meta) throw new Failure("remote_missing");
          await verify(meta, v);
          c.audited++;
        } catch (error) {
          c.failed++;
          lastError =
            error instanceof Failure ? error.code : "audit_unavailable";
          if (lastError === "deadline") break;
        }
      }
      const ok = c.failed === 0 && c.oversized === 0 && c.remaining === 0;
      await deps.store("finish", {
        run_id: runId,
        status: ok ? "success" : "partial",
        counters: c,
        error_code: ok ? null : lastError || "pending_or_failed_objects",
        copy_cursor: copyCursor || null,
        audit_cursor: auditCursor || null,
      });
      return response({ ok, run_id: runId, ...c }, ok ? 200 : 503);
    } catch (error) {
      const code =
        error instanceof Failure
          ? error.code
          : stage === "oauth"
            ? "oauth_unavailable"
            : stage === "folder_privacy"
              ? "folder_not_private"
              : "backup_failed";
      if (runId) {
        try {
          await deps.store("finish", {
            run_id: runId,
            status: "failed",
            counters: c,
            error_code: code,
            copy_cursor: copyCursor || null,
            audit_cursor: auditCursor || null,
          });
        } catch {
          /* persisted running lease becomes abandoned on next claim */
        }
      }
      return response(
        {
          ok: false,
          ...(runId ? { run_id: runId } : {}),
          ...c,
          error: code,
          stage,
        },
        503,
      );
    }
  };
}
