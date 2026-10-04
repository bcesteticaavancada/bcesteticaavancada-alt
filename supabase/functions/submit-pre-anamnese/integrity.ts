function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortCanonical(child)]),
    );
  }
  return value;
}

export async function sha256Hex(value: Uint8Array | string): Promise<string> {
  const source = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function canonicalSubmission(input: {
  publicCode: string;
  patientName: string;
  patientCpf: string;
  procedure: string;
  answers: Record<string, unknown>;
  consents: Record<string, unknown>;
  sourceVersion: string;
  rubricSha256: string;
  confirmedAt: string;
}): string {
  return JSON.stringify(sortCanonical(input));
}
