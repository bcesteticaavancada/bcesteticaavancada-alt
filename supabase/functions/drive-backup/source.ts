import { allowedPath, BUCKET, PROJECT_ID, TEST_PREFIX } from "./core.ts";
import { readCapped } from "./drive.ts";
import type { Source, StorageItem } from "./worker.ts";

// Direct Storage REST requests keep both headers and response streams under control.
export function createSource(
  origin: string,
  key: string,
  transport: typeof fetch,
): Source {
  if (origin !== "https://" + PROJECT_ID + ".supabase.co" || !key.trim()) {
    throw Error("SOURCE_CONFIG_INVALID");
  }
  const headers = { Authorization: "Bearer " + key, apikey: key };
  const safePrefix = (prefix: string) =>
    (prefix === TEST_PREFIX.slice(0, -1) || prefix.startsWith(TEST_PREFIX)) &&
    !/[\\%\x00-\x1f?#]/.test(prefix) &&
    !prefix.split("/").some((part) => !part || part === "." || part === "..");
  async function request(
    path: string,
    signal: AbortSignal,
    init: RequestInit = {},
  ) {
    let response: Response;
    try {
      response = await transport(origin + "/storage/v1/" + path, {
        ...init,
        headers: { ...headers, ...init.headers },
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
    } catch {
      throw Error("SOURCE_TRANSPORT_FAILED");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw Error("SOURCE_HTTP_" + response.status);
    }
    return response;
  }
  return {
    async list(prefix, { offset, limit }, signal) {
      if (
        !safePrefix(prefix) || !Number.isSafeInteger(offset) || offset < 0 ||
        limit !== 100
      ) {
        throw Error("SOURCE_LIST_INVALID");
      }
      const response = await request("object/list/" + BUCKET, signal, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          offset,
          limit,
          sortBy: { column: "name", order: "asc" },
        }),
      });
      const raw = await readCapped(response, 256 * 1024);
      const items: StorageItem[] = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(raw),
      );
      if (!Array.isArray(items) || items.length > limit) {
        throw Error("SOURCE_LIST_INVALID");
      }
      return items;
    },
    async read(path, maxBytes, signal) {
      if (!path.startsWith(TEST_PREFIX) || !allowedPath(path)) {
        throw Error("SOURCE_PATH_INVALID");
      }
      const encoded = path.split("/").map(encodeURIComponent).join("/");
      return await readCapped(
        await request("object/authenticated/" + BUCKET + "/" + encoded, signal),
        maxBytes,
      );
    },
  };
}
