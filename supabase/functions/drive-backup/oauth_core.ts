// Preparation only: not imported by the live BC app or a deployed function.
import { secureEqual, sha256Hex } from "./core.ts";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const CALLBACK = "https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/drive-oauth-callback";
const OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export type Pending = { state: string; stateHash: string; verifier: string; challenge: string; expiresAt: number };
const bytesToUrl = (array: Uint8Array) => btoa(String.fromCharCode(...array))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const randomUrl = (n: number) => bytesToUrl(crypto.getRandomValues(new Uint8Array(n)));
export async function makePending(now = Date.now()): Promise<Pending> {
  const state = randomUrl(32), verifier = randomUrl(64);
  return {
    state, verifier,
    stateHash: await sha256Hex(new TextEncoder().encode(state)),
    challenge: bytesToUrl(new Uint8Array(await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(verifier),
    ))),
    expiresAt: now + 5 * 60 * 1000,
  };
}
export function authorizationUrl(clientId: string, redirectUri: string, pending: Pending): string {
  if (!/^[0-9]+-[\w-]+\.apps\.googleusercontent\.com$/.test(clientId) ||
      redirectUri !== CALLBACK ||
      !/^[\w-]{43}$/.test(pending.state) ||
      !/^[\w-]{43}$/.test(pending.challenge)) throw Error("OAUTH_CONFIG_INVALID");
  const url = new URL(OAUTH_URL);
  for (const [name, value] of Object.entries({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    include_granted_scopes: "false",
    prompt: "consent select_account",
    state: pending.state,
    code_challenge: pending.challenge,
    code_challenge_method: "S256",
  })) url.searchParams.set(name, value);
  return url.toString();
}
// Caller must atomically consume server-stored state and bind it to an authenticated
// authorized session BEFORE calling this function. Never persist state/verifier in a browser.
export async function validateCallback(
  callbackUrl: string, expectedStateHash: string, expiresAt: number, now = Date.now(),
): Promise<string> {
  const url = new URL(callbackUrl);
  if (url.origin + url.pathname !== CALLBACK ||
      url.searchParams.has("error") ||
      url.searchParams.getAll("state").length !== 1 ||
      url.searchParams.getAll("code").length !== 1 ||
      !Number.isFinite(now) || now > expiresAt) throw Error("OAUTH_CALLBACK_REJECTED");
  const state = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
  if (!/^[\w-]{43}$/.test(state) || code.length < 6 || code.length > 2048 ||
      /[\x00-\x1f]/.test(code) || !/^[a-f0-9]{64}$/.test(expectedStateHash)) {
    throw Error("OAUTH_CALLBACK_REJECTED");
  }
  const hash = await sha256Hex(new TextEncoder().encode(state));
  if (!secureEqual(hash, expectedStateHash)) throw Error("OAUTH_CALLBACK_REJECTED");
  const scope = url.searchParams.get("scope");
  if (scope !== null && scope.trim() !== DRIVE_SCOPE) throw Error("OAUTH_SCOPE_REJECTED");
  return code;
}
