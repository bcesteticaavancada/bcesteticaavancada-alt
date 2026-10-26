import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from '@supabase/supabase-js';
import {createSupportHandler} from './handler.mjs';

Deno.serve(createSupportHandler({makeClients:({authorization}:{authorization:string})=>{
  const url=Deno.env.get('SUPABASE_URL')!;
  const key=Deno.env.get('SUPABASE_ANON_KEY')!;
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if(!url||!key||!secret)throw new Error('Service unavailable');
  const auth={persistSession:false,autoRefreshToken:false};
  return {caller:createClient(url,key,{auth,global:{headers:{Authorization:authorization}}}),service:createClient(url,secret,{auth})};
}}));
