import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../js/config.js';
import { createDriveSetup } from './setup.js';

// Use only Auth: the regular client factory also initializes clinical modules.
try {
  const client = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const controller = createDriveSetup({ root: document, auth: client.auth,
    returnStatus: new URLSearchParams(globalThis.location.search).get('status') || '' });
  await controller.init();
} catch {
  document.querySelector('#setupStatus').textContent = 'Não foi possível abrir esta configuração. Tente novamente mais tarde.';
}
