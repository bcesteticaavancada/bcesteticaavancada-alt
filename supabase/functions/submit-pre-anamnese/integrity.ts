export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function buildCanonicalSubmissionSnapshot(input: Record<string, unknown>) {
  return {
    publicCode: input.publicCode,
    patientName: input.patientName,
    patientCpf: input.patientCpf,
    procedure: input.procedure,
    answers: input.answers,
    consents: input.consents,
    sourceVersion: input.sourceVersion,
    rubricSha256: input.rubricSha256,
    confirmedAt: input.confirmedAt,
  };
}
