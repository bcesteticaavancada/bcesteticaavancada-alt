import { deepStrictEqual as eq, ok, rejects } from "node:assert/strict";
import { Buffer } from "node:buffer";
import {
  createBackupHandler,
  type Source,
  type StorageItem,
} from "./worker.ts";
import { restoreBytes } from "./restore.ts";

const ROOT = "folder_root_12345",
  CLINICAL = "folder_clinical_12345",
  CLIENT = "folder_client_12345",
  MANIFEST = "folder_manifest_12345";
const PREFIX = "homologacao/drive-backup/",
  PATH = PREFIX + "documentos/cliente-ficticio/ficha.pdf";
const enc = new TextEncoder();
type Stored = {
  id: string;
  name: string;
  parents: string[];
  appProperties: Record<string, string>;
  size: string;
  sha256Checksum: string;
  bytes: Uint8Array;
};
const digest = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");

function fixture(options: Record<string, boolean> = {}) {
  const files = new Map<
    string,
    { bytes: Uint8Array; updatedAt: string; mime: string }
  >([[PATH, {
    bytes: enc.encode("DOCUMENTO FICTICIO A"),
    updatedAt: "2026-10-23T10:00:00Z",
    mime: "application/pdf",
  }]]);
  const remote = new Map<string, Stored>(),
    requests: string[] = [],
    reads: string[] = [],
    prefixes: string[] = [];
  let count = 0,
    manifestFailed = false,
    ackFailed = false,
    uploadResponseLost = false;
  const env: Record<string, string> = {
    BC_DRIVE_BACKUP_RUN_SECRET: "f".repeat(64),
    BC_DRIVE_BACKUP_ENABLE_WRITES: "true",
    BC_DRIVE_BACKUP_SCOPE: "test",
    BC_DRIVE_CLIENT_ID: "fictitious-client",
    BC_DRIVE_CLIENT_SECRET: "fictitious-secret",
    BC_DRIVE_REFRESH_TOKEN: "fictitious-refresh",
    BC_DRIVE_ALLOWED_ACCOUNTS: "decolarbh@gmail.com,mluisafdeassis@gmail.com",
    BC_DRIVE_FOLDER_ROOT: ROOT,
    BC_DRIVE_FOLDER_CLINICAL: CLINICAL,
    BC_DRIVE_FOLDER_CLIENT: CLIENT,
    BC_DRIVE_FOLDER_MANIFEST: MANIFEST,
  };
  const source: Source = {
    async list(prefix, { offset, limit }) {
      prefixes.push(prefix);
      const nodes = new Map<string, StorageItem>();
      for (const [path, f] of files) {
        const base = prefix ? prefix + "/" : "";
        if (!path.startsWith(base)) continue;
        const rest = path.slice(base.length), slash = rest.indexOf("/");
        if (slash >= 0) {
          const name = rest.slice(0, slash);
          nodes.set(name, { name, id: null });
        } else {nodes.set(rest, {
            name: rest,
            id: "fake",
            updated_at: f.updatedAt,
            metadata: { size: f.bytes.length, mimetype: f.mime },
          });}
      }
      return [...nodes.values()].sort((a, b) => a.name.localeCompare(b.name))
        .slice(offset, offset + limit);
    },
    async read(path) {
      reads.push(path);
      const f = files.get(path);
      if (!f) throw Error("SOURCE_SECRET_ERROR");
      return f.bytes.slice();
    },
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)), method = init?.method || "GET";
    requests.push(method + " " + url.pathname);
    if (url.hostname === "oauth2.googleapis.com") {
      return json({
        access_token: "fictitious-access",
        token_type: "Bearer",
        scope: options.broadScope
          ? "https://www.googleapis.com/auth/drive"
          : "https://www.googleapis.com/auth/drive.file",
      });
    }
    const id = url.pathname.split("/").at(-1)!;
    if (method === "GET" && [ROOT, CLINICAL, CLIENT, MANIFEST].includes(id)) {
      return json({
        id,
        mimeType: "application/vnd.google-apps.folder",
        trashed: false,
        parents: id === ROOT
          ? ["my-drive-root"]
          : [options.wrongParent ? "other-root" : ROOT],
        capabilities: { canAddChildren: true },
        owners: [{
          emailAddress: options.wrongOwner
            ? "other@example.invalid"
            : "decolarbh@gmail.com",
        }],
        permissions: options.missingPermissions ? undefined : [
          {
            type: "user",
            role: "owner",
            emailAddress: "decolarbh@gmail.com",
          },
          ...(options.publicFolder ? [{ type: "anyone", role: "reader" }] : []),
          ...(options.shareWithMel
            ? [{
              type: "user",
              role: "writer",
              emailAddress: "mluisafdeassis@gmail.com",
            }]
            : []),
          ...(options.thirdParty
            ? [{
              type: "user",
              role: "reader",
              emailAddress: "unapproved@example.invalid",
            }]
            : []),
        ],
      });
    }
    if (method === "GET" && id === "files") {
      const folder = (url.searchParams.get("q") || "").match(
        /'([^']+)' in parents/,
      )?.[1];
      const rows = [...remote.values()].filter((f) =>
        f.parents.includes(folder || "")
      );
      const offset = Number(url.searchParams.get("pageToken") || 0),
        limit = 100;
      return json({
        incompleteSearch: options.incompleteSearch || false,
        files: rows.slice(offset, offset + limit).map((
          { bytes: _, ...metadata },
        ) => metadata),
        ...(offset + limit < rows.length
          ? { nextPageToken: String(offset + limit) }
          : {}),
      });
    }
    if (method === "POST" && url.pathname.includes("/upload/")) {
      const blob = init!.body as Blob,
        boundary = blob.type.split("boundary=")[1],
        body = Buffer.from(await blob.arrayBuffer());
      const metaStart = body.indexOf("\r\n\r\n") + 4,
        metaEnd = body.indexOf("\r\n--" + boundary, metaStart),
        meta = JSON.parse(body.subarray(metaStart, metaEnd).toString());
      const bytesStart = body.indexOf("\r\n\r\n", metaEnd + 4) + 4,
        bytesEnd = body.indexOf("\r\n--" + boundary + "--", bytesStart),
        bytes = new Uint8Array(body.subarray(bytesStart, bytesEnd));
      const isManifest = meta.parents.includes(MANIFEST);
      if (options.failManifestOnce && isManifest && !manifestFailed) {
        manifestFailed = true;
        return json({}, 503);
      }
      const file: Stored = {
        ...meta,
        id: "remote_file_" + (++count),
        size: String(bytes.length),
        sha256Checksum: await digest(bytes),
        bytes,
      };
      remote.set(file.id, file);
      if (options.loseUploadResponseOnce && !uploadResponseLost) {
        uploadResponseLost = true;
        throw Error("fake secret patient-name network error");
      }
      return json({
        ...file,
        bytes: undefined,
        sha256Checksum: options.badChecksum
          ? "0".repeat(64)
          : file.sha256Checksum,
      });
    }
    if (method === "PATCH" && remote.has(id)) {
      if (options.failAckOnce && !ackFailed) {
        ackFailed = true;
        return json({}, 503);
      }
      const changes = JSON.parse(String(init?.body)), file = remote.get(id)!;
      Object.assign(file.appProperties, changes.appProperties);
      return json({ ...file, bytes: undefined });
    }
    if (method === "GET" && remote.has(id)) {
      const file = remote.get(id)!;
      if (options.failManifestRead && file.parents.includes(MANIFEST)) {
        return json({}, 503);
      }
      return url.searchParams.get("alt") === "media"
        ? new Response(new Uint8Array(file.bytes))
        : json({ ...file, bytes: undefined });
    }
    throw Error("Unexpected test request: " + method + " " + url.pathname);
  };
  const handler = createBackupHandler({
    env: (name) => env[name],
    source: () => source,
    fetch: fetcher,
  });
  const run = async (secret = env.BC_DRIVE_BACKUP_RUN_SECRET) => {
    const response = await handler(
      new Request("https://worker.invalid", {
        method: "POST",
        headers: { "x-bc-backup-secret": secret },
      }),
    );
    return { status: response.status, body: await response.json() };
  };
  return {
    env,
    files,
    remote,
    requests,
    reads,
    prefixes,
    source,
    handler,
    run,
    data: () =>
      [...remote.values()].filter((f) => !f.parents.includes(MANIFEST)),
    manifests: () =>
      [...remote.values()].filter((f) => f.parents.includes(MANIFEST)),
  };
}

