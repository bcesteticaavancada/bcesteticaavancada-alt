// Regression tests for the staged new-domain OAuth flow.
// No HTTP requests to Google/Supabase, no real tokens, credentials or folders.
import { createOAuthHandler, type Config, type Dependencies } from "../../supabase/functions/_shared/drive-oauth/handler.ts";
import { ACCOUNT, DRIVE_SCOPE, SESSION_TTL, random, seal } from "../../supabase/functions/_shared/drive-oauth/protocol.ts";

const LEGACY = "https://bcesteticaavancada.github.io";
const CANONICAL = "https://www.bcesteticaavancada.com.br";
const APEX = "https://bcesteticaavancada.com.br";
const MALICIOUS = "https://unrelated.example";
const BASE = "https://tpqsmerlxquyrzrjbogj.supabase.co";
const SECRET = "test-secret-never-used-in-production-0123456789";
const START = BASE + "/functions/v1/drive-oauth-start";
const SETUP = BASE + "/functions/v1/drive-oauth-setup";
const CALLBACK = BASE + "/functions/v1/drive-oauth-callback";

function equal<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function truthy(actual: unknown, label = "Expected truthy value"): asserts actual {
  if (!actual) throw new Error(label);
}
function context() {
  const now = Date.now();
  const userId = "fictional-admin-id";
  const config: Config = {
    enabled: true, writes: "false", baseUrl: BASE,
    appOrigin: LEGACY, allowedOrigins: [CANONICAL, APEX],
    clientId: "fictional-client-id", clientSecret: SECRET, pickerKey: "fictional-picker-key",
  };
  const calls: string[] = [];
  const deps: Dependencies = {
    now: () => now,
    authenticate: async (_session) => ({
      id: userId, email: ACCOUNT, email_confirmed_at: "2026-01-01T00:00:00Z",
    }),
    store: async (action) => { calls.push(action); return true; },
    fetch: async (url) => {
      calls.push("google:" + (url.includes("oauth2") ? "token" : "drive-about"));
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "fictional-access", refresh_token: "fictional-refresh",
          token_type: "Bearer", expires_in: 3600, scope: DRIVE_SCOPE });
      }
      if (url.includes("drive/v3/about")) return Response.json({ user: { emailAddress: ACCOUNT } });
      throw new Error("Unexpected external request");
    },
  };
  return { config, deps, now, calls };
}
function startRequest(origin: string) {
  return new Request(START, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin },
    body: "session=fictional-session-token",
  });
}
function callbackRequest(state: string, cookie: string) {
  return new Request(CALLBACK + "?state=" + encodeURIComponent(state) + "&code=fictional-code",
    { headers: { Cookie: cookie } });
}

for (const origin of [LEGACY, CANONICAL, APEX]) {
  Deno.test("OAuth start and signed callback return to exact originating host: " + origin, async () => {
    const { config, deps, calls } = context();
    const starter = createOAuthHandler("start", config, deps);
    const startResponse = await starter(startRequest(origin));
    equal(startResponse.status, 303);
    const loc = startResponse.headers.get("location");
    truthy(loc);
    const google = new URL(loc);
    equal(google.hostname, "accounts.google.com");
    equal(google.searchParams.get("redirect_uri"), CALLBACK);
    equal(google.searchParams.get("scope"), DRIVE_SCOPE);
    truthy(google.searchParams.get("code_challenge"));
    const state = google.searchParams.get("state");
    truthy(state);
    const rawCookie = startResponse.headers.get("set-cookie");
    truthy(rawCookie);
    const sessionCookie = rawCookie.split(";")[0];
    const callback = createOAuthHandler("callback", config, deps);
    const authorized = await callback(callbackRequest(state, sessionCookie));
    equal(authorized.status, 303);
    const path = origin === LEGACY ? "/bcesteticaavancada-alt/gestao/configurar-drive/" : "/gestao/configurar-drive/";
    equal(authorized.headers.get("location"), origin + path + "?status=authorized");
    truthy(calls.includes("consume"));
    truthy(calls.includes("save"));
  });
}

Deno.test("CORS preflight uses only exact approved origin, never wildcard", async () => {
  const { config, deps } = context();
  const setup = createOAuthHandler("setup", config, deps);
  for (const origin of [LEGACY, CANONICAL, APEX]) {
    const result = await setup(new Request(SETUP, {
      method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
    }));
    equal(result.status, 204);
    equal(result.headers.get("Access-Control-Allow-Origin"), origin);
    equal(result.headers.get("Vary"), "Origin");
    truthy(!result.headers.get("Access-Control-Allow-Origin")?.includes("*"));
  }
  const bad = await setup(new Request(SETUP, { method: "OPTIONS", headers: { Origin: MALICIOUS } }));
  equal(bad.status, 403);
  equal(bad.headers.get("Access-Control-Allow-Origin"), null);
});

Deno.test("Cross-origin OAuth start denied before any Google or store access", async () => {
  const { config, deps, calls } = context();
  const response = await createOAuthHandler("start", config, deps)(startRequest(MALICIOUS));
  equal(response.status, 403);
  equal(response.headers.get("location"), null);
  equal(calls.length, 0);
});

Deno.test("Legacy in-progress session cookie without origin returns to old app", async () => {
  const { config, deps, now } = context();
  const state = random(), verifier = random();
  const signed = await seal({ state, verifier, uid: "fictional-admin-id",
    session: "fictional-session-token", issued: now, expires: now + SESSION_TTL }, SECRET);
  const callback = createOAuthHandler("callback", config, deps);
  const response = await callback(callbackRequest(state, "__Secure-bc-drive-oauth=" + signed));
  equal(response.status, 303);
  equal(response.headers.get("location"),
    LEGACY + "/bcesteticaavancada-alt/gestao/configurar-drive/?status=authorized");
});

Deno.test("Malformed callback cookie cannot redirect to an attacker-selected host", async () => {
  const { config, deps } = context();
  const callback = createOAuthHandler("callback", config, deps);
  const result = await callback(new Request(
    CALLBACK + "?state=fictional-state&code=fictional-code&redirect_uri=" + encodeURIComponent(MALICIOUS),
    { headers: { Cookie: "__Secure-bc-drive-oauth=tampered" } }));
  equal(result.status, 303);
  equal(result.headers.get("location"),
    LEGACY + "/bcesteticaavancada-alt/gestao/configurar-drive/?status=failed");
});
