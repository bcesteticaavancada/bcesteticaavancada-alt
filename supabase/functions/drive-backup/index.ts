import { createSource } from "./source.ts";
import { createBackupHandler } from "./worker.ts";

// Server-only draft. No browser endpoint, deployment, scheduler, or clinical scope.
Deno.serve(createBackupHandler({
  env: (name) => Deno.env.get(name),
  fetch,
  source: () =>
    createSource(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      fetch,
    ),
}));
