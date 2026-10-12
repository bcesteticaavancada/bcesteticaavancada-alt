function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export async function getAnamneseState({ client, clienteId }) {
  return unwrap(await client.rpc('bc_anamnese_state', { p_cliente_id: clienteId }));
}

export async function getAnamneseForEdit({ client, anamneseId }) {
  const [{ data: record, error: recordError }, { data: rows, error: rowsError }] = await Promise.all([
    client.from('anamneses_gerais').select('id,cliente_id,version,status,source,reviewed_at,finalized_at,valid_until').eq('id', anamneseId).single(),
    client.from('anamnese_respostas').select('question_key,answer_json').eq('anamnese_id', anamneseId),
  ]);
  if (recordError) throw recordError;
  if (rowsError) throw rowsError;
  const answers = Object.fromEntries((rows || []).map((row) => [row.question_key, row.answer_json]));
  return { ...record, answers };
}

export async function beginAnamnese({ client, clienteId, source = 'presencial' }) {
  return unwrap(await client.rpc('bc_anamnese_begin', { p_cliente_id: clienteId, p_source: source }));
}

export async function saveAnamneseAnswers({ client, anamneseId, answers }) {
  return unwrap(await client.rpc('bc_anamnese_save_answers', { p_anamnese_id: anamneseId, p_answers: answers }));
}

export async function submitAnamneseForReview({ client, anamneseId }) {
  return unwrap(await client.rpc('bc_anamnese_submit_review', { p_anamnese_id: anamneseId }));
}

export async function markAnamneseReviewed({ client, anamneseId }) {
  return unwrap(await client.rpc('bc_anamnese_mark_reviewed', { p_anamnese_id: anamneseId }));
}

export async function listAnamneseVersions({ client, clienteId }) {
  return unwrap(await client.rpc('bc_anamnese_versions', { p_cliente_id: clienteId }));
}

export async function recordClinicalConfirmation({ client, clienteId, anamneseId, changed, details = null }) {
  return unwrap(await client.rpc('bc_anamnese_confirm_clinical_change', {
    p_cliente_id: clienteId,
    p_anamnese_id: anamneseId,
    p_changed: Boolean(changed),
    p_details: details,
  }));
}

export async function createRemoteLink({ client, anamneseId }) {
  return unwrap(await client.rpc('bc_anamnese_create_remote_link', { p_anamnese_id: anamneseId }));
}

export async function revokeRemoteLink({ client, linkId }) {
  return unwrap(await client.rpc('bc_anamnese_revoke_remote_link', { p_link_id: linkId }));
}