const trusted = (f: ReturnType<typeof fixture>) => ({
  manifestSha256: f.data()[0].appProperties.bcManifestSha256,
  sourceKey: f.data()[0].appProperties.bcSourceKey,
});

Deno.test("unauthorized job does not list or transfer anything", async () => {
  const f = fixture();
  eq((await f.run("wrong")).status, 401);
  eq(f.prefixes, []);
  eq(f.requests, []);
});
Deno.test("inspection never obtains OAuth or reads source contents", async () => {
  const f = fixture();
  f.env.BC_DRIVE_BACKUP_ENABLE_WRITES = "false";
  const r = await f.run();
  eq(r.status, 200);
  eq(r.body.dryRun, true);
  eq(f.reads, []);
  eq(f.requests, []);
});
Deno.test("clinical production scope remains disabled before a distributed lock and approval", async () => {
  const f = fixture();
  f.env.BC_DRIVE_BACKUP_SCOPE = "clinical";
  eq((await f.run()).status, 503);
  eq(f.reads, []);
  eq(f.requests, []);
});
for (
  const flag of [
    "publicFolder",
    "missingPermissions",
    "wrongOwner",
    "wrongParent",
    "broadScope",
  ]
) {
  Deno.test(
    "fail closed for unsafe destination or authorization: " + flag,
    async () => {
      const f = fixture({ [flag]: true });
      eq((await f.run()).status, 503);
      eq(f.data().length, 0);
      eq(f.reads, []);
    },
  );
}
Deno.test("fictitious document gets a checksum verified object and a restore manifest", async () => {
  const f = fixture(), r = await f.run();
  eq(r.status, 200);
  eq(r.body.uploaded, 1);
  eq(f.data().length, 1);
  eq(f.manifests().length, 1);
  ok(!f.data()[0].name.includes("cliente-ficticio"));
  const restored = await restoreBytes(
    f.manifests()[0].bytes,
    f.data()[0].bytes,
    trusted(f),
  );
  eq(restored.path, PATH);
  eq(restored.bytes, enc.encode("DOCUMENTO FICTICIO A"));
});
Deno.test("repeating a successful run does not create copies or read contents again", async () => {
  const f = fixture();
  await f.run();
  f.reads.length = 0;
  eq((await f.run()).status, 200);
  eq(f.data().length, 1);
  eq(f.manifests().length, 1);
  eq(f.reads, []);
});
Deno.test("timestamp-only change reuses bytes and does not starve later files", async () => {
  const f = fixture();
  await f.run();
  f.files.get(PATH)!.updatedAt = "2026-10-23T11:00:00Z";
  const r = await f.run();
  eq(r.status, 200);
  eq(r.body.reused, 1);
  eq(f.data().length, 1);
  f.reads.length = 0;
  await f.run();
  eq(f.reads, []);
});
Deno.test("changed contents preserve the previous version", async () => {
  const f = fixture();
  await f.run();
  f.files.set(PATH, {
    bytes: enc.encode("DOCUMENTO FICTICIO B"),
    updatedAt: "2026-10-23T12:00:00Z",
    mime: "application/pdf",
  });
  eq((await f.run()).status, 200);
  eq(f.data().length, 2);
  eq(f.manifests().length, 2);
  eq(new TextDecoder().decode(f.data()[0].bytes), "DOCUMENTO FICTICIO A");
});
for (const flag of ["failManifestOnce", "failAckOnce"]) {
  Deno.test(
    "retry repairs interrupted backup without another object: " + flag,
    async () => {
      const f = fixture({ [flag]: true });
      eq((await f.run()).status, 503);
      eq(f.data().length, 1);
      eq((await f.run()).status, 200);
      eq(f.data().length, 1);
      eq(f.manifests().length, 1);
    },
  );
}
Deno.test("checksum echoed by appProperties is not accepted as content proof", async () => {
  const f = fixture({ badChecksum: true });
  eq((await f.run()).status, 503);
  eq(f.manifests().length, 0);
});
Deno.test("test mode never reads a real-prefix object and excludes financial names", async () => {
  const f = fixture();
  f.files.set("documentos/cliente-real-NAO-LER/ficha.pdf", {
    bytes: enc.encode("DO NOT READ"),
    updatedAt: "2026-10-23T10:00:00Z",
    mime: "application/pdf",
  });
  f.files.set(PREFIX + "documentos/financeiro/recibo.pdf", {
    bytes: enc.encode("DO NOT READ"),
    updatedAt: "2026-10-23T10:00:00Z",
    mime: "application/pdf",
  });
  await f.run();
  eq(f.reads, [PATH]);
});
Deno.test("oversized or unsupported source metadata prevents success and reads", async () => {
  const f = fixture();
  f.files.get(PATH)!.bytes = new Uint8Array(8 * 1024 * 1024 + 1);
  eq((await f.run()).status, 503);
  eq(f.reads, []);
});
Deno.test("restoration detects a corrupted object", async () => {
  const f = fixture();
  await f.run();
  await rejects(
    () =>
      restoreBytes(
        f.manifests()[0].bytes,
        enc.encode("CORROMPIDO"),
        trusted(f),
      ),
    /RESTORE_INTEGRITY_FAILED/,
  );
});
Deno.test("restoration rejects a forged original path", async () => {
  const f = fixture();
  await f.run();
  const m = JSON.parse(new TextDecoder().decode(f.manifests()[0].bytes));
  m.path = "../../financeiro/segredo.pdf";
  await rejects(() =>
    restoreBytes(enc.encode(JSON.stringify(m)), f.data()[0].bytes, trusted(f))
  );
});
Deno.test("binary payloads survive upload and restoration", async () => {
  const f = fixture();
  const bytes = new Uint8Array([137, 80, 78, 71, 0, 255, 128, 13, 10]);
  f.files.delete(PATH);
  const path = PREFIX + "assinaturas/ficticio/rubrica.png";
  f.files.set(path, {
    bytes,
    mime: "image/png",
    updatedAt: "2026-10-23T10:00:00Z",
  });
  eq((await f.run()).status, 200);
  const r = await restoreBytes(
    f.manifests()[0].bytes,
    f.data()[0].bytes,
    trusted(f),
  );
  eq(r.bytes, bytes);
});

