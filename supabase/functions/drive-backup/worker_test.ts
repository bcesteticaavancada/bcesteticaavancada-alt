import { createBackupHandler } from "./worker.ts";
import { ACCOUNT, FOLDERS } from "../_shared/drive-oauth/protocol.ts";
import { sha256Hex, sourceKey } from "./core.ts";
function eq(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}
const enc = new TextEncoder(),
  secret = "fictional-run-secret-01234567890123456789";
const config = {
  clientId: "fictional-client",
  clientSecret: "fictional-client-secret",
};
const owner = [{ emailAddress: ACCOUNT }];
const permissions = {
  permissions: [{ type: "user", role: "owner", emailAddress: ACCOUNT }, {
    type: "user",
    role: "writer",
    emailAddress: "mluisafdeassis@gmail.com",
  }],
};
function fixture() {
  const files = new Map<
    string,
    { meta: Record<string, unknown>; bytes: Uint8Array }
  >();
  const rows = new Map<string, Record<string, unknown>>();
  const calls: string[] = [];
  let next = 1, claimed = false;
  let clock = 0;
  const state = {
    authorize: true,
    enabled: true,
    busy: false,
    count: 1,
    copyCursor: "",
    auditCursor: "",
    badRemoteIds: new Set<string>(),
    oauthFails: false,
    failAfterUpload: false,
    badHash: false,
    publicFolder: false,
    publicFile: false,
    movedFile: false,
    oversized: false,
    unknown: false,
    financial: false,
    finish: null as unknown,
  };
  let content = new Uint8Array([0xef, 0xbb, 0xbf, 65]);
  let updated = "2026-10-24T20:00:00.000Z";
  const path = "documentos/fictional/object.pdf";
  const deps = {
    now: () => clock,
    async oauth(op: string) {
      calls.push("oauth:" + op);
      return op === "status" ? { connected: true, folders_ready: true } : {
        account: ACCOUNT,
        client_id: config.clientId,
        user_id: "00000000-0000-4000-8000-000000000001",
        refresh_token: "fictional-refresh-token",
      };
    },
    async store(op: string, p: Record<string, unknown> = {}) {
      calls.push("store:" + op);
      if (op === "authorize") return state.authorize;
      if (op === "begin") {
        if (state.busy) return { busy: true };
        if (!state.enabled) return { disabled: true };
        claimed = true;
        return {
          run_id: "00000000-0000-4000-8000-000000000002",
          user_id: "00000000-0000-4000-8000-000000000001",
          copy_cursor: state.copyCursor || null,
          audit_cursor: state.auditCursor || null,
        };
      }
      if (op === "snapshot") {
        return [...rows.values()].filter((r) =>
          Array.isArray(p.source_keys) && p.source_keys.includes(r.source_key)
        );
      }
      if (op === "assert") {
        if (!claimed) throw Error("lease");
        return true;
      }
      if (op === "reserve") {
        const k = String(p.source_key) + ":" + String(p.hash);
        let r = rows.get(k);
        if (!r) {
          r = { ...p, status: "pending" };
          rows.set(k, r);
        }
        r.source_updated = p.source_updated;
        return r;
      }
      if (op === "record") {
        for (const r of rows.values()) {
          if (r.file_id === p.file_id) {
            r.status = "verified";
            r.verified_at = "2026-10-24T20:00:01Z";
          }
        }
        return true;
      }
      if (op === "finish") {
        state.finish = p;
        state.copyCursor = String(p.copy_cursor || "");
        state.auditCursor = String(p.audit_cursor || "");
        claimed = false;
        return true;
      }
      throw Error("unexpected op");
    },
    async list(prefix: string, offset: number) {
      calls.push("list");
      if (offset) return [];
      if (!prefix) {
        return [
          { name: state.unknown ? "unknown" : "documentos", id: null },
          ...(state.financial ? [{ name: "financeiro", id: null }] : []),
        ];
      }
      return Array.from({ length: state.count }, (_, i) => ({
        name: state.count === 1 ? "object.pdf" : `object-${i}.pdf`,
        id: "fictional-object-" + i,
        updated_at: updated,
        metadata: {
          size: state.oversized ? 13 * 1024 * 1024 : content.length,
          mimetype: "application/pdf",
        },
      }));
    },
    async download() {
      calls.push("source");
      return new Response(content);
    },
    async fetch(url: string, init: RequestInit = {}) {
      calls.push(url);
      if (url.includes("oauth2.googleapis")) {
        return state.oauthFails
          ? Response.json(
            { error: "invalid_grant", private: "must not leak" },
            { status: 400 },
          )
          : Response.json({
            access_token: "fictional-access",
            token_type: "Bearer",
            expires_in: 3600,
            scope: "https://www.googleapis.com/auth/drive.file",
          });
      }
      if (url.includes("/about?")) {
        return Response.json({ user: { emailAddress: ACCOUNT } });
      }
      if (url.includes("generateIds")) {
        return Response.json({ ids: ["reserved-file-" + next++] });
      }
      const u = new URL(url), id = u.pathname.split("/").pop()!;
      if (url.includes("/upload/")) {
        const raw = await (init.body as Blob).text();
        const m = JSON.parse(raw.split("\r\n\r\n")[1].split("\r\n--")[0]);
        if (files.has(m.id)) return Response.json({}, { status: 409 });
        const meta = {
          ...m,
          size: String(content.length),
          mimeType: "application/pdf",
          trashed: false,
          owners: owner,
        };
        files.set(m.id, { meta, bytes: new Uint8Array(content) });
        if (state.failAfterUpload) {
          state.failAfterUpload = false;
          throw Error("uncertain response");
        }
        return Response.json(meta);
      }
      if (Object.values(FOLDERS).some((x) => u.pathname.endsWith("/" + x))) {
        return Response.json({
          id,
          mimeType: "application/vnd.google-apps.folder",
          trashed: false,
          owners: owner,
          capabilities: { canAddChildren: true },
        });
      }
      if (url.includes("/permissions?")) {
        return Response.json(
          (state.publicFolder &&
              Object.values(FOLDERS).some((x) => url.includes(x))) ||
            (state.publicFile && url.includes("reserved-file"))
            ? { permissions: [{ type: "anyone", role: "reader" }] }
            : permissions,
        );
      }
      const f = files.get(id);
      if (!f) return Response.json({}, { status: 404 });
      if (u.searchParams.get("alt") === "media") {
        return new Response(
          new Uint8Array(
            state.badHash || state.badRemoteIds.has(id)
              ? enc.encode("corruption")
              : f.bytes,
          )
            .buffer,
        );
      }
      return Response.json(
        state.movedFile ? { ...f.meta, parents: ["different-folder"] } : f.meta,
      );
    },
  };
  function request(overrides: RequestInit = {}) {
    return new Request("https://worker.invalid", {
      method: "POST",
      headers: {
        "x-bc-backup-secret": secret,
        "content-type": "application/json",
      },
      body: '{"action":"run"}',
      ...overrides,
    });
  }
  return {
    state,
    files,
    rows,
    calls,
    deps,
    request,
    setContent: (value: Uint8Array) => {
      content = new Uint8Array(value);
      updated = "2026-10-24T21:00:00.000Z";
    },
    advance: (ms: number) => clock += ms,
  };
}
Deno.test("unauthenticated, browser, and caller-selected payloads never read sources", async () => {
  const f = fixture(), h = createBackupHandler(config, f.deps);
  eq((await h(f.request({ headers: {} }))).status, 401);
  eq(
    (await h(f.request({ headers: { origin: "https://site.invalid" } })))
      .status,
    403,
  );
  eq(
    (await h(f.request({ body: '{"action":"run","path":"financeiro/file"}' })))
      .status,
    400,
  );
  eq(f.calls.length, 0);
});
Deno.test("disabled gate and incorrect capability cannot claim or read sources", async () => {
  const f = fixture();
  f.state.authorize = false;
  eq((await createBackupHandler(config, f.deps)(f.request())).status, 401);
  eq(f.calls, ["store:authorize"]);
  f.state.authorize = true;
  f.state.enabled = false;
  f.calls.length = 0;
  eq(
    (await createBackupHandler(config, f.deps)(
      f.request(),
    )).status,
    503,
  );
  eq(f.calls, ["store:authorize", "store:begin"]);
});
Deno.test("lease rejects overlapping invocations", async () => {
  const f = fixture();
  f.state.busy = true;
  eq((await createBackupHandler(config, f.deps)(f.request())).status, 409);
  eq(f.calls, ["store:authorize", "store:begin"]);
});
Deno.test("uploads and restores raw BOM bytes; repeat creates zero copies and audits existing", async () => {
  const f = fixture(), h = createBackupHandler(config, f.deps);
  const first = await (await h(f.request())).json();
  eq(first.ok, true);
  eq(first.uploaded, 1);
  eq(first.verified, 1);
  eq(f.files.size, 1);
  const second = await (await h(f.request())).json();
  eq(second.ok, true);
  eq(second.uploaded, 0);
  eq(second.audited, 1);
  eq(f.files.size, 1);
  const r = [...f.rows.values()][0];
  eq(r.hash, await sha256Hex(new Uint8Array([0xef, 0xbb, 0xbf, 65])));
  eq(
    r.source_key,
    await sourceKey("bc-prontuario-private", "documentos/object.pdf"),
  );
});
Deno.test("timeout after remote create reuses durable ID on the next invocation", async () => {
  const f = fixture(), h = createBackupHandler(config, f.deps);
  f.state.failAfterUpload = true;
  const first = await h(f.request());
  eq(first.status, 503);
  eq(f.files.size, 1);
  eq([...f.rows.values()][0].status, "pending");
  const second = await (await h(f.request())).json();
  eq(second.ok, true);
  eq(second.uploaded, 0);
  eq(second.reused, 1);
  eq(f.files.size, 1);
});
Deno.test("new content preserves the previous version; metadata-only change reuses content", async () => {
  const f = fixture(), h = createBackupHandler(config, f.deps);
  await h(f.request());
  f.setContent(new Uint8Array([0xef, 0xbb, 0xbf, 65]));
  let r = await (await h(f.request())).json();
  eq(r.reused, 1);
  eq(f.files.size, 1);
  f.setContent(enc.encode("changed")); // force an actually new source timestamp
  for (const row of f.rows.values()) {
    row.source_updated = "2026-10-24T20:00:00.000Z";
  }
  r = await (await h(f.request())).json();
  eq(r.uploaded, 1);
  eq(f.files.size, 2);
});
Deno.test("sharing changes stop before upload", async () => {
  const f = fixture();
  f.state.publicFolder = true;
  eq((await createBackupHandler(config, f.deps)(f.request())).status, 503);
  eq(f.files.size, 0);
  eq(f.calls.includes("source"), false);
});
Deno.test("restore corruption never records success and does not expose error bodies", async () => {
  const f = fixture();
  f.state.badHash = true;
  const r = await createBackupHandler(config, f.deps)(f.request());
  const b = await r.json();
  eq(r.status, 503);
  eq(b.failed, 1);
  eq([...f.rows.values()][0].status, "pending");
  eq(JSON.stringify(b).includes("object.pdf"), false);
  eq(
    (f.state.finish as Record<string, unknown>).error_code,
    "restoration_mismatch",
  );
});
Deno.test("batch cap reports backlog and the next run finishes it", async () => {
  const f = fixture();
  f.state.count = 14;
  const h = createBackupHandler(config, f.deps);
  let b = await (await h(f.request())).json();
  eq(b.ok, false);
  eq(b.uploaded, 12);
  eq(b.remaining, 2);
  b = await (await h(f.request())).json();
  eq(b.ok, true);
  eq(b.uploaded, 2);
  eq(b.remaining, 0);
  eq(f.files.size, 14);
});
Deno.test("permanent copy failures cannot starve healthy objects after the first batch", async () => {
  const f = fixture();
  f.state.count = 14;
  const paths = await Promise.all(Array.from({ length: 14 }, async (_, i) => {
    const path = `documentos/object-${i}.pdf`;
    return { path, key: await sourceKey("bc-prontuario-private", path) };
  }));
  paths.sort((a, b) => a.key.localeCompare(b.key));
  const bad = new Set(paths.slice(0, 12).map((p) => p.path));
  const download = f.deps.download;
  f.deps.download = async (path?: string) =>
    bad.has(path || "")
      ? new Response("unavailable", { status: 503 })
      : download();
  const h = createBackupHandler(config, f.deps);
  let b = await (await h(f.request())).json();
  eq(b.uploaded, 0);
  eq(b.failed, 12);
  b = await (await h(f.request())).json();
  eq(b.uploaded, 2);
  eq(b.remaining, 12);
  eq(f.files.size, 2);
});
Deno.test("permanent audit failures cannot starve the other current copies", async () => {
  const f = fixture();
  f.state.count = 14;
  const h = createBackupHandler(config, f.deps);
  await h(f.request());
  await h(f.request());
  eq(f.files.size, 14);
  f.state.auditCursor = "";
  const versions = [...f.rows.values()].sort((a, b) =>
    String(a.source_key).localeCompare(String(b.source_key))
  );
  for (const v of versions.slice(0, 12)) {
    f.state.badRemoteIds.add(String(v.file_id));
  }
  let b = await (await h(f.request())).json();
  eq(b.audited, 0);
  eq(b.failed, 12);
  b = await (await h(f.request())).json();
  eq(b.audited, 2);
  eq(b.failed, 10);
  eq(f.files.size, 14);
});
Deno.test("OAuth expiration persists safe failure and never downloads a source", async () => {
  const f = fixture();
  f.state.oauthFails = true;
  const r = await createBackupHandler(config, f.deps)(f.request());
  eq(r.status, 503);
  eq(f.calls.includes("source"), false);
  eq(JSON.stringify(await r.json()).includes("invalid_grant"), false);
  eq((f.state.finish as Record<string, unknown>).error_code, "google_http_400");
});
Deno.test("deadline stops mutation and records incomplete run", async () => {
  const f = fixture(), store = f.deps.store;
  f.deps.store = async (op, p) => {
    const r = await store(op, p);
    if (op === "snapshot") f.advance(111000);
    return r;
  };
  const r = await createBackupHandler(config, f.deps)(f.request());
  eq(r.status, 503);
  eq(f.files.size, 0);
});
Deno.test("moved or newly public remote files fail their audit", async () => {
  for (const prop of ["movedFile", "publicFile"] as const) {
    const f = fixture(), h = createBackupHandler(config, f.deps);
    await h(f.request());
    f.state[prop] = true;
    const r = await h(f.request());
    eq(r.status, 503);
    eq((await r.json()).failed, 1);
    eq(f.files.size, 1);
  }
});
Deno.test("unknown roots fail closed; financial roots never traversed; oversize reported", async () => {
  const f = fixture();
  f.state.unknown = true;
  eq((await createBackupHandler(config, f.deps)(f.request())).status, 503);
  eq(f.files.size, 0);
  const g = fixture();
  g.state.financial = true;
  let b = await (await createBackupHandler(config, g.deps)(g.request())).json();
  eq(b.ok, true);
  eq(b.excluded, 1);
  const k = fixture();
  k.state.oversized = true;
  b = await (await createBackupHandler(config, k.deps)(k.request())).json();
  eq(b.ok, false);
  eq(b.oversized, 1);
  eq(k.files.size, 0);
});
