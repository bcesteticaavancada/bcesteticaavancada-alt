import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createOAuthHandler, type Config, type Dependencies } from "../../supabase/functions/_shared/drive-oauth/handler.ts";
import { ACCOUNT, DRIVE_SCOPE, FOLDERS } from "../../supabase/functions/_shared/drive-oauth/protocol.ts";

const BASE = "https://qa-backend.invalid";
const LEGACY = "https://bcesteticaavancada.github.io";
const ORIGINS = [LEGACY, "https://www.bcesteticaavancada.com.br", "https://bcesteticaavancada.com.br"];
const ROOT = "qa-central-private";
const UID = "qa-admin";
const OLD_REFRESH = "fictional-original-refresh-token";
const CATALOG = {
  maya: "03_Site_Maya_e_Midias", manifests: "04_Manifestos_e_Relatorios_de_Backup",
  database: "05_BC_Gestao_Banco_de_Dados_e_Exportacoes", code: "06_Site_Codigo_Versoes_e_Publicacoes",
  audit: "07_Configuracoes_Auditoria_e_Restauracao", finance: "08_Financeiro_e_Contabilidade",
  administration: "09_Administracao_Contratos_e_Equipe",
};
function fixture(overrides: Partial<Config> & { activeReconnect?: boolean } = {}) {
  const config = { enabled: true, writes: "true", activeReconnect: true, baseUrl: BASE,
    appOrigin: LEGACY, allowedOrigins: ORIGINS.slice(1), clientId: "qa-client-id",
    clientSecret: "fictional-secret-for-offline-tests-only", pickerKey: "qa-key", ...overrides };
  let ready = true, stored = OLD_REFRESH, latestState = "", wrongAccount = false;
  const ops: { op: string; payload: Record<string, unknown> }[] = [];
  const requests: { url: string; method: string }[] = [];
  const metadata = new Map<string, Record<string, unknown>>();
  const acl = new Map<string, Record<string, unknown>>();
  function folder(id: string, name: string, parents: string[]) {
    metadata.set(id, { id, name, parents, mimeType: "application/vnd.google-apps.folder", trashed: false,
      owners: [{ emailAddress: ACCOUNT }], capabilities: { canAddChildren: true } });
    acl.set(id, { permissions: [{ type: "user", role: "owner", emailAddress: ACCOUNT }] });
  }
  folder(ROOT, "BC Central QA", ["qa-my-drive"]);
  folder(FOLDERS.clinical, "01_Anamneses_e_Documentos_Clinicos", [ROOT]);
  folder(FOLDERS.client, "02_Arquivos_de_Clientes", [ROOT]);
  for (const [role, name] of Object.entries(CATALOG)) folder("qa-folder-" + role, name, [ROOT]);
  const deps: Dependencies = {
    now: () => 1793270000000,
    authenticate: async token => token === "qa-session" ? { id: UID, email: ACCOUNT, email_confirmed_at: "2026-01-01" } : null,
    store: async (operation, payload) => {
      const op = String(operation); ops.push({ op, payload });
      if (op === "status") return { connected: true, folders_ready: ready };
      if (op === "read") return { account: ACCOUNT, user_id: UID, client_id: config.clientId, refresh_token: stored };
      if (op === "start") { latestState = String(payload.state_hash); return true; }
      if (op === "consume") { const valid = latestState === payload.state_hash; latestState = ""; return valid; }
      if (op === "rotate") {
        if (payload.expected_refresh_hash !== createHash("sha256").update(stored).digest("hex")) return false;
        stored = String(payload.refresh_token); return true;
      }
      if (op === "save") { stored = String(payload.refresh_token); ready = false; return true; }
      if (op === "ready") { ready = true; return true; }
      throw new Error("Unexpected store operation");
    },
    fetch: async (url, init) => {
      const method = init?.method || "GET"; requests.push({ url, method });
      if (url === "https://oauth2.googleapis.com/token") return Response.json({
        access_token: "qa-access", refresh_token: "fictional-candidate-refresh-token", token_type: "Bearer", expires_in: 3600, scope: DRIVE_SCOPE });
      assert.equal(method, "GET", "Folder inspection must never create, move or share Drive files");
      const u = new URL(url);
      if (u.pathname === "/drive/v3/about") return Response.json({ user: { emailAddress: wrongAccount ? "outside@example.invalid" : ACCOUNT } });
      const match = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)(\/permissions)?$/);
      assert.ok(match, "Unexpected Google endpoint");
      const value = match[2] ? acl.get(match[1]) : metadata.get(match[1]);
      return value ? Response.json(value) : Response.json({ error: "not found" }, { status: 404 });
    },
  };
  const handler = (kind: "start" | "callback" | "setup", extra: Partial<Config> = {}) => createOAuthHandler(kind, { ...config, ...extra }, deps);
  async function setup(body: unknown, origin = ORIGINS[1]) {
    return await handler("setup")(new Request(BASE + "/functions/v1/drive-oauth-setup", { method: "POST",
      headers: { Origin: origin, Authorization: "Bearer qa-session", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  }
  async function begin(origin = ORIGINS[1]) {
    const response = await handler("start")(new Request(BASE + "/functions/v1/drive-oauth-start", { method: "POST",
      headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: "session=qa-session" }));
    return { response, state: response.headers.has("location") ? new URL(response.headers.get("location")!).searchParams.get("state") : null,
      cookie: response.headers.get("set-cookie")?.split(";")[0] || "" };
  }
  async function callback(b: Awaited<ReturnType<typeof begin>>, extra: Partial<Config> = {}) {
    return await handler("callback", extra)(new Request(BASE + "/functions/v1/drive-oauth-callback?code=qa-code&state=" + b.state,
      { headers: { Cookie: b.cookie } }));
  }
  return { config, deps, handler, setup, begin, callback, ops, requests, metadata, acl,
    getReady: () => ready, getRefresh: () => stored, unready: () => { ready = false; },
    wrongAccount: () => { wrongAccount = true; }, changeConnection: () => { stored = "fictional-newer-refresh-token"; } };
}

for (const origin of ORIGINS) {
  Deno.test("active backup keeps authenticated status and Picker available: " + origin, async () => {
    const f = fixture({ activeReconnect: false });
    const status = await f.setup({ action: "status" }, origin);
    assert.equal(status.status, 200);
    const body = await status.json(); assert.equal(body.connected, true); assert.equal(body.authorization_available, false);
    const picker = await f.setup({ action: "picker" }, origin); assert.equal(picker.status, 200);
    assert.equal((await picker.json()).access_token, "qa-access");
    assert.ok(!f.ops.some(x => ["save", "ready", "rotate"].includes(x.op)));
    assert.equal(f.getReady(), true); assert.equal(f.getRefresh(), OLD_REFRESH);
  });
  Deno.test("callback failure retains authenticated originating installation: " + origin, async () => {
    const f = fixture({ writes: "false" }); const b = await f.begin(origin); f.wrongAccount();
    const result = await f.callback(b);
    const path = origin === LEGACY ? "/bcesteticaavancada-alt/gestao/configurar-drive/" : "/gestao/configurar-drive/";
    assert.equal(result.headers.get("location"), origin + path + "?status=failed");
    assert.equal(f.getRefresh(), OLD_REFRESH);
  });
}
Deno.test("active reconnection is opt-in, rejects an unready connection and never falls back to destructive save", async () => {
  const off = fixture({ activeReconnect: false }); assert.equal((await off.begin()).response.status, 503);
  const unready = fixture(); unready.unready(); assert.equal((await unready.begin()).response.status, 409);
  assert.equal(unready.requests.length, 0);
});
Deno.test("active reconnection validates folders and atomically rotates without resetting readiness", async () => {
  const f = fixture(); const b = await f.begin(); assert.equal(b.response.status, 303);
  const result = await f.callback(b); assert.match(result.headers.get("location")!, /status=authorized$/);
  assert.equal(f.getReady(), true); assert.equal(f.getRefresh(), "fictional-candidate-refresh-token");
  const rotation = f.ops.find(x => x.op === "rotate"); assert.ok(rotation);
  assert.equal(rotation.payload.expected_refresh_hash, createHash("sha256").update(OLD_REFRESH).digest("hex"));
  assert.ok(!f.ops.some(x => ["save", "ready"].includes(x.op)));
  assert.match((await f.callback(b)).headers.get("location")!, /status=failed$/);
});
Deno.test("failed privacy or a newer connection leaves active credentials and readiness untouched", async () => {
  for (const mode of ["privacy", "newer"]) {
    const f = fixture(); const b = await f.begin();
    if (mode === "privacy") f.acl.set(FOLDERS.clinical, { permissions: [{ type: "anyone", role: "writer" }] });
    else f.changeConnection();
    const previous = f.getRefresh(); const result = await f.callback(b);
    assert.match(result.headers.get("location")!, /status=failed$/);
    assert.equal(f.getRefresh(), previous); assert.equal(f.getReady(), true);
  }
});
Deno.test("inactive handshake cannot overwrite a backup enabled while Google was open", async () => {
  const f = fixture({ writes: "false" }); const b = await f.begin();
  const result = await f.callback(b, { writes: "true" });
  assert.match(result.headers.get("location")!, /status=failed$/);
  assert.equal(f.getRefresh(), OLD_REFRESH); assert.ok(!f.ops.some(x => x.op === "save"));
});
Deno.test("tampered cookie and arbitrary return parameter keep a safe legacy failure destination", async () => {
  const f = fixture();
  const res = await f.handler("callback")(new Request(BASE + "/functions/v1/drive-oauth-callback?code=x&state=x&return_to=https://attacker.invalid", { headers: { Cookie: "__Secure-bc-drive-oauth=broken" } }));
  assert.equal(res.headers.get("location"), LEGACY + "/bcesteticaavancada-alt/gestao/configurar-drive/?status=failed");
});
Deno.test("central catalogue derives its only root from both unchanged legacy destination IDs", async () => {
  const f = fixture(); const result = await f.setup({ action: "central" }); assert.equal(result.status, 200);
  const body = await result.json(); assert.equal(body.root_id, ROOT); assert.equal(body.destinations.database.name, CATALOG.database);
  assert.ok(!f.ops.some(x => ["save", "ready", "rotate"].includes(x.op)));
});
for (const [role, name] of Object.entries(CATALOG)) Deno.test("central folder selected by Picker can be verified without enabling backups: " + role, async () => {
  const f = fixture(); const result = await f.setup({ action: "inspect", role, folder: "qa-folder-" + role });
  assert.equal(result.status, 200); const body = await result.json();
  assert.equal(body.verified, true); assert.equal(body.name, name); assert.equal(body.backup_enabled, false);
  assert.equal(f.getReady(), true); assert.ok(!f.ops.some(x => ["save", "ready", "rotate"].includes(x.op)));
});
Deno.test("central validation rejects an external parent, public root, public child, wrong name and foreign owner", async () => {
  for (const mode of ["parent", "root", "child", "name", "owner", "anchors"]) {
    const f = fixture(); const meta = f.metadata.get("qa-folder-database")!;
    if (mode === "parent") meta.parents = ["qa-external-root"];
    if (mode === "root") f.acl.set(ROOT, { permissions: [{ type: "anyone", role: "writer" }] });
    if (mode === "child") f.acl.set("qa-folder-database", { permissions: [{ type: "anyone", role: "reader" }] });
    if (mode === "name") meta.name = "BC Estética";
    if (mode === "owner") meta.owners = [{ emailAddress: "external@example.invalid" }];
    if (mode === "anchors") f.metadata.get(FOLDERS.client)!.parents = ["qa-another-root"];
    const response = await f.setup({ action: "inspect", role: "database", folder: "qa-folder-database" });
    assert.equal(response.status, 400, mode); assert.ok(!f.ops.some(x => ["save", "ready", "rotate"].includes(x.op)), mode);
  }
});
Deno.test("unknown roles and URL-shaped folder IDs are denied before requesting Google", async () => {
  for (const body of [{ action: "inspect", role: "external", folder: "qa-folder-database" }, { action: "inspect", role: "database", folder: "https://attacker.invalid/a" }]) {
    const f = fixture(); assert.equal((await f.setup(body)).status, 400); assert.equal(f.requests.length, 0);
  }
});
