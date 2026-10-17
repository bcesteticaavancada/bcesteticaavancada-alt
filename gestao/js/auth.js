import { createBcGestaoClient } from './supabase-client.js';

const VALID_ROLES = new Set(['admin', 'colaborador']);
let browserClient;

function getDefaultClient() {
  if (!browserClient) {
    const factory = globalThis.supabase?.createClient;
    browserClient = createBcGestaoClient(factory);
  }
  return browserClient;
}

function defaultRedirect(url) {
  if (globalThis.location?.replace) {
    globalThis.location.replace(url);
    return;
  }
  if (globalThis.location) globalThis.location.href = url;
}

function applyRolePresentation(profile) {
  if (typeof document === 'undefined' || profile?.role !== 'colaborador') return;
  const isChief = profile?.pode_gerenciar_agendas === true;
  const roleLabel = document.getElementById('profileRole');
  if (roleLabel) roleLabel.textContent = isChief ? 'Colaboradora Chefe' : 'Colaboradora';
  document.documentElement?.setAttribute?.('data-agenda-manager', isChief ? 'true' : 'false');
}

export async function getCurrentProfile(client = getDefaultClient()) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const user = data?.session?.user;
  if (!user?.id) return null;
  const { data: profile, error: profileError } = await client
    .from('staff_profiles')
    .select('user_id,display_name,role,active,pode_gerenciar_agendas,pode_gerenciar_procedimentos')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.user_id !== user.id || profile.active !== true || !VALID_ROLES.has(profile.role)) return null;
  return profile;
}

async function bootstrapRoleFeatures({ client, profile }) {
  if (typeof document === 'undefined') return;
  if (profile?.role !== 'admin' && profile?.pode_gerenciar_procedimentos !== true) return;
  try {
    const { initProcedurePanel } = await import('./procedure-panel.js');
    await initProcedurePanel({ client, profile, root: document });
  } catch (error) {
    console.warn?.('BC Gestão: Biblioteca Clínica não pôde ser inicializada.', error?.message || 'erro');
  }
}

export async function signIn(email, password, client = getDefaultClient()) {
  const cleanEmail = String(email ?? '').trim();
  if (!cleanEmail || !password) throw new Error('Informe e-mail e senha.');
  const { error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
  if (error) throw new Error('E-mail ou senha inválidos.');
  try {
    const profile = await getCurrentProfile(client);
    if (!profile) throw new Error('Conta sem acesso ao BC Gestão.');
    return profile;
  } catch (error) {
    await client.auth.signOut().catch?.(() => {});
    if (error?.message === 'Conta sem acesso ao BC Gestão.') throw error;
    throw new Error('Não foi possível validar o acesso ao BC Gestão.');
  }
}

export async function requestPasswordReset(email, redirectTo, client = getDefaultClient()) {
  const cleanEmail = String(email ?? '').trim();
  const cleanRedirect = String(redirectTo ?? '').trim();
  if (!cleanEmail) throw new Error('Informe seu e-mail.');
  if (!cleanRedirect) throw new Error('Destino de recuperação inválido.');
  const { error } = await client.auth.resetPasswordForEmail(cleanEmail, { redirectTo: cleanRedirect });
  if (error) throw new Error('Não foi possível enviar o e-mail de recuperação agora.');
  return true;
}

export async function updatePassword(password, client = getDefaultClient()) {
  const cleanPassword = String(password ?? '');
  if (cleanPassword.length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
  const { data, error } = await client.auth.updateUser({ password: cleanPassword });
  if (error) throw new Error('Não foi possível atualizar a senha. Solicite um novo link e tente novamente.');
  return data?.user ?? true;
}

export async function signOut(client = getDefaultClient()) {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function requireRole(role, client = getDefaultClient(), redirect = defaultRedirect) {
  const expectedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
  let profile = null;
  if (VALID_ROLES.has(expectedRole)) {
    try { profile = await getCurrentProfile(client); } catch { profile = null; }
  }
  if (!profile || profile.role !== expectedRole) {
    try { await client.auth.signOut(); } catch {}
    redirect('../login/');
    return null;
  }
  applyRolePresentation(profile);
  await bootstrapRoleFeatures({ client, profile });
  return profile;
}
