import {
  allowedPath,
  BUCKET,
  destination,
  type Entry,
  isFinancialPath,
  MAX_BYTES,
  MIME_TYPES,
  safeFileName,
  secureEqual,
  sha256Hex,
  sourceKey,
  TEST_PREFIX,
} from "./core.ts";
import { type Artifact, Drive, readJson } from "./drive.ts";
import { buildManifest, parseManifest } from "./restore.ts";

export type StorageItem = {
  id?: string | null;
  name: string;
  updated_at?: string;
  metadata?: { size?: number; mimetype?: string; contentType?: string } | null;
};
export type Source = {
  list(
    prefix: string,
    options: { offset: number; limit: number },
    signal: AbortSignal,
  ): Promise<StorageItem[]>;
  read(
    path: string,
    maxBytes: number,
    signal: AbortSignal,
  ): Promise<Uint8Array>;
};
type Deps = {
  env: (name: string) => string | undefined;
  source: () => Source;
  fetch: typeof fetch;
};
const BATCH = 12, MAX_NODES = 3000;
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

async function enumerate(
  source: Source,
  signal: AbortSignal,
): Promise<{ entries: Entry[]; excluded: number }> {
  const folders = [TEST_PREFIX.slice(0, -1)],
    seenFolders = new Set(folders),
    seenFiles = new Set<string>(),
    entries: Entry[] = [];
  let visited = 0, excluded = 0;
  for (let i = 0; i < folders.length; i++) {
    for (let offset = 0;;) {
      signal.throwIfAborted();
      const items = await source.list(
        folders[i],
        { offset, limit: 100 },
        signal,
      );
      if (!Array.isArray(items) || items.length > 100) {
        throw Error("SOURCE_LIST_INVALID");
      }
      for (const item of items) {
        if (++visited > MAX_NODES) throw Error("SOURCE_SCAN_CAP");
        if (!item.name || item.name === ".emptyFolderPlaceholder") continue;
        if (
          item.name.includes("/") || /[\\\x00-\x1f]/.test(item.name) ||
          item.name === "." || item.name === ".."
        ) throw Error("SOURCE_PATH_INVALID");
        const path = folders[i] + "/" + item.name;
        if (isFinancialPath(path)) {
          excluded++;
          continue;
        }
        if (!item.id) {
          if (!seenFolders.has(path)) {
            seenFolders.add(path);
            folders.push(path);
          }
          continue;
        }
        if (seenFiles.has(path)) continue;
        seenFiles.add(path);
        entries.push({
          path,
          updatedAt: String(item.updated_at || ""),
          mime: String(
            item.metadata?.mimetype || item.metadata?.contentType ||
              "application/octet-stream",
          ),
          size: Number(item.metadata?.size ?? NaN),
        });
      }
      if (items.length < 100) break;
      offset += items.length;
    }
  }
  return {
    entries: entries.sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    ),
    excluded,
  };
}
function checksumValid(file: Artifact) {
  return /^[a-f0-9]{64}$/.test(file.sha256Checksum || "") &&
    file.sha256Checksum === file.appProperties?.bcContentSha256;
}
function completed(file: Artifact, manifestFiles: Artifact[], entry: Entry) {
  const p = file.appProperties || {},
    m = manifestFiles.find((m) => m.id === p.bcManifestId);
  return checksumValid(file) && Number(file.size) === entry.size &&
    p.bcVerified === "true" &&
    (p.bcObservedUpdated || p.bcSourceUpdated) === entry.updatedAt &&
    m?.sha256Checksum === p.bcManifestSha256 &&
    m?.appProperties?.bcDataFileId === file.id &&
    m?.appProperties?.bcObjectSha256 === file.sha256Checksum;
}
export function createBackupHandler(deps: Deps) {
  const required = (name: string) => {
    const value = deps.env(name)?.trim() || "";
    if (!value) throw Error("CONFIG_MISSING");
    return value;
  };
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return reply({ error: "Método não permitido." }, 405);
    }
    const expected = deps.env("BC_DRIVE_BACKUP_RUN_SECRET") || "";
    if (
      expected.length < 32 ||
      !secureEqual(request.headers.get("x-bc-backup-secret") || "", expected)
    ) return reply({ error: "Não autorizado." }, 401);
    const counters = {
      scanned: 0,
      selected: 0,
      uploaded: 0,
      reused: 0,
      failed: 0,
      oversized: 0,
      unsupported: 0,
      remaining: 0,
      excluded: 0,
      dryRun: true,
    };
    try {
      // Clinical mode is deliberately unavailable until a distributed lease and final approval.
      if ((deps.env("BC_DRIVE_BACKUP_SCOPE") || "test") !== "test") {
        throw Error("CLINICAL_ACTIVATION_PENDING");
      }
      const signal = AbortSignal.timeout(105000),
        source = deps.source(),
        scan = await enumerate(source, signal);
      counters.scanned = scan.entries.length;
      counters.excluded = scan.excluded;
      const eligible = scan.entries.filter((e) => {
        if (
          !allowedPath(e.path) || !MIME_TYPES.has(e.mime) ||
          !Number.isSafeInteger(e.size) || e.size <= 0 ||
          !Number.isFinite(Date.parse(e.updatedAt))
        ) {
          counters.unsupported++;
          return false;
        }
        if (e.size > MAX_BYTES) {
          counters.oversized++;
          return false;
        }
        return true;
      });
      if (deps.env("BC_DRIVE_BACKUP_ENABLE_WRITES") !== "true") {
        counters.selected = Math.min(eligible.length, BATCH);
        const ok = counters.oversized === 0 && counters.unsupported === 0;
        return reply({
          ok,
          ...counters,
          note: "Inspeção de arquivos fictícios; uploads desativados.",
        }, ok ? 200 : 503);
      }
      if (counters.oversized || counters.unsupported) {
        return reply({
          ok: false,
          ...counters,
          error: "Inventário de teste fora dos limites; lote bloqueado.",
        }, 503);
      }
      counters.dryRun = false;
      const root = required("BC_DRIVE_FOLDER_ROOT"),
        folders = {
          clinical: required("BC_DRIVE_FOLDER_CLINICAL"),
          client: required("BC_DRIVE_FOLDER_CLIENT"),
          manifest: required("BC_DRIVE_FOLDER_MANIFEST"),
        };
      if (new Set([root, ...Object.values(folders)]).size !== 4) {
        throw Error("DESTINATIONS_MUST_DIFFER");
      }
      let tokenResponse: Response;
      try {
        tokenResponse = await deps.fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            redirect: "error",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: required("BC_DRIVE_CLIENT_ID"),
              client_secret: required("BC_DRIVE_CLIENT_SECRET"),
              refresh_token: required("BC_DRIVE_REFRESH_TOKEN"),
              grant_type: "refresh_token",
            }),
            signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
          },
        );
      } catch {
        throw Error("OAUTH_TRANSPORT_FAILED");
      }
      if (!tokenResponse.ok) {
        await tokenResponse.body?.cancel();
        throw Error("OAUTH_REFRESH_FAILED");
      }
      const token = await readJson(tokenResponse, 16384);
      if (
        !token.access_token || token.token_type?.toLowerCase() !== "bearer" ||
        String(token.scope || "").trim() !==
          "https://www.googleapis.com/auth/drive.file"
      ) throw Error("OAUTH_SCOPE_INVALID");
      const drive = new Drive(String(token.access_token), deps.fetch, signal),
        owner = "decolarbh@gmail.com";
      const allowedAccounts = new Set(
        required("BC_DRIVE_ALLOWED_ACCOUNTS").split(",").map((email) =>
          email.trim().toLowerCase()
        ).filter(Boolean),
      );
      if (
        allowedAccounts.size !== 2 || !allowedAccounts.has(owner) ||
        !allowedAccounts.has("mluisafdeassis@gmail.com")
      ) throw Error("ALLOWED_ACCOUNTS_INVALID");
      await drive.privateFolder(root, owner, undefined, allowedAccounts);
      for (const folder of Object.values(folders)) {
        await drive.privateFolder(folder, owner, root, allowedAccounts);
      }
      const dataFiles = [
          ...await drive.list(folders.clinical),
          ...await drive.list(folders.client),
        ],
        manifestFiles = await drive.list(folders.manifest);
      const pending: Array<{ entry: Entry; key: string }> = [];
      for (const entry of eligible) {
        const key = await sourceKey(BUCKET, entry.path);
        if (
          !dataFiles.some((file) =>
            file.appProperties?.bcSourceKey === key &&
            completed(file, manifestFiles, entry)
          )
        ) pending.push({ entry, key });
      }
      counters.selected = Math.min(pending.length, BATCH);
      counters.remaining = Math.max(0, pending.length - BATCH);
      for (const { entry, key } of pending.slice(0, BATCH)) {
        try {
          signal.throwIfAborted();
          const bytes = await source.read(entry.path, MAX_BYTES, signal);
          if (bytes.length !== entry.size || bytes.length > MAX_BYTES) {
            throw Error("SOURCE_CHANGED_OR_TOO_LARGE");
          }
          const hash = await sha256Hex(bytes);
          let file = dataFiles.find((f) =>
              f.appProperties?.bcSourceKey === key &&
              f.sha256Checksum === hash && checksumValid(f) &&
              Number(f.size) === bytes.length
            ),
            fresh = false;
          if (!file) {
            file = await drive.upload(
              folders[destination(entry.path)!],
              safeFileName(entry.path, key).replace(
                /(\.[^.]+)$/,
                "-" + hash.slice(0, 12) + "$1",
              ),
              bytes,
              entry.mime,
              {
                bcSourceKey: key,
                bcSourceUpdated: entry.updatedAt,
                bcContentSha256: hash,
                bcBackupVersion: "2",
                bcKind: "object",
              },
            );
            dataFiles.push(file);
            fresh = true;
          }
          let manifest: Artifact | undefined;
          for (
            const candidate of manifestFiles.filter((m) =>
              m.appProperties?.bcDataFileId === file!.id &&
              m.appProperties?.bcObjectSha256 === hash
            )
          ) {
            // An unreadable existing manifest is not evidence of corruption.
            // Retry this item later instead of creating a duplicate on a transient failure.
            const raw = await drive.read(candidate.id, 65536);
            try {
              const m = await parseManifest(raw);
              if (
                m.path === entry.path && m.dataFileId === file.id &&
                m.sha256 === hash && m.size === entry.size &&
                await sha256Hex(raw) === candidate.sha256Checksum
              ) {
                manifest = candidate;
                break;
              }
            } catch {
              /* Unusable manifest stays preserved; create a verified replacement. */
            }
          }
          if (!manifest) {
            const raw = await buildManifest(entry, key, file.id, hash);
            manifest = await drive.upload(
              folders.manifest,
              "manifesto-" + key.slice(0, 32) + "-" + hash.slice(0, 12) +
                ".json",
              raw,
              "application/json",
              {
                bcKind: "manifest",
                bcDataFileId: file.id,
                bcObjectSha256: hash,
                bcBackupVersion: "2",
              },
            );
            manifestFiles.push(manifest);
          }
          await drive.acknowledge(file.id, {
            bcVerified: "true",
            bcManifestId: manifest.id,
            bcManifestSha256: manifest.sha256Checksum!,
            bcObservedUpdated: entry.updatedAt,
          });
          Object.assign(file.appProperties ||= {}, {
            bcVerified: "true",
            bcManifestId: manifest.id,
            bcManifestSha256: manifest.sha256Checksum!,
            bcObservedUpdated: entry.updatedAt,
          });
          if (fresh) counters.uploaded++;
          else counters.reused++;
        } catch {
          counters.failed++;
        }
      }
      const ok = counters.failed === 0 && counters.oversized === 0 &&
        counters.unsupported === 0;
      return reply({
        ok,
        ...counters,
        complete: ok && counters.remaining === 0,
        batchLimit: BATCH,
      }, ok ? 200 : 503);
    } catch {
      return reply({
        ok: false,
        ...counters,
        error:
          "Backup não homologado ou indisponível; verifique configuração, autorização e permissões em canal privado.",
      }, 503);
    }
  };
}
