function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export async function listClinicalAlerts({ client, clienteId, activeOnly = true }) {
  return unwrap(await client.rpc('bc_clinical_alert_list', { p_cliente_id: clienteId, p_active_only: Boolean(activeOnly) })) || [];
}

export async function createManualClinicalAlert({ client, clienteId, level, description }) {
  return unwrap(await client.rpc('bc_clinical_alert_create_manual', {
    p_cliente_id: clienteId,
    p_level: level,
    p_description: description,
  }));
}

export async function inactivateClinicalAlert({ client, alertId, reason }) {
  return unwrap(await client.rpc('bc_clinical_alert_inactivate', { p_alert_id: alertId, p_reason: reason }));
}
