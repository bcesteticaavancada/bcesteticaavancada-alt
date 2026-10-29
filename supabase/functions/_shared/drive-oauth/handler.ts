import { ACCOUNT, COOKIE_PATH, DRIVE_SCOPE, FOLDERS, SESSION_TTL, SetupError, base64url,
  checkFolder, checkToken, cookie, digest, hash, json, limitedText, object, open, random,
  readCookie, seal, text } from "./protocol.ts";

export type Config = {
  enabled: boolean; writes: string; baseUrl: string; appOrigin: string;
  /** Exact additional site origins for the controlled domain migration. */
  allowedOrigins?: readonly string[];
  clientId: string; clientSecret: string; pickerKey: string;
};
type User = { id: string; email?: string; email_confirmed_at?: string };
type Operation = "start" | "consume" | "save" | "read" | "status" | "ready";
export type Dependencies = {
  now: () => number;
  authenticate: (token: string) => Promise<User | null>;
  store: (op: Operation, payload: Record<string, unknown>) => Promise<unknown>;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
};
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3/";

export function createOAuthHandler(kind: "start" | "callback" | "setup", config: Config, deps: Dependencies) {
  const allowedOrigins = new Set([config.appOrigin, ...(config.allowedOrigins ?? [])]);
  // No URL from query parameters, post bodies or untrusted callbacks is used as a destination.
  // Legacy handshake cookies (without appOrigin) keep returning to the old installation.
  function returnUrlFor(origin?: string) {
    const trusted = origin && allowedOrigins.has(origin) ? origin : config.appOrigin;
    return trusted === config.appOrigin
      ? trusted + "/bcesteticaavancada-alt/gestao/configurar-drive/"
      : trusted + "/gestao/configurar-drive/";
  }
  const redirectUri = config.baseUrl + COOKIE_PATH;
  function headers(req: Request): Headers {
    const h = new Headers({ "Cache-Control": "no-store", Pragma: "no-cache",
      "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
    const origin = req.headers.get("origin");
    if (origin && allowedOrigins.has(origin)) {
      h.set("Access-Control-Allow-Origin", origin); h.set("Vary", "Origin");
    }
    return h;
  }
  function reply(req: Request, body: unknown, status = 200): Response {
    const h = headers(req); h.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(body), { status, headers: h });
  }
  function redirect(req: Request, location: string, sessionCookie?: string): Response {
    const h = headers(req); h.set("Location", location);
    if (sessionCookie) h.set("Set-Cookie", sessionCookie);
    return new Response(null, { status: 303, headers: h });
  }
  async function user(token: string): Promise<User> {
    const value = await deps.authenticate(token);
    if (!value || !value.id || !value.email_confirmed_at || value.email?.toLowerCase() !== ACCOUNT) {
      throw new SetupError("access_denied", 403);
    }
    return value;
  }
  async function google(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    const response = await deps.fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new SetupError("google_unavailable");
    return await json(response);
  }
  async function grant(params: Record<string, string>, requireRefresh: boolean) {
    return checkToken(await google(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }) }), requireRefresh);
  }
  async function connection(uid: string) {
    const record = object(await deps.store("read", { user_id: uid, client_id: config.clientId }));
    if (record.account !== ACCOUNT || record.user_id !== uid || record.client_id !== config.clientId) throw new SetupError("not_connected");
    return record;
  }
  async function access(uid: string) {
    const record = await connection(uid);
    return await grant({ grant_type: "refresh_token", refresh_token: text(record.refresh_token) }, false);
  }
  async function start(req: Request) {
    const appOrigin = req.headers.get("origin");
    if (!appOrigin || !allowedOrigins.has(appOrigin)) throw new SetupError("access_denied", 403);
    if (!req.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) throw new SetupError("invalid_request");
    const params = new URLSearchParams(await limitedText(req));
    if ([...params.keys()].length !== 1 || params.getAll("session").length !== 1) throw new SetupError();
    const session = text(params.get("session"), 3000);
    const identity = await user(session);
    const state = random(); const verifier = random(); const issued = deps.now();
    const sealed = await seal({ state, verifier, uid: identity.id, session, issued, expires: issued + SESSION_TTL,
      appOrigin }, config.clientSecret);
    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.search = new URLSearchParams({ response_type: "code", client_id: config.clientId,
      redirect_uri: redirectUri, scope: DRIVE_SCOPE, access_type: "offline", prompt: "consent select_account",
      include_granted_scopes: "false", login_hint: ACCOUNT, state,
      code_challenge: base64url(await digest(verifier)), code_challenge_method: "S256" }).toString();
    if (await deps.store("start", { user_id: identity.id, state_hash: await hash(state) }) !== true) throw new SetupError();
    return redirect(req, authorization.href, cookie(sealed));
  }
  async function callback(req: Request) {
    const params = new URL(req.url).searchParams;
    const handshake = await open(readCookie(req.headers.get("cookie") || ""), config.clientSecret, deps.now());
    if (handshake.appOrigin && !allowedOrigins.has(handshake.appOrigin)) throw new SetupError("access_denied", 403);
    const returnUrl = returnUrlFor(handshake.appOrigin);
    if (params.getAll("state").length !== 1 || params.get("state") !== handshake.state ||
      params.getAll("code").length > 1 || params.getAll("error").length > 1 ||
      (params.has("code") && params.has("error"))) throw new SetupError();
    const identity = await user(handshake.session);
    if (identity.id !== handshake.uid || await deps.store("consume", {
      user_id: identity.id, state_hash: await hash(handshake.state),
    }) !== true) throw new SetupError();
    if (params.has("error")) return redirect(req, returnUrl + "?status=cancelled", cookie("", true));
    const token = await grant({ grant_type: "authorization_code", code: text(params.get("code"), 2048),
      redirect_uri: redirectUri, code_verifier: handshake.verifier }, true);
    const about = await google(DRIVE + "about?fields=user(emailAddress)", { headers: { Authorization: "Bearer " + token.access } });
    if (object(about.user).emailAddress !== ACCOUNT) throw new SetupError("wrong_account");
    if (await deps.store("save", { user_id: identity.id, account: ACCOUNT, client_id: config.clientId,
      refresh_token: token.refresh }) !== true) throw new SetupError();
    return redirect(req, returnUrl + "?status=authorized", cookie("", true));
  }
  async function setup(req: Request) {
    const origin = req.headers.get("origin");
    if (!origin || !allowedOrigins.has(origin)) throw new SetupError("access_denied", 403);
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) throw new SetupError("access_denied", 403);
    const identity = await user(text(auth.slice(7), 3000));
    if (!req.headers.get("content-type")?.startsWith("application/json")) throw new SetupError();
    const body = await json(req, 8192);
    if (body.action === "status") {
      const status = object(await deps.store("status", { user_id: identity.id, client_id: config.clientId }));
      return reply(req, { connected: status.connected === true, folders_ready: status.folders_ready === true });
    }
    if (body.action === "picker") {
      if (!config.pickerKey) throw new SetupError("picker_not_configured");
      const token = await access(identity.id);
      return reply(req, { access_token: token.access, expires_in: token.expires, developer_key: config.pickerKey,
        app_id: config.clientId.split("-")[0], folders: FOLDERS });
    }
    if (body.action !== "confirm" || body.clinical !== FOLDERS.clinical || body.client !== FOLDERS.client ||
      Object.keys(body).length !== 3) throw new SetupError("invalid_folders");
    const token = await access(identity.id);
    const authHeaders = { Authorization: "Bearer " + token.access };
    for (const id of [FOLDERS.clinical, FOLDERS.client]) {
      const meta = await google(DRIVE + "files/" + id + "?fields=id,mimeType,trashed,driveId,owners(emailAddress),capabilities(canAddChildren)", { headers: authHeaders });
      const permissions = await google(DRIVE + "files/" + id + "/permissions?fields=nextPageToken,permissions(type,role,emailAddress,deleted,pendingOwner)&pageSize=100", { headers: authHeaders });
      checkFolder(meta, permissions, id);
    }
    if (await deps.store("ready", { user_id: identity.id, client_id: config.clientId,
      clinical: FOLDERS.clinical, client: FOLDERS.client }) !== true) throw new SetupError();
    return reply(req, { connected: true, folders_ready: true });
  }
  return async (req: Request): Promise<Response> => {
    try {
      if (!config.enabled || config.writes !== "false") return reply(req, { error: "setup_disabled" }, 503);
      if (kind === "setup" && req.method === "OPTIONS") {
        const origin = req.headers.get("origin");
        if (!origin || !allowedOrigins.has(origin)) throw new SetupError("access_denied", 403);
        const h = headers(req); h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        h.set("Access-Control-Allow-Headers", "authorization, content-type");
        return new Response(null, { status: 204, headers: h });
      }
      if (req.method !== (kind === "callback" ? "GET" : "POST")) return reply(req, { error: "method_not_allowed" }, 405);
      if (kind === "start") return await start(req);
      if (kind === "callback") return await callback(req);
      return await setup(req);
    } catch (error) {
      if (kind === "callback") return redirect(req, returnUrlFor() + "?status=failed", cookie("", true));
      return reply(req, { error: error instanceof SetupError ? error.code : "setup_failed" }, error instanceof SetupError ? error.status : 400);
    }
  };
}
