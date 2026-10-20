import {notifyAppChange,isMutationRpc} from './live-refresh.js';
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

  if(typeof client.rpc==='function'){
    const rpc=client.rpc.bind(client);
    client.rpc=async(name,...args)=>{const result=await rpc(name,...args);if(!result?.error && isMutationRpc(name))notifyAppChange();return result;};
  }

  if (typeof globalThis !== 'undefined') globalThis.__bcGestaoClient = client;
  if (typeof document !== 'undefined') {
    import('./clinical-folder-runtime.js')
      .then(({ installClinicalFolderRuntime }) => installClinicalFolderRuntime({ client, root: document }))
      .catch(() => {});
    import('./clinical-document-generation-runtime.js')
      .then(({ installClinicalDocumentGenerationRuntime }) => installClinicalDocumentGenerationRuntime({ client, root: document }))
      .catch(() => {});
    import('./agenda-treatment-bridge.js')
      .then(({ installAgendaTreatmentBridge }) => installAgendaTreatmentBridge({ client, root: document }))
      .catch(() => {});
  }

  return client;
}