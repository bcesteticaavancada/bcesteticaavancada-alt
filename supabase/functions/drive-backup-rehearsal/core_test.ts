import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRehearsalHandler } from "./core.ts";

const RUN = "00000000-0000-4000-8000-000000000024";
const UID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT = "decolarbh@gmail.com";
const CLIENT = "530925228983-test.apps.googleusercontent.com";
const TRIGGER = "fake-test-trigger-with-at-least-thirty-two-characters";
const CLINICAL = "1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y";
const CLIENT_FOLDER = "1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N";
const now = Date.UTC(2026, 9, 24, 20);

function fixture(options: Record<string, unknown> = {}) {
  const files = new Map<string, any>();
  const calls: string[] = [];
  let uploads = 0;
  const config = { runId: RUN, userId: UID,
    invocationHash: createHash("sha256").update(TRIGGER).digest("hex"),
    issuedAt: now - 1000, expiresAt: now + 600000,
    clientId: CLIENT, clientSecret: "fake-client-secret-never-return-this",
    writes: "false", setupEnabled: true, ...options };
  const permissions = () => ({ permissions: options.publicFolder ?
    [{ type: "anyone", role: "reader" }] : [{ type: "user", role: "owner", emailAddress: ACCOUNT }] });
  const handler = createRehearsalHandler(config, {
    now: () => now,
    store: async (op: string, payload: Record<string, unknown>) => {
      calls.push("store:" + op); assert.equal(payload.user_id, UID); assert.equal(payload.client_id, CLIENT);
      if (op === "status") return { connected: true, folders_ready: options.notReady !== true };
      assert.equal(op, "read");
      return { user_id: UID, account: ACCOUNT, client_id: CLIENT, refresh_token: "fake-refresh-token-never-return-this" };
    },
    fetch: async (url: string, init: RequestInit = {}) => {
      calls.push(url);
      if (options.networkFailure) throw Error("upstream fake-refresh-token-never-return-this");
      const u = new URL(url);
      if (url === "https://oauth2.googleapis.com/token") {
        assert.equal(init.method, "POST");
        return Response.json({ access_token: "fake-access-token-never-return-this", token_type: "Bearer",
          expires_in: 3599, scope: "https://www.googleapis.com/auth/drive.file" });
      }
      assert.equal(u.origin, "https://www.googleapis.com");
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer fake-access-token-never-return-this");
      if (u.pathname.endsWith("/about")) return Response.json({ user: { emailAddress: options.wrongAccount ? "wrong@example.invalid" : ACCOUNT } });
      if (u.pathname === "/upload/drive/v3/files") {
        assert.equal(init.method, "POST"); assert.equal(u.searchParams.get("uploadType"), "multipart");
        const body = await new Response(init.body).text();
        const boundary = new Headers(init.headers).get("content-type")!.split("boundary=")[1];
        const parts = body.split("--" + boundary);
        const meta = JSON.parse(parts[1].split("\r\n\r\n")[1].trim());
        const pdf = parts[2].slice(parts[2].indexOf("\r\n\r\n") + 4, -2);
        assert(pdf.startsWith("%PDF-1.4")); assert(pdf.includes("TESTE DE FLUXO"));
        assert([CLINICAL, CLIENT_FOLDER].includes(meta.parents[0]));
        const id = "fixture-" + (++uploads);
        const file = { ...meta, id, size: String(new TextEncoder().encode(pdf).length), mimeType: "application/pdf",
          trashed: false, owners: [{ emailAddress: ACCOUNT }], pdf };
        files.set(id, file); return Response.json(file);
      }
      if (u.pathname === "/drive/v3/files") {
        const q = u.searchParams.get("q") || "";
        assert(q.includes("bcTestRunId") && q.includes(RUN) && q.includes(" in parents") && q.includes("bcContentSha256"));
        const values = [...files.values()].filter(f => q.includes(f.parents[0]) && q.includes(f.appProperties.bcContentSha256));
        return Response.json({ files: options.foreignRecord && values.length ?
          [{ ...values[0], appProperties: { ...values[0].appProperties, bcTestRunId: "foreign" } }] : values });
      }
      const id = u.pathname.split("/")[4];
      if (u.pathname.endsWith("/permissions")) return Response.json(permissions());
      if ([CLINICAL, CLIENT_FOLDER].includes(id)) return Response.json({ id, mimeType: "application/vnd.google-apps.folder",
        trashed: false, owners: [{ emailAddress: ACCOUNT }], capabilities: { canAddChildren: true } });
      const file = files.get(id); assert(file, "Only own fixture IDs may be read");
      if (u.searchParams.get("alt") === "media") return new Response(options.bom ? "\uFEFF" + file.pdf : options.corrupt ? file.pdf + "corrupted" : file.pdf);
      return Response.json(file);
    },
  });
  return { files, calls, get uploads() { return uploads; },
    request: (extra: Record<string, unknown> = {}) => handler(new Request("https://test.invalid/rehearsal", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + TRIGGER },
      body: '{"action":"run"}', ...extra,
    })) };
}

