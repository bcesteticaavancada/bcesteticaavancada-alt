import assert from "node:assert/strict";
import { createOAuthHandler, type Config, type Dependencies } from "./handler.ts";

const BASE = "https://tpqsmerlxquyrzrjbogj.supabase.co";
const ORIGIN = "https://bcesteticaavancada.github.io";
const EMAIL = "decolarbh@gmail.com";
const UID = "00000000-0000-4000-8000-000000000001";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLINICAL = "1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y";
const CLIENT = "1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N";
const config: Config = {
  enabled: true, writes: "false", baseUrl: BASE, appOrigin: ORIGIN,
  clientId: "530925228983-test.apps.googleusercontent.com",
  clientSecret: "fake-client-secret-for-local-tests-only-12345",
  pickerKey: "fake-public-picker-key",
};

function fixture() {
  let time = Date.UTC(2026, 9, 23, 18);
  let authenticated = true;
  let userEmail = EMAIL;
  let googleEmail = EMAIL;
  let scope = SCOPE;
  let tokenBody: Record<string, unknown> = {};
  let publicFolder = false;
  let error = false;
  let consumed = false;
  let stored: Record<string, unknown> | null = null;
  const calls: { url: string; init?: RequestInit }[] = [];
  const saved: { op: string; payload: Record<string, unknown> }[] = [];
  const deps: Dependencies = {
    now: () => time,
    authenticate: async (token) => authenticated && token === "fake-bc-session"
      ? { id: UID, email: userEmail, email_confirmed_at: "2026-10-01" } : null,
    store: async (op, payload) => {
      saved.push({ op, payload });
      if (op === "start") { consumed = false; return true; }
      if (op === "consume") { if (consumed) return false; consumed = true; return true; }
      if (op === "save") { stored = { ...payload, folders_ready: false }; return true; }
      if (op === "read") return stored;
      if (op === "status") return { connected: !!stored, folders_ready: false };
      if (op === "ready") return true;
      throw new Error("Unexpected store operation");
    },
    fetch: async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (error) throw new Error("Upstream contained fake-refresh-token and fake-client-secret");
      if (url === "https://oauth2.googleapis.com/token") return Response.json({
        access_token: "fake-access-token", refresh_token: "fake-refresh-token",
        token_type: "Bearer", expires_in: 3599, scope, ...tokenBody,
      });
      const parsed = new URL(url);
      if (parsed.pathname === "/drive/v3/about") return Response.json({ user: { emailAddress: googleEmail } });
      const folder = parsed.pathname.match(/^\/drive\/v3\/files\/([^/]+)(\/permissions)?$/);
      assert(folder && [CLINICAL, CLIENT].includes(folder[1]), "Only the two approved folders may be inspected");
      if (folder[2]) return Response.json({ permissions: publicFolder
        ? [{ type: "anyone", role: "reader" }]
        : [{ type: "user", role: "owner", emailAddress: EMAIL }] });
      return Response.json({ id: folder[1], mimeType: "application/vnd.google-apps.folder", trashed: false,
        owners: [{ emailAddress: EMAIL }], capabilities: { canAddChildren: true } });
    },
  };
  const handler = (kind: "start" | "callback" | "setup", overrides: Partial<Config> = {}) =>
    createOAuthHandler(kind, { ...config, ...overrides }, deps);
  async function start(overrides: Partial<Config> = {}) {
    return await handler("start", overrides)(new Request(BASE + "/functions/v1/drive-oauth-start", {
      method: "POST", headers: { Origin: ORIGIN }, body: new URLSearchParams({ session: "fake-bc-session" }),
    }));
  }
  async function begin() {
    const response = await start();
    assert.equal(response.status, 303);
    const state = new URL(response.headers.get("location")!).searchParams.get("state")!;
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    return { response, state, cookie };
  }
  async function callback(state: string, cookie: string, extra = "code=fake-auth-code") {
    return await handler("callback")(new Request(BASE + "/functions/v1/drive-oauth-callback?state=" + state + "&" + extra,
      { headers: { Cookie: cookie } }));
  }
  async function connect() { const b = await begin(); await callback(b.state, b.cookie); return b; }
  async function setup(body: unknown, origin = ORIGIN, bearer = "fake-bc-session") {
    return await handler("setup")(new Request(BASE + "/functions/v1/drive-oauth-setup", {
      method: "POST", headers: { Origin: origin, Authorization: "Bearer " + bearer, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
  }
  return { handler, start, begin, callback, connect, setup, calls, saved, getStored: () => stored,
    advance: (ms: number) => { time += ms; }, revoke: () => { authenticated = false; },
    wrongAppAccount: () => { userEmail = "outside@example.com"; }, wrongGoogleAccount: () => { googleEmail = "outside@example.com"; },
    broadScope: () => { scope += " https://www.googleapis.com/auth/drive"; },
    malformedToken: (body: Record<string, unknown>) => { tokenBody = body; },
    sharePublicly: () => { publicFolder = true; }, failNetwork: () => { error = true; },
  };
}

Deno.test("disabled setup and any write setting except false stop before Google or persistence", async () => {
  for (const overrides of [{ enabled: false }, { writes: "true" }, { writes: "" }]) {
    const f = fixture(); const r = await f.start(overrides);
    assert.equal(r.status, 503); assert.equal(f.calls.length, 0); assert.equal(f.saved.length, 0);
  }
});

Deno.test("start requires permitted BC identity and trusted form origin", async () => {
  const f = fixture(); f.wrongAppAccount();
  assert.equal((await f.start()).status, 403); assert.equal(f.saved.length, 0);
  const r = await f.handler("start")(new Request(BASE + "/functions/v1/drive-oauth-start", {
    method: "POST", headers: { Origin: "https://outside.example" }, body: new URLSearchParams({ session: "fake-bc-session" }),
  }));
  assert.equal(r.status, 403); assert.equal(f.calls.length, 0);
});

Deno.test("start requests offline drive.file with PKCE and encrypted ten-minute HttpOnly cookie", async () => {
  const f = fixture(); const { response, state } = await f.begin();
  const url = new URL(response.headers.get("location")!);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), SCOPE);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("include_granted_scopes"), "false");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.match(url.searchParams.get("code_challenge")!, /^[\w-]{43}$/);
  assert.match(state, /^[\w-]{43}$/);
  const cookie = response.headers.get("set-cookie")!;
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Max-Age=600"]) assert(cookie.includes(flag));
  assert(!cookie.includes("fake-bc-session")); assert(!cookie.includes(state));
  assert(!url.href.includes(config.clientSecret));
  assert.equal(response.headers.get("cache-control"), "no-store");
});

