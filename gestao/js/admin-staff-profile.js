function clean(value) {
  return String(value ?? '').trim();
}

export function hasCompleteClinicalIdentity(profile) {
  return Boolean(clean(profile?.profissao) && clean(profile?.conselho) && clean(profile?.registro_conselho));
}

export async function updateStaffClinicalIdentity({ client, userId, profissao, conselho, registroConselho }) {
  const { data, error } = await client.rpc('bc_staff_update_clinical_identity', {
    p_user_id: userId,
    p_profissao: clean(profissao),
    p_conselho: clean(conselho),
    p_registro_conselho: clean(registroConselho),
  });
  if (error) throw error;
  return data;
}
