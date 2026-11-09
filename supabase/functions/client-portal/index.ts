import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createClientPortalHandler } from './handler.mjs';

Deno.serve(createClientPortalHandler({
  async getSchedule(token: string) {
    const url = Deno.env.get('SUPABASE_URL');
    const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
    const key: unknown = keys ? JSON.parse(keys)?.default : null;
    if (!url || typeof key !== 'string' || !key) throw new Error('Service unavailable');
    const service = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await service.rpc('bc_client_portal_schedule', { p_token: token });
    if (error) throw new Error('Schedule unavailable');
    return data;
  },
}));
