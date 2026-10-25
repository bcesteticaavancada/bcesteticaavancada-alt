// Internal scheduled worker; authorization is checked against a server-only Vault secret.
import { handler } from './runtime.ts';
Deno.serve(handler);
