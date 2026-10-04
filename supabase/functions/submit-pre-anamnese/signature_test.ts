import { assertEquals, assertThrows } from "jsr:@std/assert";
import { decodePngDataUrl, readPngDimensions, validateRubricPngDataUrl } from "./signature.ts";

function pngHeader(width: number, height: number, extraBytes = 0): Uint8Array {
  const bytes = new Uint8Array(24 + extraBytes);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function dataUrl(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(binary)}`;
}

Deno.test("readPngDimensions reads IHDR width and height", () => {
  assertEquals(readPngDimensions(pngHeader(320, 190)), { width: 320, height: 190 });
});

Deno.test("validateRubricPngDataUrl accepts rubric dimensions inside limits", () => {
  const result = validateRubricPngDataUrl(dataUrl(pngHeader(320, 190)));
  assertEquals(result.width, 320);
  assertEquals(result.height, 190);
  assertEquals(Array.from(result.bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

Deno.test("validateRubricPngDataUrl rejects missing IHDR and abnormal dimensions", () => {
  const missingIhdr = pngHeader(320, 190);
  missingIhdr.set([66, 65, 68, 33], 12);
  assertThrows(() => validateRubricPngDataUrl(dataUrl(missingIhdr)), Error, "IHDR");
  assertThrows(() => validateRubricPngDataUrl(dataUrl(pngHeader(119, 80))), Error, "dimensões");
  assertThrows(() => validateRubricPngDataUrl(dataUrl(pngHeader(120, 79))), Error, "dimensões");
  assertThrows(() => validateRubricPngDataUrl(dataUrl(pngHeader(4097, 100))), Error, "dimensões");
  assertThrows(() => validateRubricPngDataUrl(dataUrl(pngHeader(200, 2049))), Error, "dimensões");
});

Deno.test("validateRubricPngDataUrl rejects decoded PNG above 2 MiB", () => {
  assertThrows(
    () => validateRubricPngDataUrl(dataUrl(pngHeader(320, 190, 2_097_152))),
    Error,
    "tamanho",
  );
});

Deno.test("decodePngDataUrl rejects content that only pretends to be PNG", () => {
  assertThrows(
    () => decodePngDataUrl("data:image/png;base64,SGVsbG8gd29ybGQ="),
    Error,
    "Rubrica PNG inválida",
  );
});

Deno.test("decodePngDataUrl rejects malformed base64", () => {
  assertThrows(
    () => decodePngDataUrl("data:image/png;base64,%%%"),
    Error,
  );
});
