import { ACCOUNT, FOLDERS, checkFolder, checkToken, json, object } from "../_shared/drive-oauth/protocol.ts";
import { destination, isPrivatePermissionSet, secureEqual, sha256Hex, sourceKey } from "../drive-backup/core.ts";

export type InvocationConfig = { runId: string; userId: string; invocationHash: string; issuedAt: number; expiresAt: number };
export type Config = InvocationConfig & { clientId: string; clientSecret: string; writes: string; setupEnabled: boolean };
type Dependencies = { now: () => number; store: (op: "status" | "read", payload: Record<string, unknown>) => Promise<unknown>;
  fetch: (url: string, init?: RequestInit) => Promise<Response> };
type Kind = "clinical" | "client";
const DRIVE = "https://www.googleapis.com/drive/v3/";
const FILE_FIELDS = "id,name,size,mimeType,trashed,parents,owners(emailAddress),appProperties";
const encoder = new TextEncoder();
class Failure extends Error { constructor(public code: string, public status = 502) { super(code); } }
function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
async function limitedBytes(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new Failure("missing_restoration_body");
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      total += chunk.value.length;
      if (total > limit) { await reader.cancel(); throw new Failure("restoration_too_large"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

// ASCII, valid PDF; no patient, clinical claim, signature or caller-provided data.
function fixturePdf(run: string, version: number): Uint8Array {
  const stream = `BT /F1 14 Tf 40 780 Td (TESTE DE FLUXO - SEM VALIDADE CLINICA) Tj 0 -28 Td (BC BACKUP ${run}) Tj 0 -28 Td (VERSION ${version} - DADOS INTEIRAMENTE FICTICIOS) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((body, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n` + offsets.slice(1).map(n => String(n).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(pdf);
}

export function createRehearsalHandler(config: Config, deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    let stage = "gate";
    let created = 0, reused = 0;
    try {
      if (request.method !== "POST") return response({ ok: false, error: "method_not_allowed" }, 405);
      if (request.headers.has("origin")) return response({ ok: false, error: "access_denied" }, 403);
      const raw = request.headers.get("authorization") || "";
      const capability = raw.startsWith("Bearer ") ? raw.slice(7) : "";
      if (capability.length < 32 || capability.length > 512 || !/^[a-f0-9]{64}$/.test(config.invocationHash) ||
        !secureEqual(await sha256Hex(encoder.encode(capability)), config.invocationHash)) {
        return response({ ok: false, error: "access_denied" }, 403);
      }
      const now = deps.now();
      if (!Number.isFinite(config.issuedAt) || !Number.isFinite(config.expiresAt) || now < config.issuedAt - 10000 ||
        now >= config.expiresAt || config.expiresAt - config.issuedAt > 3600000) {
        return response({ ok: false, error: "rehearsal_expired" }, 410);
      }
      if (config.writes !== "false" || config.setupEnabled !== true) return response({ ok: false, error: "unsafe_configuration" }, 503);
      if (!/^[a-f0-9-]{36}$/.test(config.runId) || !/^[a-f0-9-]{36}$/.test(config.userId)) throw new Failure("invalid_run");
      if (!request.headers.get("content-type")?.startsWith("application/json")) return response({ ok: false, error: "invalid_request" }, 400);
      let body: Record<string, unknown>;
      try { body = await json(request, 256); } catch { return response({ ok: false, error: "invalid_request" }, 400); }
      if (body.action !== "run" || Object.keys(body).length !== 1) return response({ ok: false, error: "invalid_request" }, 400);

      stage = "connection";
      const payload = { user_id: config.userId, client_id: config.clientId };
      const status = object(await deps.store("status", payload));
      if (status.connected !== true || status.folders_ready !== true) throw new Failure("connection_not_ready", 403);
      const credential = object(await deps.store("read", payload));
      if (credential.user_id !== config.userId || credential.client_id !== config.clientId || credential.account !== ACCOUNT ||
        typeof credential.refresh_token !== "string" || credential.refresh_token.length < 16) throw new Failure("invalid_connection", 403);
      async function google(url: string, init: RequestInit = {}, access?: string): Promise<Response> {
        const h = new Headers(init.headers); if (access) h.set("Authorization", "Bearer " + access);
        const r = await deps.fetch(url, { ...init, headers: h, redirect: "error", signal: AbortSignal.timeout(20000) });
        if (!r.ok) throw new Failure("google_http_" + r.status);
        return r;
      }
      stage = "oauth_refresh";
      const token = checkToken(await json(await google("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
          grant_type: "refresh_token", client_id: config.clientId, client_secret: config.clientSecret,
          refresh_token: credential.refresh_token,
        }),
      })), false);
      const about = await json(await google(DRIVE + "about?fields=user(emailAddress)", {}, token.access));
      if (object(about.user).emailAddress !== ACCOUNT) throw new Failure("wrong_google_account", 403);

      stage = "folder_privacy";
      for (const folderId of Object.values(FOLDERS)) {
        const meta = await json(await google(DRIVE + "files/" + folderId + "?fields=id,mimeType,trashed,driveId,owners(emailAddress),capabilities(canAddChildren)", {}, token.access));
        const permissions = await json(await google(DRIVE + "files/" + folderId + "/permissions?fields=nextPageToken,permissions(type,role,emailAddress,deleted,pendingOwner)&pageSize=100", {}, token.access));
        checkFolder(meta, permissions, folderId);
      }

      async function verifyFile(meta: Record<string, unknown>, kind: Kind, version: number, bytes: Uint8Array) {
        const hash = await sha256Hex(bytes), props = object(meta.appProperties);
        if (typeof meta.id !== "string" || !/^[\w-]{3,200}$/.test(meta.id) || meta.mimeType !== "application/pdf" ||
          meta.trashed !== false || Number(meta.size) !== bytes.length || !Array.isArray(meta.parents) ||
          meta.parents.length !== 1 || meta.parents[0] !== FOLDERS[kind] || props.bcTestRunId !== config.runId ||
          props.bcTestKind !== kind || props.bcTestVersion !== String(version) || props.bcContentSha256 !== hash ||
          meta.name !== `TESTE_BC_BACKUP_${config.runId}_${kind}_v${version}.pdf` || !Array.isArray(meta.owners) ||
          meta.owners.length !== 1 || object(meta.owners[0]).emailAddress !== ACCOUNT) throw new Failure("foreign_or_invalid_fixture");
        stage = "file_privacy";
        const info = await json(await google(DRIVE + "files/" + meta.id + "/permissions?fields=nextPageToken,permissions(type,role,emailAddress,deleted,pendingOwner)&pageSize=100", {}, token.access));
        const ps = info.permissions;
        if (info.nextPageToken || !Array.isArray(ps) || ps.length > 2 ||
          !isPrivatePermissionSet(ps, new Set([ACCOUNT, "mluisafdeassis@gmail.com"])) ||
          ps.some(p => p.deleted === true || p.pendingOwner === true) ||
          !ps.some(p => p.role === "owner" && p.emailAddress === ACCOUNT)) throw new Failure("fixture_not_private");
        stage = "restoration";
        const downloaded = await limitedBytes(await google(DRIVE + "files/" + meta.id + "?alt=media", {}, token.access), 8192);
        const restoredHash = await sha256Hex(downloaded);
        if (downloaded.length !== bytes.length || restoredHash !== hash) throw new Failure("restoration_mismatch");
        return { id: meta.id, sha256: hash, restored_sha256: restoredHash, bytes: bytes.length };
      }
      async function ensure(kind: Kind, version: number) {
        const bytes = fixturePdf(config.runId, version), hash = await sha256Hex(bytes);
        const root = kind === "clinical" ? "documentos" : "arquivos-clientes";
        const path = `${root}/__TESTE_BC_BACKUP__/${config.runId}/fixture.pdf`;
        if (destination(path) !== kind) throw new Failure("invalid_fixture_classification");
        const key = await sourceKey("bc-prontuario-private", path);
        stage = "fixture_lookup";
        const q = `'${FOLDERS[kind]}' in parents and trashed = false and appProperties has { key='bcTestRunId' and value='${config.runId}' } and appProperties has { key='bcTestKind' and value='${kind}' } and appProperties has { key='bcContentSha256' and value='${hash}' }`;
        const params = new URLSearchParams({ q, fields: `nextPageToken,files(${FILE_FIELDS})`, pageSize: "10" });
        const result = await json(await google(DRIVE + "files?" + params, {}, token.access));
        if (result.nextPageToken || !Array.isArray(result.files) || result.files.length > 1) throw new Failure("ambiguous_fixture");
        let file: Record<string, unknown>;
        if (result.files.length) { file = object(result.files[0]); reused++; }
        else {
          stage = "fixture_upload";
          const metadata = { name: `TESTE_BC_BACKUP_${config.runId}_${kind}_v${version}.pdf`, parents: [FOLDERS[kind]],
            appProperties: { bcTestRunId: config.runId, bcTestKind: kind, bcTestVersion: String(version), bcContentSha256: hash,
              bcSourceKey: key, bcBackupVersion: "test-only-v1" } };
          const boundary = "bctest" + crypto.randomUUID().replaceAll("-", "");
          const multipart = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`, new Uint8Array(bytes).buffer,
            `\r\n--${boundary}--\r\n`], { type: "multipart/related; boundary=" + boundary });
          file = await json(await google("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=" + encodeURIComponent(FILE_FIELDS),
            { method: "POST", headers: { "Content-Type": multipart.type }, body: multipart }, token.access));
          created++;
        }
        return await verifyFile(file, kind, version, bytes);
      }

      const destinations = [];
      for (const kind of ["clinical", "client"] as Kind[]) {
        const v1 = await ensure(kind, 1), repeated = await ensure(kind, 1), v2 = await ensure(kind, 2);
        if (v1.id !== repeated.id || v1.id === v2.id || v1.sha256 === v2.sha256) throw new Failure("version_or_duplicate_failure");
        stage = "previous_version";
        const old = await json(await google(DRIVE + "files/" + v1.id + "?fields=" + encodeURIComponent(FILE_FIELDS), {}, token.access));
        await verifyFile(old, kind, 1, fixturePdf(config.runId, 1));
        destinations.push({ kind, v1, v2, previous_version_preserved: true, restored: true });
      }
      return response({ ok: true, run_id: config.runId, fixture_only: true, backup_writes_enabled: false, created, reused, destinations });
    } catch (error) {
      return response({ ok: false, error: error instanceof Failure ? error.code : "rehearsal_failed", stage, created, reused },
        error instanceof Failure ? error.status : 502);
    }
  };
}
