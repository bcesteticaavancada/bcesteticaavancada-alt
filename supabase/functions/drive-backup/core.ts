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

export function destination(path: string): 'clinical' | 'client' {
  if (/^(documentos|anamneses|pre-anamneses|consentimentos|atendimentos)\//i.test(path)) {
    return 'clinical';
  }
  return 'client';
}
export function extension(path: string): string {
  const match = path.toLowerCase().match(/\.(pdf|png|jpe?g|webp|txt|csv|json)$/);
  return match ? match[0] : '.bin';
}
export function safeFileName(path: string, key: string): string {
  // Patient names and original filenames are intentionally absent from Drive filenames.
  return (destination(path) === 'clinical' ? 'documento-' : 'arquivo-') +
    key.slice(0, 32) + extension(path);
}
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
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