Deno.test("valid callback checks same session/account and persists refresh only server-side", async () => {
  const f = fixture(); const { state, cookie } = await f.begin();
  const r = await f.callback(state, cookie);
  assert.equal(r.status, 303); assert.equal(new URL(r.headers.get("location")!).search, "?status=authorized");
  assert.equal(f.getStored()?.refresh_token, "fake-refresh-token");
  assert.equal(f.getStored()?.account, EMAIL);
  assert.equal(f.getStored()?.access_token, undefined);
  const grant = new URLSearchParams(String(f.calls[0].init?.body));
  assert.equal(grant.get("redirect_uri"), BASE + "/functions/v1/drive-oauth-callback");
  assert.equal(grant.get("client_secret"), config.clientSecret);
  assert.equal(grant.get("grant_type"), "authorization_code");
  assert.match(grant.get("code_verifier")!, /^[\w-]{43}$/);
  assert(!r.headers.get("location")!.includes("fake-"));
  assert(r.headers.get("set-cookie")!.includes("Max-Age=0"));
});

Deno.test("all callback outcomes return to BC Gestão inside its published repository path", async () => {
  const target = "https://bcesteticaavancada.github.io/bcesteticaavancada-alt/gestao/configurar-drive/";
  for (const status of ["authorized", "cancelled", "failed"]) {
    const f = fixture(); const b = await f.begin();
    const r = await f.callback(b.state, status === "failed" ? "" : b.cookie,
      status === "cancelled" ? "error=access_denied" : "code=fake-auth-code");
    assert.equal(r.status, 303);
    assert.equal(r.headers.get("location"), target + "?status=" + status);
  }
});

