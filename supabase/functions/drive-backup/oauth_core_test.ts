import { deepStrictEqual as equal, ok, rejects } from "node:assert/strict";
import { authorizationUrl, CALLBACK, DRIVE_SCOPE, makePending, validateCallback } from "./oauth_core.ts";
const CLIENT = "123456789012-sandboxclient.apps.googleusercontent.com";
Deno.test("OAuth uses PKCE, offline consent and only drive.file", async () => {
  const pending = await makePending(1000);
  equal(pending.state.length, 43);
  equal(pending.verifier.length, 86);
  equal(pending.challenge.length, 43);
  const url = new URL(authorizationUrl(CLIENT, CALLBACK, pending));
  equal(url.origin, "https://accounts.google.com");
  equal(url.searchParams.get("scope"), DRIVE_SCOPE);
  equal(url.searchParams.get("access_type"), "offline");
  equal(url.searchParams.get("response_type"), "code");
  equal(url.searchParams.get("code_challenge_method"), "S256");
  equal(url.searchParams.get("code_challenge"), pending.challenge);
  equal(url.searchParams.get("state"), pending.state);
  ok(!url.toString().includes(pending.verifier));
  equal(pending.expiresAt, 301000);
});
Deno.test("callback accepts only exact origin, unexpired state and one code", async () => {
  const pending = await makePending(1000);
  const params = new URLSearchParams({ state: pending.state, code: "fictitious-code" });
  const url = CALLBACK + "?" + params;
  equal(await validateCallback(url, pending.stateHash, pending.expiresAt, 2000), "fictitious-code");
  await rejects(() => validateCallback(url, pending.stateHash, pending.expiresAt, 301001));
  await rejects(() => validateCallback(url, "0".repeat(64), pending.expiresAt, 2000));
  await rejects(() => validateCallback(url.replace("supabase.co", "example.com"), pending.stateHash, pending.expiresAt, 2000));
  await rejects(() => validateCallback(url + "&state=duplicate", pending.stateHash, pending.expiresAt, 2000));
  await rejects(() => validateCallback(url + "&code=duplicate", pending.stateHash, pending.expiresAt, 2000));
  await rejects(() => validateCallback(url + "&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive", pending.stateHash, pending.expiresAt, 2000));
  await rejects(() => validateCallback(url + "&error=access_denied", pending.stateHash, pending.expiresAt, 2000));
});
Deno.test("redirect cannot be redirected to the live site", async () => {
  const pending = await makePending();
  for (const redirect of ["https://bcesteticaavancada.github.io/", "http://localhost:54321/callback"]) {
    let rejected = false;
    try { authorizationUrl(CLIENT, redirect, pending); } catch { rejected = true; }
    equal(rejected, true);
  }
});
