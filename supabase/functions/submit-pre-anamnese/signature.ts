const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MIN_WIDTH = 120;
const MIN_HEIGHT = 80;
const MAX_WIDTH = 4096;
const MAX_HEIGHT = 2048;
const MAX_BYTES = 2_097_152;

export function decodePngDataUrl(value: string): Uint8Array {
  const prefix = 'data:image/png;base64,';
  if (!value.startsWith(prefix)) throw new Error('Rubrica PNG inválida.');

  const encoded = value.slice(prefix.length).replace(/\s+/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error('Rubrica PNG inválida.');
  }

  let binary = '';
  try {
    binary = atob(encoded);
  } catch {
    throw new Error('Rubrica PNG inválida.');
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  if (bytes.length < PNG_SIGNATURE.length) throw new Error('Rubrica PNG inválida.');
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('Rubrica PNG inválida.');
  }

  return bytes;
}

export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24) throw new Error('Rubrica PNG inválida: IHDR ausente.');
  const ihdrLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, false);
  const ihdrType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (ihdrLength !== 13 || ihdrType !== 'IHDR') throw new Error('Rubrica PNG inválida: IHDR ausente.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

export function validateRubricPngDataUrl(value: string): { bytes: Uint8Array; width: number; height: number } {
  const bytes = decodePngDataUrl(value);
  if (bytes.byteLength > MAX_BYTES) throw new Error('Rubrica PNG excede o tamanho máximo permitido.');
  const { width, height } = readPngDimensions(bytes);
  if (width < MIN_WIDTH || height < MIN_HEIGHT || width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new Error('Rubrica PNG com dimensões inválidas.');
  }
  return { bytes, width, height };
}