Deno.test("unknown upload result is repaired without a duplicate and without leaking the error", async () => {
  const f = fixture({ loseUploadResponseOnce: true }), first = await f.run();
  eq(first.status, 503);
  ok(!JSON.stringify(first.body).includes("patient-name"));
  ok(!JSON.stringify(first.body).includes("fake secret"));
  eq(f.data().length, 1);
  eq((await f.run()).status, 200);
  eq(f.data().length, 1);
  eq(f.manifests().length, 1);
});
Deno.test("source pagination and batch limit preserve progress across runs", async () => {
  const f = fixture();
  f.files.clear();
  for (let i = 0; i < 101; i++) {
    f.files.set(
      PREFIX + "documentos/ficticio/ficha-" + String(i).padStart(3, "0") +
        ".pdf",
      {
        bytes: enc.encode("FICTICIO " + i),
        updatedAt: "2026-10-23T10:00:00Z",
        mime: "application/pdf",
      },
    );
  }
  const first = await f.run();
  eq(first.body.scanned, 101);
  eq(first.body.uploaded, 12);
  eq(first.body.remaining, 89);
  eq(first.body.complete, false);
  const second = await f.run();
  eq(second.body.uploaded, 12);
  eq(second.body.remaining, 77);
  eq(f.data().length, 24);
});
Deno.test("Drive pagination finds completed objects after the first page", async () => {
  const f = fixture();
  await f.run();
  const original = f.data()[0];
  f.remote.delete(original.id);
  for (let i = 0; i < 101; i++) {
    f.remote.set("unrelated_file_" + i, {
      ...original,
      id: "unrelated_file_" + i,
      appProperties: {},
    });
  }
  f.remote.set(original.id, original);
  f.reads.length = 0;
  const r = await f.run();
  eq(r.status, 200);
  eq(r.body.selected, 0);
  eq(f.reads, []);
});
Deno.test("source scan cap fails before obtaining OAuth or reading contents", async () => {
  const f = fixture();
  f.files.clear();
  for (let i = 0; i < 3001; i++) {
    f.files.set(PREFIX + "documentos/ficticio/ficha-" + i + ".pdf", {
      bytes: enc.encode("FICTICIO"),
      updatedAt: "2026-10-23T10:00:00Z",
      mime: "application/pdf",
    });
  }
  eq((await f.run()).status, 503);
  eq(f.requests, []);
  eq(f.reads, []);
});
Deno.test("inspection reports unsupported files instead of claiming success", async () => {
  const f = fixture();
  f.env.BC_DRIVE_BACKUP_ENABLE_WRITES = "false";
  f.files.get(PATH)!.mime = "application/zip";
  const r = await f.run();
  eq(r.status, 503);
  eq(r.body.ok, false);
  eq(r.body.unsupported, 1);
  eq(f.requests, []);
  eq(f.reads, []);
});

