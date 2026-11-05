import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.93.3';
import webpush from 'npm:web-push@3.6.7';
import {createReturnReminderHandler} from './handler.mjs';
const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createReturnReminderHandler({service,sendNotification:(...args:Parameters<typeof webpush.sendNotification>)=>webpush.sendNotification(...args)}));
