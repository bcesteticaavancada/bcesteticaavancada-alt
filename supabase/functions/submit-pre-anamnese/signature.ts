import { sha256Hex } from './integrity.ts';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const IHDR_SIGNATURE = [73, 72, 68, 82];
const MAX_RUBRIC_BYTES = 2_097_152;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 80;
const MAX_WIDTH = 4096;
const MAX_HEIGHT = 2048;

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

export function decodePngDataUrl(value: string): Uint8Array {
  const prefix = 'data:image/png;base64,';
  if (!value.startsWith(prefix)) throw new Error('Assinatura PNG inválida.');

  const encoded = value.slice(prefix.length).replace(/\s+/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error('Assinatura PNG inválida.');
  }

  let binary = '';
  try {
    binary = atob(encoded);
  } catch {
    throw new Error('Assinatura PNG inválida.');
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  if (bytes.length < PNG_SIGNATURE.length || !hasBytes(bytes, 0, PNG_SIGNATURE)) {
    throw new Error('Assinatura PNG inválida.');
  }

  return bytes;
}

export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24 || !hasBytes(bytes, 0, PNG_SIGNATURE)) {
    throw new Error('PNG inválido: cabeçalho IHDR ausente.');
  }

  if (!hasBytes(bytes, 12, IHDR_SIGNATURE)) {
    throw new Error('PNG inválido: cabeçalho IHDR ausente.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (!width || !height) throw new Error('PNG inválido: dimensões inválidas.');
  return { width, height };
}

export async function validateRubricPngDataUrl(value: string): Promise<{
  bytes: Uint8Array;
  width: number;
  height: number;
  sha256: string;
}> {
  const bytes = decodePngDataUrl(value);
  if (bytes.byteLength > MAX_RUBRIC_BYTES) throw new Error('Rubrica PNG excede o limite permitido.');

  const { width, height } = readPngDimensions(bytes);
  if (width < MIN_WIDTH || height < MIN_HEIGHT || width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new Error('Rubrica PNG possui dimensões inválidas.');
  }

  const sha256 = await sha256Hex(bytes);
  return { bytes, width, height, sha256 };
}