Deno.test("missing or wrong capability never reaches credentials or Google", async () => {
  const f = fixture();
  for (const headers of [{}, { Authorization: "Bearer wrong" }]) {
    assert.equal((await f.request({ headers })).status, 403);
  }
  assert.equal(f.calls.length, 0);
});
Deno.test("expired capabilities and production writes block the rehearsal", async () => {
  for (const options of [{ expiresAt: now - 1 }, { writes: "true" }, { setupEnabled: false }]) {
    const f = fixture(options); assert.notEqual((await f.request()).status, 200); assert.equal(f.calls.length, 0);
  }
});
Deno.test("browser origins and caller content cannot change the operation", async () => {
  const f = fixture();
  assert.equal((await f.request({ headers: { Origin: "https://untrusted.invalid", Authorization: "Bearer " + TRIGGER } })).status, 403);
  assert.equal((await f.request({ body: '{"action":"run","path":"real-client.pdf"}' })).status, 400);
  assert.equal(f.calls.length, 0);
});
Deno.test("wrong Google account and unvalidated connection cannot write", async () => {
  for (const options of [{ wrongAccount: true }, { notReady: true }]) {
    const f = fixture(options); assert.notEqual((await f.request()).status, 200); assert.equal(f.uploads, 0);
  }
});
Deno.test("public destination stops before every upload", async () => {
  const f = fixture({ publicFolder: true }); assert.notEqual((await f.request()).status, 200); assert.equal(f.uploads, 0);
});
Deno.test("copies only generated PDFs, reuses repeats and restores both versions", async () => {
  const f = fixture(); const r = await f.request(); assert.equal(r.status, 200);
  const report = await r.json(); assert.equal(report.created, 4); assert.equal(report.reused, 2);
  assert.equal(f.files.size, 4); assert.equal(report.destinations.length, 2);
  for (const item of report.destinations) {
    assert.equal(item.restored, true); assert.equal(item.previous_version_preserved, true);
    assert.notEqual(item.v1.id, item.v2.id); assert.notEqual(item.v1.sha256, item.v2.sha256);
    assert.equal(item.v1.sha256, item.v1.restored_sha256); assert.equal(item.v2.sha256, item.v2.restored_sha256);
  }
  const text = JSON.stringify(report);
  assert(!/fake-(?:access|refresh|client-secret)/.test(text));
});
Deno.test("a second complete run creates no duplicate fixture files", async () => {
  const f = fixture(); assert.equal((await f.request()).status, 200);
  const report = await (await f.request()).json(); assert.equal(report.created, 0); assert.equal(report.reused, 6);
  assert.equal(f.files.size, 4); assert.equal(f.uploads, 4);
});
Deno.test("corrupted restoration is a failure, never a successful backup", async () => {
  const f = fixture({ corrupt: true }); const r = await f.request(); assert.notEqual(r.status, 200);
  assert.equal((await r.json()).ok, false);
});
Deno.test("extra UTF-8 BOM bytes cannot be normalized into a successful restoration", async () => {
  const f = fixture({ bom: true }); const r = await f.request(); assert.notEqual(r.status, 200);
  assert.equal((await r.json()).ok, false);
});
Deno.test("a record for another run is never reused or downloaded", async () => {
  const f = fixture({ foreignRecord: true }); const r = await f.request(); assert.notEqual(r.status, 200);
  assert.equal(f.uploads, 1);
});
Deno.test("network failures never return raw upstream secrets", async () => {
  const f = fixture({ networkFailure: true }); const r = await f.request(); assert.notEqual(r.status, 200);
  assert(!/fake-|upstream/.test(await r.text()));
});
