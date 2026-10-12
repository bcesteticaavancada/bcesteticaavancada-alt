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

export async function listStaffClinicalProfiles({ client }) {
  const { data, error } = await client
    .from('staff_profiles')
    .select('user_id,display_name,role,active,atende_clientes,profissao,conselho,registro_conselho')
    .eq('active', true)
    .eq('atende_clientes', true)
    .order('display_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

function fillForm(form, profile) {
  if (!form) return;
  form.elements.profissao.value = profile?.profissao || '';
  form.elements.conselho.value = profile?.conselho || '';
  form.elements.registro_conselho.value = profile?.registro_conselho || '';
}

function renderState(root, profile) {
  const state = root.getElementById('staffClinicalIdentityState');
  if (!state) return;
  if (!profile) {
    state.textContent = 'Selecione uma profissional.';
    return;
  }
  state.textContent = hasCompleteClinicalIdentity(profile)
    ? 'Identificação profissional completa para assinatura de documentos.'
    : 'Perfil incompleto: profissão, conselho e registro são necessários para assinar documentos clínicos.';
}

export async function initAdminStaffClinicalIdentity({ client, root = document }) {
  const form = root.getElementById('staffClinicalIdentityForm');
  const select = root.getElementById('staffClinicalProfessional');
  const status = root.getElementById('staffClinicalIdentityStatus');
  if (!form || !select) return null;

  let profiles = await listStaffClinicalProfiles({ client });

  function currentProfile() {
    return profiles.find((item) => item.user_id === select.value) || null;
  }

  function renderOptions(preferredUserId) {
    const selected = preferredUserId || select.value || profiles[0]?.user_id || '';
    select.innerHTML = profiles.length
      ? profiles.map((profile) => `<option value="${profile.user_id}">${profile.display_name}</option>`).join('')
      : '<option value="">Nenhuma profissional ativa</option>';
    if (profiles.some((profile) => profile.user_id === selected)) select.value = selected;
    fillForm(form, currentProfile());
    renderState(root, currentProfile());
  }

  renderOptions();

  select.addEventListener('change', () => {
    fillForm(form, currentProfile());
    renderState(root, currentProfile());
    if (status) status.textContent = '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const profile = currentProfile();
    if (!profile) return;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    if (status) status.textContent = 'Salvando identificação profissional…';
    try {
      await updateStaffClinicalIdentity({
        client,
        userId: profile.user_id,
        profissao: form.elements.profissao.value,
        conselho: form.elements.conselho.value,
        registroConselho: form.elements.registro_conselho.value,
      });
      profiles = await listStaffClinicalProfiles({ client });
      renderOptions(profile.user_id);
      if (status) status.textContent = 'Identificação profissional salva.';
    } catch (error) {
      if (status) status.textContent = error?.message || 'Não foi possível salvar a identificação profissional.';
    } finally {
      if (button) button.disabled = false;
    }
  });

  return { refresh: async () => { profiles = await listStaffClinicalProfiles({ client }); renderOptions(); } };
}
