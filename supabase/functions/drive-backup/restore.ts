import {
  allowedPath,
  BUCKET,
  type Entry,
  MAX_BYTES,
  MIME_TYPES,
  PROJECT_ID,
  sha256Hex,
  sourceKey,
} from "./core.ts";

export type Manifest = {
  version: 2;
  projectId: string;
  bucket: string;
  path: string;
  sourceKey: string;
  sourceUpdatedAt: string;
  dataFileId: string;
  sha256: string;
  size: number;
  mime: string;
};
export async function buildManifest(
  entry: Entry,
  key: string,
  id: string,
  hash: string,
): Promise<Uint8Array> {
  const manifest: Manifest = {
    version: 2,
    projectId: PROJECT_ID,
    bucket: BUCKET,
    path: entry.path,
    sourceKey: key,
    sourceUpdatedAt: entry.updatedAt,
    dataFileId: id,
    sha256: hash,
    size: entry.size,
    mime: entry.mime,
  };
  await parseManifest(new TextEncoder().encode(JSON.stringify(manifest)));
  return new TextEncoder().encode(JSON.stringify(manifest));
}
export async function parseManifest(bytes: Uint8Array): Promise<Manifest> {
  if (bytes.length > 65536) throw Error("MANIFEST_TOO_LARGE");
  let m: Manifest;
  try {
    m = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw Error("MANIFEST_INVALID");
  }
  if (
    !m || m.version !== 2 || m.projectId !== PROJECT_ID ||
    m.bucket !== BUCKET || typeof m.path !== "string" || !allowedPath(m.path) ||
    !Number.isSafeInteger(m.size) || m.size <= 0 || m.size > MAX_BYTES ||
    !MIME_TYPES.has(m.mime) ||
    !Number.isFinite(Date.parse(m.sourceUpdatedAt)) ||
    !/^[-\w]{8,120}$/.test(m.dataFileId) || !/^[a-f0-9]{64}$/.test(m.sha256) ||
    m.sourceKey !== await sourceKey(m.bucket, m.path)
  ) throw Error("MANIFEST_INVALID");
  return m;
}
// Produces a verified recovery payload only. It never writes to Supabase.
export async function restoreBytes(
  manifestBytes: Uint8Array,
  bytes: Uint8Array,
  expected: { manifestSha256: string; sourceKey: string },
) {
  // The caller must obtain this reference independently from the supplied JSON.
  if (
    manifestBytes.length > 65536 ||
    !/^[a-f0-9]{64}$/.test(expected?.manifestSha256 || "") ||
    !/^[a-f0-9]{64}$/.test(expected?.sourceKey || "") ||
    await sha256Hex(manifestBytes) !== expected.manifestSha256
  ) throw Error("RESTORE_REFERENCE_MISMATCH");
  const manifest = await parseManifest(manifestBytes);
  if (manifest.sourceKey !== expected.sourceKey) {
    throw Error("RESTORE_REFERENCE_MISMATCH");
  }
  if (
    bytes.length !== manifest.size || await sha256Hex(bytes) !== manifest.sha256
  ) throw Error("RESTORE_INTEGRITY_FAILED");
  return {
    bucket: manifest.bucket,
    path: manifest.path,
    mime: manifest.mime,
    bytes: new Uint8Array(bytes),
  };
}
