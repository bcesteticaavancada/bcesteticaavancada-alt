const DRAFT_FIELDS = [
  'nome',
  'classe_documental',
  'categoria',
  'descricao',
  'price_mode',
  'base_price',
  'suggested_duration',
  'requires_general_anamnesis',
  'requires_return',
  'return_interval_days',
  'pre_guidance',
  'post_guidance',
  'consent_supplement',
  'specific_schema',
  'technical_schema',
  'protocol_mode',
  'requires_photo',
  'requires_product_lot',
  'requires_equipment',
  'component_version_ids',
];

function ensureClient(client) {
  if (!client || typeof client.rpc !== 'function') throw new Error('Cliente Supabase indisponível.');
}

function required(value, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`${label} é obrigatório.`);
  return clean;
}

function unwrap(result, fallback = 'Não foi possível concluir a operação.') {
  if (result?.error) throw result.error instanceof Error ? result.error : new Error(result.error?.message || fallback);
  return result?.data ?? null;
}

function sanitizeDraftPayload(payload = {}) {
  const clean = {};
  for (const field of DRAFT_FIELDS) {
    if (Object.hasOwn(payload, field)) clean[field] = payload[field];
  }
  return clean;
}

export async function listProcedures({ client, includeArchived = false }) {
  ensureClient(client);
  return unwrap(await client.rpc('bc_procedure_list', { p_include_archived: Boolean(includeArchived) })) || [];
}

export async function getProcedure({ client, procedureId }) {
  ensureClient(client);
  return unwrap(await client.rpc('bc_procedure_get', { p_procedure_id: required(procedureId, 'Procedimento') }));
}

export async function saveProcedureDraft({ client, procedureId = null, payload = {} }) {
  ensureClient(client);
  return unwrap(await client.rpc('bc_procedure_save_draft', {
    p_procedure_id: procedureId ? required(procedureId, 'Procedimento') : null,
    p_payload: sanitizeDraftPayload(payload),
  }));
}

export async function publishProcedure({ client, procedureId }) {
  ensureClient(client);
  return unwrap(await client.rpc('bc_procedure_publish', { p_procedure_id: required(procedureId, 'Procedimento') }));
}

export async function archiveProcedure({ client, procedureId }) {
  ensureClient(client);
  return unwrap(await client.rpc('bc_procedure_archive', { p_procedure_id: required(procedureId, 'Procedimento') }));
}

export async function setProcedureExecutionPermission({ client, procedureId, professionalUserId, allowed }) {
  ensureClient(client);
  return unwrap(await client.rpc('bc_procedure_set_execution_permission', {
    p_procedure_id: required(procedureId, 'Procedimento'),
    p_professional_user_id: required(professionalUserId, 'Profissional'),
    p_allowed: Boolean(allowed),
  }));
}

export async function setProcedureManagerCapability({ client, userId, enabled }) {
  ensureClient(client);
  return unwrap(await client.rpc('bc_staff_set_procedure_manager', {
    p_user_id: required(userId, 'Profissional'),
    p_enabled: Boolean(enabled),
  }));
}
