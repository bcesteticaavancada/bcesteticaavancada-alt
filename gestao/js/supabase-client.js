import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export function createBcGestaoClient(createClient) {
  if (typeof createClient !== 'function') {
    throw new Error('Supabase SDK não disponível.');
  }

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
