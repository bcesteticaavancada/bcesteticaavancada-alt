// Pure helpers for BC's server-only parallel backup. Never expose clinical paths to the browser.
export type Entry = {
  path: string;
  updatedAt: string;
  mime: string;
  size: number;
};
export type DriveRecord = {
  id: string;
  updatedAt: string;
  hash: string;
};
export type Candidate = {
  entry: Entry;
  sourceKey: string;
  current?: DriveRecord;
};

export const BUCKET = "bc-prontuario-private";
export const PROJECT_ID = "tpqsmerlxquyrzrjbogj";
export const TEST_PREFIX = "homologacao/drive-backup/";
// Multipart-only draft stays within Google's recommended 5 MB transport size.
export const MAX_BYTES = 5_000_000;
export const MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isFinancialPath(path: string): boolean {
  const words = path.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().split(/[\/_.\s-]+/);
  return words.some((word) =>
    /^(financeiros?|finance|comissao|comissoes|recibos?|caixa|pagamentos?|payouts?|recebimentos?|repasses?|faturas?)$/
      .test(word)
  );
}
export function allowedPath(path: string): boolean {
  if (
    !path || path.startsWith("/") || /[\\%\x00-\x1f?#]/.test(path) ||
    path.split("/").some((x) => !x || x === "." || x === "..") ||
    isFinancialPath(path)
  ) return false;
  const relative = path.startsWith(TEST_PREFIX)
    ? path.slice(TEST_PREFIX.length)
    : path;
  return /^(documentos|pre-anamneses|assinaturas|fotos-clinicas|identificacao|arquivos-clientes)\/.+/
    .test(relative);
}

export function isAllowedRoot(path: string): boolean {
  const relative = path.startsWith(TEST_PREFIX)
    ? path.slice(TEST_PREFIX.length)
    : path;
  return /^(documentos|assinaturas|pre-anamneses|arquivos-clientes|identificacao|fotos-clinicas)(\/|$)/
    .test(relative);
}
export function destination(path: string): "clinical" | "client" | null {
  if (!allowedPath(path)) return null;
  if (path.startsWith(TEST_PREFIX)) path = path.slice(TEST_PREFIX.length);
  return /^(documentos|pre-anamneses|assinaturas)\//.test(path)
    ? "clinical"
    : "client";
}
export function extension(path: string): string {
  const match = path.toLowerCase().match(
    /\.(pdf|png|jpe?g|webp|txt|csv|json)$/,
  );
  return match ? match[0] : ".bin";
}
export function safeFileName(path: string, key: string): string {
  // Patient names and original filenames are intentionally absent from Drive filenames.
  const kind = destination(path);
  if (!kind) throw Error("SOURCE_PATH_INVALID");
  return (kind === "clinical" ? "documento-" : "arquivo-") +
    key.slice(0, 32) + extension(path);
}
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const owned = new Uint8Array(data.length);
  owned.set(data);
  const digest = await crypto.subtle.digest("SHA-256", owned.buffer);
  return Array.from(
    new Uint8Array(digest),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function sourceKey(bucket: string, path: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(bucket + ":" + path));
}
export function unchanged(
  entry: Entry,
  record: DriveRecord | undefined,
): boolean {
  // Content updates are detected by the Storage updated_at field.
  return Boolean(
    record && /^[0-9a-f]{64}$/.test(record.hash) && entry.updatedAt &&
      record.updatedAt === entry.updatedAt,
  );
}
export function selectPending(
  entries: Array<Entry & { sourceKey: string }>,
  existing: Map<string, DriveRecord>,
  maxBatch: number,
): Candidate[] {
  const pending: Candidate[] = [];
  if (!Number.isInteger(maxBatch) || maxBatch <= 0) return pending;
  for (const entry of entries) {
    const current = existing.get(entry.sourceKey);
    if (!unchanged(entry, current)) {
      pending.push({ entry, sourceKey: entry.sourceKey, current });
      if (pending.length === maxBatch) break;
    }
  }
  return pending;
}
export type DrivePermission = {
  type?: string;
  role?: string;
  emailAddress?: string;
};

export function isPrivatePermissionSet(
  permissions: DrivePermission[],
  allowedAccounts: Set<string>,
): boolean {
  return permissions.length > 0 &&
    permissions.every((permission) =>
      permission.type === "user" &&
      ["owner", "writer", "reader", "commenter"].includes(
        permission.role || "",
      ) &&
      allowedAccounts.has((permission.emailAddress || "").toLowerCase())
    );
}

export function secureEqual(a: string, b: string): boolean {
  // Fixed-length secrets, resistant to a simple prefix timing leak.
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    difference |= (left[i] || 0) ^ (right[i] || 0);
  }
  return difference === 0;
}
