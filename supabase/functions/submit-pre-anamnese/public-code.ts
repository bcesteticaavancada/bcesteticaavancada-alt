const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(length = 5): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

export function buildPublicCode(date: Date, suffix?: string): string {
  const yyyy = String(date.getUTCFullYear()).padStart(4, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const clean = String(suffix ?? randomSuffix(5)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5).padEnd(5, 'X');
  return `BC-${yyyy}${mm}${dd}-${clean}`;
}
