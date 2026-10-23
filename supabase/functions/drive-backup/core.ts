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
export type Candidate = { entry: Entry; sourceKey: string; current?: DriveRecord };

const CLINICAL_ROOTS = new Set(['documentos', 'assinaturas', 'pre-anamneses']);
const CLIENT_ROOTS = new Set(['arquivos-clientes', 'identificacao', 'fotos-clinicas']);

export function isFinancialPath(path: string): boolean {
  return path.split('/').some((part) =>
    /^(financeiro|finance|comiss(?:ao|oes|ões)|comissão|recibos?|caixa|pagamentos?|payouts?|recebimentos?|repasses?|faturas?)$/i.test(part));
}
export function isAllowedRoot(path: string): boolean {
  const root = path.split('/')[0].toLowerCase();
  return CLINICAL_ROOTS.has(root) || CLIENT_ROOTS.has(root);
}
export function destination(path: string): 'clinical' | 'client' | null {
  if (isFinancialPath(path)) return null;
  const parts = path.split('/');
  if (parts.length < 2 || parts.some((part) => !part)) return null;
  const root = parts[0].toLowerCase();
  if (CLINICAL_ROOTS.has(root)) return 'clinical';
  if (CLIENT_ROOTS.has(root)) return 'client';
  return null;
}
export function extension(path: string): string {
  const match = path.toLowerCase().match(/\.(pdf|png|jpe?g|webp|txt|csv|json)$/);
  return match ? match[0] : '.bin';
}
export function safeFileName(path: string, key: string): string {
  // Patient names and original filenames are intentionally absent from Drive filenames.
  const kind = destination(path);
  if (!kind) throw new Error('Caminho não classificado para backup');
  return (kind === 'clinical' ? 'documento-' : 'arquivo-') +
    key.slice(0, 32) + extension(path);
}
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const owned = new Uint8Array(data.length);
  owned.set(data);
  const digest = await crypto.subtle.digest('SHA-256', owned.buffer);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
}
export async function sourceKey(bucket: string, path: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(bucket + ':' + path));
}
export function unchanged(entry: Entry, record: DriveRecord | undefined): boolean {
  // Content updates are detected by the Storage updated_at field.
  return Boolean(record && /^[0-9a-f]{64}$/.test(record.hash) && entry.updatedAt && record.updatedAt === entry.updatedAt);
}
export function selectPending(
  entries: Array<Entry & { sourceKey: string }>,
  existing: Map<string, DriveRecord>,
  maxBatch: number,
): Candidate[] {
  const pending: Candidate[] = [];
  for (const entry of entries) {
    const current = existing.get(entry.sourceKey);
    if (!unchanged(entry, current)) {
      pending.push({ entry, sourceKey: entry.sourceKey, current });
      if (pending.length === maxBatch) break;
    }
  }
  return pending;
}
export type DrivePermission = { type?: string; role?: string; emailAddress?: string };

export function isPrivatePermissionSet(
  permissions: DrivePermission[], allowedAccounts: Set<string>,
): boolean {
  return permissions.length > 0 && permissions.every((permission) =>
    permission.type === 'user' &&
    ['owner', 'writer', 'reader', 'commenter'].includes(permission.role || '') &&
    allowedAccounts.has((permission.emailAddress || '').toLowerCase()));
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
