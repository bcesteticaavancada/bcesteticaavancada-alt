import { assertEquals, assertThrows } from "jsr:@std/assert";
import { decodePngDataUrl } from "./signature.ts";

Deno.test("decodePngDataUrl accepts a real PNG signature", () => {
  const bytes = decodePngDataUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB");
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