Deno.test("missing, altered, expired, mismatching or repeated browser state cannot save a token", async () => {
  for (const mode of ["missing", "tampered", "expired", "mismatch", "repeated", "duplicate"]) {
    const f = fixture(); const b = await f.begin();
    if (mode === "expired") f.advance(600_001);
    if (mode === "repeated") await f.callback(b.state, b.cookie);
    const previous = f.saved.filter(x => x.op === "save").length;
    const r = await f.callback(mode === "mismatch" ? "x".repeat(43) : b.state,
      mode === "missing" ? "" : mode === "tampered" ? b.cookie.slice(0, -5) + "abcde" : b.cookie,
      mode === "duplicate" ? "code=one&code=two" : "code=fake-auth-code");
    assert.equal(new URL(r.headers.get("location")!).search, "?status=failed", mode);
    assert.equal(f.saved.filter(x => x.op === "save").length, previous, mode);
  }
});

Deno.test("revoked BC session, wrong Google account and expanded scope do not establish connection", async () => {
  for (const mode of ["revoked", "account", "scope"]) {
    const f = fixture(); const b = await f.begin();
    if (mode === "revoked") f.revoke();
    if (mode === "account") f.wrongGoogleAccount();
    if (mode === "scope") f.broadScope();
    const r = await f.callback(b.state, b.cookie);
    assert.equal(new URL(r.headers.get("location")!).search, "?status=failed"); assert.equal(f.getStored(), null);
  }
});

Deno.test("denied consent and malformed token are safe failures", async () => {
  const f = fixture(); const b = await f.begin();
  const r = await f.callback(b.state, b.cookie, "error=access_denied&error_description=fake-refresh-token");
  assert.equal(new URL(r.headers.get("location")!).search, "?status=cancelled"); assert.equal(f.calls.length, 0);
  for (const body of [{ refresh_token: "" }, { token_type: "Basic" }, { expires_in: 0 }, { access_token: 123 }]) {
    const g = fixture(); const begin = await g.begin(); g.malformedToken(body);
    await g.callback(begin.state, begin.cookie); assert.equal(g.getStored(), null);
  }
});

Deno.test("network failure never reflects upstream secrets or raw error messages", async () => {
  const f = fixture(); const b = await f.begin(); f.failNetwork();
  const r = await f.callback(b.state, b.cookie);
  assert.equal(new URL(r.headers.get("location")!).search, "?status=failed");
  assert(!JSON.stringify([...r.headers]).includes("fake-refresh-token"));
  assert.equal(await r.text(), ""); assert.equal(f.getStored(), null);
});

Deno.test("setup rejects cross-origin and unauthorized requests without leaking access tokens", async () => {
  const f = fixture(); await f.connect();
  assert.equal((await f.setup({ action: "picker" }, "https://outside.example")).status, 403);
  assert.equal((await f.setup({ action: "picker" }, ORIGIN, "wrong-session")).status, 403);
  const r = await f.setup({ action: "status" });
  assert.deepEqual(await r.json(), { connected: true, folders_ready: false });
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
});

Deno.test("Picker receives only temporary access token and public key with no refresh or client secret", async () => {
  const f = fixture(); await f.connect();
  const r = await f.setup({ action: "picker" }); const body = await r.json();
  assert.equal(body.access_token, "fake-access-token"); assert.equal(body.expires_in, 3599);
  assert.equal(body.developer_key, config.pickerKey); assert.equal(body.app_id, "530925228983");
  assert.equal(body.refresh_token, undefined); assert.equal(body.client_secret, undefined);
  assert.equal(r.headers.get("cache-control"), "no-store");
});

Deno.test("confirmation accepts only explicit exact folder pair and server-verified private metadata", async () => {
  const f = fixture(); await f.connect();
  const calls = f.calls.length;
  assert.equal((await f.setup({ action: "confirm", clinical: "outside-folder", client: CLIENT })).status, 400);
  assert.equal(f.calls.length, calls);
  const r = await f.setup({ action: "confirm", clinical: CLINICAL, client: CLIENT });
  assert.deepEqual(await r.json(), { connected: true, folders_ready: true });
  assert.equal(f.saved.filter(x => x.op === "ready").length, 1);
  assert(!f.calls.some(x => /storage|upload|prontuario/.test(x.url)));
});

Deno.test("public sharing blocks confirmation even after successful Google authorization", async () => {
  const f = fixture(); await f.connect(); f.sharePublicly();
  const r = await f.setup({ action: "confirm", clinical: CLINICAL, client: CLIENT });
  assert.equal(r.status, 400); assert.equal(f.saved.filter(x => x.op === "ready").length, 0);
});