Deno.test("well-formed path substitution cannot redirect a restored object", async () => {
  const f = fixture();
  await f.run();
  const m = JSON.parse(new TextDecoder().decode(f.manifests()[0].bytes));
  m.path = PREFIX + "documentos/outro-ficticio/ficha.pdf";
  m.sourceKey = await digest(enc.encode(m.bucket + ":" + m.path));
  await rejects(
    () =>
      restoreBytes(
        enc.encode(JSON.stringify(m)),
        f.data()[0].bytes,
        trusted(f),
      ),
    /RESTORE_REFERENCE_MISMATCH/,
  );
});
Deno.test("a trusted manifest cannot be restored as a different expected source", async () => {
  const f = fixture();
  await f.run();
  await rejects(
    () =>
      restoreBytes(f.manifests()[0].bytes, f.data()[0].bytes, {
        ...trusted(f),
        sourceKey: "0".repeat(64),
      }),
    /RESTORE_REFERENCE_MISMATCH/,
  );
});
Deno.test("transient manifest read failure does not create a duplicate", async () => {
  const options = { failManifestRead: false }, f = fixture(options);
  await f.run();
  f.files.get(PATH)!.updatedAt = "2026-10-23T11:00:00Z";
  options.failManifestRead = true;
  eq((await f.run()).status, 503);
  eq(f.data().length, 1);
  eq(f.manifests().length, 1);
  options.failManifestRead = false;
  eq((await f.run()).status, 200);
  eq(f.manifests().length, 1);
});
Deno.test("approved owner and Mel sharing is preserved, while third-party sharing blocks", async () => {
  eq((await fixture({ shareWithMel: true }).run()).status, 200);
  const f = fixture({ shareWithMel: true, thirdParty: true });
  eq((await f.run()).status, 503);
  eq(f.reads, []);
});
Deno.test("incomplete Drive search cannot be treated as an empty successful inventory", async () => {
  const f = fixture({ incompleteSearch: true });
  eq((await f.run()).status, 503);
  eq(f.reads, []);
});
Deno.test("unknown source category stops the entire batch before a valid file is uploaded", async () => {
  const f = fixture();
  f.files.set(PREFIX + "desconhecido/ficha.pdf", {
    bytes: enc.encode("FICTICIO"),
    updatedAt: "2026-10-23T10:00:00Z",
    mime: "application/pdf",
  });
  eq((await f.run()).status, 503);
  eq(f.requests, []);
  eq(f.reads, []);
  eq(f.data().length, 0);
});
