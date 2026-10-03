const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function decodePngDataUrl(value: string): Uint8Array {
  const prefix = 'data:image/png;base64,';
  if (!value.startsWith(prefix)) throw new Error('Assinatura PNG inválida.');

  const encoded = value.slice(prefix.length).replace(/\s+/g, '');
  let binary = '';
  try {
    binary = atob(encoded);
  } catch {
    throw new Error('Assinatura PNG inválida.');
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  if (bytes.length < PNG_SIGNATURE.length) throw new Error('Assinatura PNG inválida.');
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('Assinatura PNG inválida.');
  }

  return bytes;
}
