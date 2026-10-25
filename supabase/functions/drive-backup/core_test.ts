import {
  destination, extension, isAllowedRoot, isFinancialPath, isPrivatePermissionSet, safeFileName, secureEqual, selectPending, sha256Hex, sourceKey,
} from "./core.ts";
function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed'); }
function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Values differ');
}

Deno.test("routes medical PDFs and client uploads into separate private folders", () => {
  assertEquals(destination("documentos/anamneses/123.pdf"), "clinical");
  assertEquals(destination("documentos/consentimentos/123.pdf"), "clinical");
  assertEquals(destination("arquivos-clientes/123/teste.pdf"), "client");
});
Deno.test("Drive filenames do not reveal patient names or filenames", () => {
  const name = safeFileName("documentos/Ana Maria/consulta.pdf", "a".repeat(64));
  assert(name.startsWith("documento-"));
  assert(name.endsWith(".pdf"));
  assert(!name.includes("Ana") && !name.includes("consulta"));
  assertEquals(extension("arquivo.unknown"), ".bin");
});
Deno.test("stable source fingerprint separates bucket and object paths", async () => {
  const a = await sourceKey("bc-prontuario-private", "a.pdf");
  const b = await sourceKey("bc-prontuario-private", "b.pdf");
  assertEquals(a.length, 64);
  assert(a !== b);
  assertEquals(await sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
Deno.test("unchanged objects are not uploaded again; changed objects are selected", () => {
  const hash = "b".repeat(64);
  const entries = [
    { path: "a.pdf", updatedAt: "2026-10-22T10:00:00Z", mime: "application/pdf", size: 2, sourceKey: "a" },
    { path: "b.pdf", updatedAt: "2026-10-22T11:00:00Z", mime: "application/pdf", size: 2, sourceKey: "b" },
  ];
  const known = new Map([["a", { id: "drive-file-id", updatedAt: entries[0].updatedAt, hash }]]);
  assertEquals(selectPending(entries, known, 12).map((candidate) => candidate.entry.path), ["b.pdf"]);
  entries[0].updatedAt = "2026-10-22T12:00:00Z";
  assertEquals(selectPending(entries, known, 1).map((candidate) => candidate.entry.path), ["a.pdf"]);
});
Deno.test("invalid remote metadata is never treated as a verified backup", () => {
  const entries = [
    { path: "a.pdf", updatedAt: "2026-10-22T10:00:00Z", mime: "application/pdf", size: 2, sourceKey: "a" },
  ];
  const known = new Map([["a", { id: "fake", updatedAt: entries[0].updatedAt, hash: "" }]]);
  assertEquals(selectPending(entries, known, 12).length, 1);
});
Deno.test("job secret comparison does not accept prefixes", () => {
  assert(secureEqual("a".repeat(64), "a".repeat(64)));
  assert(!secureEqual("a".repeat(63), "a".repeat(64)));
  assert(!secureEqual("a".repeat(64), "a".repeat(63) + "b"));
});

Deno.test("clinical signatures and pre-anamneses go to the clinical folder", () => {
  assertEquals(destination("assinaturas/doc-1/assinatura.png"), "clinical");
  assertEquals(destination("pre-anamneses/2026/10/ficha.pdf"), "clinical");
  assertEquals(destination("identificacao/client-1/foto.jpg"), "client");
  assertEquals(destination("fotos-clinicas/client-1/atendimento/foto.webp"), "client");
});

Deno.test("financial and unknown storage paths fail closed", () => {
  assert(isFinancialPath("documentos/financeiro/recibo.pdf"));
  assert(isFinancialPath("arquivos-clientes/caixa/recibo.pdf"));
  assertEquals(destination("documentos/financeiro/recibo.pdf"), null);
  assertEquals(destination("financeiro/fatura.pdf"), null);
  assertEquals(destination("outra-pasta/cliente.pdf"), null);
  assertEquals(destination("documentos"), null);
  assertEquals(isAllowedRoot("outra-pasta/cliente.pdf"), false);
  assertEquals(isAllowedRoot("assinaturas/documento/foto.png"), true);
  let rejected = false;
  try { safeFileName("financeiro/fatura.pdf", "a".repeat(64)); }
  catch { rejected = true; }
  assert(rejected);
});

Deno.test("Drive sharing verification rejects public, domain and third-party access", () => {
  const allowed = new Set(["owner@example.com", "mel@example.com"]);
  const valid = [
    { type: "user", role: "owner", emailAddress: "owner@example.com" },
    { type: "user", role: "writer", emailAddress: "mel@example.com" },
  ];
  assert(isPrivatePermissionSet(valid, allowed));
  assert(!isPrivatePermissionSet([], allowed));
  assert(!isPrivatePermissionSet([...valid, { type: "anyone", role: "reader" }], allowed));
  assert(!isPrivatePermissionSet([...valid, { type: "domain", role: "reader" }], allowed));
  assert(!isPrivatePermissionSet([...valid, { type: "user", role: "reader", emailAddress: "third@example.com" }], allowed));
});
