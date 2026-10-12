const BUCKET = 'bc-prontuario-private';
const MAX_BYTES = 8 * 1024 * 1024;
const TYPE_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function required(value, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`${label} é obrigatório.`);
  return clean;
}

function ensureClient(client) {
  if (!client?.storage || typeof client.storage.from !== 'function' || typeof client.rpc !== 'function' || typeof client.from !== 'function') {
    throw new Error('Cliente Supabase indisponível.');
  }
}

function fail(error, fallback) {
  if (error) throw new Error(error.message || fallback);
}

function uniqueId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function validateFile(file) {
  if (!file || typeof file !== 'object') throw new Error('Selecione uma imagem JPEG, PNG ou WebP.');
  if (!TYPE_EXTENSIONS.has(file.type)) throw new Error('A foto deve ser uma imagem JPEG, PNG ou WebP.');
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('Tamanho da imagem inválido.');
  if (file.size > MAX_BYTES) throw new Error('A foto deve ter no máximo 8 MB.');
}

export async function uploadClientIdPhoto({ client, clienteId, file }) {
  ensureClient(client);
  const id = required(clienteId, 'Cliente');
  validateFile(file);
  const extension = TYPE_EXTENSIONS.get(file.type);
  const storagePath = `identificacao/${id}/${uniqueId()}.${extension}`;
  const bucket = client.storage.from(BUCKET);
  const { error: uploadError } = await bucket.upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  fail(uploadError, 'Não foi possível enviar a foto de identificação.');

  const { data: fotoId, error: registerError } = await client.rpc('bc_cliente_register_id_photo', {
    p_cliente_id: id,
    p_storage_path: storagePath,
    p_mime_type: file.type,
    p_tamanho_bytes: file.size,
  });
  fail(registerError, 'A foto foi enviada, mas não foi possível registrar o documento.');

  return { fotoId, storagePath };
}

export async function listClientIdPhotos({ client, clienteId }) {
  ensureClient(client);
  const id = required(clienteId, 'Cliente');
  const { data, error } = await client
    .from('cliente_identificacao_fotos')
    .select('id,cliente_id,storage_path,mime_type,tamanho_bytes,atual,created_by,created_at,substituida_at')
    .eq('cliente_id', id)
    .order('created_at', { ascending: false });
  fail(error, 'Não foi possível carregar as fotos de identificação.');
  return data ?? [];
}

export async function getClientIdPhotoUrl({ client, storagePath, expiresIn = 300 }) {
  ensureClient(client);
  const path = required(storagePath, 'Caminho da foto');
  if (!Number.isInteger(expiresIn) || expiresIn < 30 || expiresIn > 3600) {
    throw new Error('Validade da URL assinada inválida.');
  }
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  fail(error, 'Não foi possível abrir a foto de identificação.');
  const url = data?.signedUrl || data?.signedURL;
  if (!url) throw new Error('URL assinada da foto não foi retornada.');
  return url;
}

export async function setCurrentClientIdPhoto({ client, clienteId, fotoId }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_cliente_set_current_id_photo', {
    p_cliente_id: required(clienteId, 'Cliente'),
    p_foto_id: required(fotoId, 'Foto'),
  });
  fail(error, 'Não foi possível definir a foto atual.');
  return data;
}

export { BUCKET as CLIENT_ID_PHOTO_BUCKET, MAX_BYTES as CLIENT_ID_PHOTO_MAX_BYTES };
