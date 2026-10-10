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

export async function getCurrentProfile(client = getDefaultClient()) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;

  const user = data?.session?.user;
  if (!user?.id) return null;

  const { data: profile, error: profileError } = await client
    .from('staff_profiles')
    .select('user_id,display_name,role,active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return null;
  if (profile.user_id !== user.id) return null;
  if (profile.active !== true) return null;
  if (!VALID_ROLES.has(profile.role)) return null;
  return profile;
}

export async function signIn(email, password, client = getDefaultClient()) {
  const cleanEmail = String(email ?? '').trim();
  if (!cleanEmail || !password) throw new Error('Informe e-mail e senha.');

  const { error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
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

export async function signOut(client = getDefaultClient()) {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function requireRole(role, client = getDefaultClient(), redirect = defaultRedirect) {
  const expectedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
  let profile = null;

  if (VALID_ROLES.has(expectedRole)) {
    try {
      profile = await getCurrentProfile(client);
    } catch {
      profile = null;
    }
  }

  if (!profile || profile.role !== expectedRole) {
    try {
      await client.auth.signOut();
    } catch {
      // Fail closed even when sign-out itself cannot be completed.
    }
    redirect('../login/');
    return null;
  }

  return profile;
}
