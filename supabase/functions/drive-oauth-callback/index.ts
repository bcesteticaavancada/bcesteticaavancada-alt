import { serve } from "../_shared/drive-oauth/runtime.ts";
Deno.serve(serve("callback"));
