import { assertEquals, assertMatch, assertRejects, assertThrows } from "jsr:@std/assert";
import { decodePngDataUrl, readPngDimensions, validateRubricPngDataUrl } from "./signature.ts";

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function makePngDataUrl(width = 320, height = 190, extraBytes = 0): string {
  const bytes = new Uint8Array(24 + extraBytes);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([73, 72, 68, 82], 12); // IHDR
  writeUint32(bytes, 16, width);
  writeUint32(bytes, 20, height);
  return `data:image/png;base64,${toBase64(bytes)}`;
}

Deno.test("decodePngDataUrl accepts a real PNG signature", () => {
  const bytes = decodePngDataUrl(makePngDataUrl());
  assertEquals(Array.from(bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

Deno.test("decodePngDataUrl rejects content that only pretends to be PNG", () => {
  assertThrows(
    () => decodePngDataUrl("data:image/png;base64,SGVsbG8gd29ybGQ="),
    Error,
    "Assinatura PNG inválida",
  );
});

Deno.test("decodePngDataUrl rejects malformed base64", () => {
  assertThrows(
    () => decodePngDataUrl("data:image/png;base64,%%%"),
    Error,
  );
});

Deno.test("readPngDimensions requires IHDR and reads big-endian width and height", () => {
  const bytes = decodePngDataUrl(makePngDataUrl(640, 380));
  assertEquals(readPngDimensions(bytes), { width: 640, height: 380 });
  bytes[12] = 0;
  assertThrows(() => readPngDimensions(bytes), Error, "IHDR");
});

Deno.test("validateRubricPngDataUrl accepts a rubric PNG inside limits and hashes bytes", async () => {
  const result = await validateRubricPngDataUrl(makePngDataUrl(320, 190));
  assertEquals(result.width, 320);
  assertEquals(result.height, 190);
  assertEquals(result.bytes.length, 24);
  assertMatch(result.sha256, /^[0-9a-f]{64}$/);
});

Deno.test("validateRubricPngDataUrl rejects dimensions outside rubric limits", async () => {
  await assertRejects(() => validateRubricPngDataUrl(makePngDataUrl(119, 190)), Error);
  await assertRejects(() => validateRubricPngDataUrl(makePngDataUrl(320, 79)), Error);
  await assertRejects(() => validateRubricPngDataUrl(makePngDataUrl(4097, 190)), Error);
  await assertRejects(() => validateRubricPngDataUrl(makePngDataUrl(320, 2049)), Error);
});

Deno.test("validateRubricPngDataUrl rejects PNG payloads above two MiB", async () => {
  const extraBytes = 2_097_152 - 24 + 1;
  await assertRejects(() => validateRubricPngDataUrl(makePngDataUrl(320, 190, extraBytes)), Error);
});
