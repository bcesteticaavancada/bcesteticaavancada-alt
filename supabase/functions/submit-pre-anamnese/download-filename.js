const SAFE_PART = /[^\p{L}\p{N}._-]+/gu;

function cleanNamePart(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(SAFE_PART, '')
    .replace(/^[._-]+|[._-]+$/g, '');
}

function beloHorizonteDate(createdAt) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(createdAt));

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildPdfDownloadFilename(patientName, createdAt) {
  const words = String(patientName ?? '').trim().split(/\s+/).filter(Boolean);
  const first = cleanNamePart(words[0] ?? 'Paciente') || 'Paciente';
  const last = cleanNamePart(words.length > 1 ? words.at(-1) : '');
  const person = last && last !== first ? `${first}-${last}` : first;
  return `BC-Ficha${beloHorizonteDate(createdAt)}${person}.pdf`;
}
