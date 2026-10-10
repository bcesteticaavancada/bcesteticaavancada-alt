function ensureClient(client) {
  if (!client || typeof client.from !== 'function') {
    throw new Error('Cliente Supabase indisponível.');
  }
}

function fail(error, fallback) {
  if (error) throw new Error(error.message || fallback);
}

export async function listAuditLog({ client, limit = 100, entityType = null, entityId = null }) {
  ensureClient(client);
  const safeLimit = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 100));
  let query = client
    .from('audit_log')
    .select('id,actor_user_id,action,entity_type,entity_id,old_data,new_data,created_at');

  const type = String(entityType ?? '').trim();
  const id = String(entityId ?? '').trim();
  if (type) query = query.eq('entity_type', type);
  if (id) query = query.eq('entity_id', id);

  query = query.order('created_at', { ascending: false }).limit(safeLimit);
  const { data, error } = await query;
  fail(error, 'Não foi possível carregar a auditoria.');
  return data ?? [];
}
