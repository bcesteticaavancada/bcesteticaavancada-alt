import { deepStrictEqual as eq, rejects, throws } from "node:assert/strict";
import { createSource } from "./source.ts";
import { readCapped } from "./drive.ts";

const prefix = "homologacao/drive-backup";
const path = prefix + "/documentos/ficticio/ficha.pdf";
const origin = "https://tpqsmerlxquyrzrjbogj.supabase.co";
const signal = () => AbortSignal.timeout(1000);

Deno.test("Storage adapter limits listing and download to fictional namespace", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const transport: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return init?.method === "POST"
      ? new Response(JSON.stringify([{ name: "documentos", id: null }]))
      : new Response(new Uint8Array([0, 128, 255]));
  };
  const source = createSource(origin, "server-fictitious-key", transport);
  eq(await source.list(prefix, { offset: 100, limit: 100 }, signal()), [{
    name: "documentos",
    id: null,
  }]);
  eq(JSON.parse(String(calls[0].init?.body)), {
    prefix,
    offset: 100,
    limit: 100,
    sortBy: { column: "name", order: "asc" },
  });
  eq(calls[0].url, origin + "/storage/v1/object/list/bc-prontuario-private");
  eq(await source.read(path, 8, signal()), new Uint8Array([0, 128, 255]));
  eq(
    calls[1].url,
    origin + "/storage/v1/object/authenticated/bc-prontuario-private/" + path,
  );
  eq(
    new Headers(calls[1].init?.headers).get("Authorization"),
    "Bearer server-fictitious-key",
  );
  eq(calls[1].init?.redirect, "error");
  await rejects(() =>
    source.list("documentos", { offset: 0, limit: 100 }, signal())
  );
  await rejects(() => source.read("documentos/real.pdf", 8, signal()));
  await rejects(() =>
    source.read(prefix + "/documentos/../real.pdf", 8, signal())
  );
  eq(calls.length, 2);
});

Deno.test("Storage credentials cannot be sent to another project or a redirect", () => {
  const transport: typeof fetch = () => {
    throw Error("MUST_NOT_CALL");
  };
  for (
    const url of [
      "https://other.supabase.co",
      origin + "/foreign",
      origin + "?secret=x",
      "http://tpqsmerlxquyrzrjbogj.supabase.co",
    ]
  ) {
    throws(() => createSource(url, "server-fictitious-key", transport));
  }
});

Deno.test("Storage failure responses do not expose server keys or patient names", async () => {
  const source = createSource(
    origin,
    "server-fictitious-key",
    async () =>
      new Response("patient-name server-fictitious-key", { status: 403 }),
  );
  await rejects(
    () => source.read(path, 8, signal()),
    /^Error: SOURCE_HTTP_403$/,
  );
});

Deno.test("bounded reader cancels declared and chunked oversized bodies", async () => {
  let cancelled = 0;
  const body = () =>
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(9));
      },
      cancel() {
        cancelled++;
      },
    });
  await rejects(
    () =>
      readCapped(
        new Response(body(), { headers: { "Content-Length": "9" } }),
        8,
      ),
    /BODY_TOO_LARGE/,
  );
  await rejects(() => readCapped(new Response(body()), 8), /BODY_TOO_LARGE/);
  eq(cancelled, 2);
});
