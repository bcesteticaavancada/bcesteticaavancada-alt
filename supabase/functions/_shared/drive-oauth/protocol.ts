// Server-only OAuth primitives. No credentials are logged or persisted here.
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const ACCOUNT = "decolarbh@gmail.com";
export const FOLDERS = Object.freeze({
  clinical: "1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y",
  client: "1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N",
});
export const SESSION_TTL = 600_000;
export const COOKIE_NAME = "__Secure-bc-drive-oauth";
export const COOKIE_PATH = "/functions/v1/drive-oauth-callback";
const encoder = new TextEncoder();

export class SetupError extends Error {
  constructor(public code = "setup_failed", public status = 400) { super(code); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SetupError();
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 4096): string {
  if (typeof value !== "string" || !value || value.length > max) throw new SetupError();
  return value;
}
export function random(): string { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unbase64url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[\w-]+$/.test(value) || value.length > 8000) throw new SetupError();
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
export async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}
export async function hash(value: string): Promise<string> {
  return Array.from(await digest(value), b => b.toString(16).padStart(2, "0")).join("");
}
async function cookieKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256",
    salt: encoder.encode("BC-drive-oauth-cookie-v1"), info: encoder.encode(COOKIE_NAME) },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export type Handshake = { state: string; verifier: string; uid: string; session: string; issued: number; expires: number };
export async function seal(payload: Handshake, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv,
    additionalData: encoder.encode(COOKIE_PATH) }, await cookieKey(secret), encoder.encode(JSON.stringify(payload)));
  return base64url(iv) + "." + base64url(new Uint8Array(encrypted));
}
export async function open(value: string, secret: string, now: number): Promise<Handshake> {
  const parts = value.split(".");
  if (parts.length !== 2) throw new SetupError();
  const iv = unbase64url(parts[0]);
  if (iv.length !== 12) throw new SetupError();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv,
    additionalData: encoder.encode(COOKIE_PATH) }, await cookieKey(secret), unbase64url(parts[1]));
  const p = object(JSON.parse(new TextDecoder().decode(decrypted)));
  if (!/^[\w-]{43}$/.test(text(p.state)) || !/^[\w-]{43}$/.test(text(p.verifier)) ||
    typeof p.issued !== "number" || typeof p.expires !== "number" ||
    !Number.isFinite(p.issued) || !Number.isFinite(p.expires) || p.issued > now ||
    p.expires <= now || p.expires - p.issued !== SESSION_TTL) throw new SetupError();
  return { state: p.state as string, verifier: p.verifier as string, uid: text(p.uid, 100),
    session: text(p.session, 3000), issued: p.issued, expires: p.expires };
}
export function cookie(value: string, clear = false): string {
  return `${COOKIE_NAME}=${clear ? "" : value}; Path=${COOKIE_PATH}; Max-Age=${clear ? 0 : 600}; HttpOnly; Secure; SameSite=Lax`;
}
export function readCookie(header: string): string {
  const entries = header.split(";").map(x => x.trim()).filter(x => x.startsWith(COOKIE_NAME + "="));
  if (entries.length !== 1) throw new SetupError();
  return text(entries[0].slice(COOKIE_NAME.length + 1), 8000);
}
export async function limitedText(body: Request | Response, limit = 8192): Promise<string> {
  if (!body.body) return "";
  const reader = body.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.length;
      if (total > limit) { await reader.cancel(); throw new SetupError("invalid_request", 413); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
export async function json(body: Request | Response, limit = 32768): Promise<Record<string, unknown>> {
  return object(JSON.parse(await limitedText(body, limit)));
}
export function checkScope(value: unknown): void {
  const scopes = text(value, 1024).trim().split(/\s+/);
  if (scopes.length !== 1 || scopes[0] !== DRIVE_SCOPE) throw new SetupError("invalid_scope");
}
export function checkToken(body: Record<string, unknown>, requireRefresh = false) {
  const access = text(body.access_token);
  if (body.token_type !== "Bearer" || !Number.isInteger(body.expires_in) ||
    Number(body.expires_in) < 1 || Number(body.expires_in) > 3600) throw new SetupError();
  if (requireRefresh || body.scope !== undefined) checkScope(body.scope);
  return { access, refresh: requireRefresh ? text(body.refresh_token) : "", expires: Number(body.expires_in) };
}
export function checkFolder(meta: Record<string, unknown>, permissions: Record<string, unknown>, expected: string): void {
  const allowed = new Set([ACCOUNT, "mluisafdeassis@gmail.com"]);
  if (meta.id !== expected || meta.mimeType !== "application/vnd.google-apps.folder" || meta.trashed !== false ||
    meta.driveId || object(meta.capabilities).canAddChildren !== true ||
    !Array.isArray(meta.owners) || meta.owners.length !== 1 ||
    !allowed.has(String(object(meta.owners[0]).emailAddress).toLowerCase()) ||
    permissions.nextPageToken || !Array.isArray(permissions.permissions) ||
    permissions.permissions.length < 1 || permissions.permissions.length > 2) throw new SetupError("folder_not_private");
  let owner = false;
  for (const value of permissions.permissions) {
    const p = object(value);
    if (p.type !== "user" || p.deleted === true || p.pendingOwner === true ||
      !["owner", "writer", "reader", "commenter"].includes(String(p.role)) ||
      !allowed.has(String(p.emailAddress).toLowerCase())) throw new SetupError("folder_not_private");
    if (p.role === "owner" && p.emailAddress === object(meta.owners[0]).emailAddress) owner = true;
  }
  if (!owner) throw new SetupError("folder_not_private");
}
