import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export function createBcGestaoClient(createClient) {
  if (typeof createClient !== 'function') {
    throw new Error('Supabase SDK não disponível.');
  }

  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  if (typeof globalThis !== 'undefined') globalThis.__bcGestaoClient = client;
  if (typeof document !== 'undefined') {
    import('./clinical-folder-runtime.js')
      .then(({ installClinicalFolderRuntime }) => installClinicalFolderRuntime({ client, root: document }))
      .catch(() => {});
    import('./agenda-treatment-bridge.js')
      .then(({ installAgendaTreatmentBridge }) => installAgendaTreatmentBridge({ client, root: document }))
      .catch(() => {});
  }

  return client;
}