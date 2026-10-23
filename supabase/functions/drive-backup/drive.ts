import { isPrivatePermissionSet, sha256Hex } from "./core.ts";

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";
export type Artifact = {
  id: string;
  name?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  size?: string;
  sha256Checksum?: string;
};
export async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    await response.body?.cancel();
    throw Error("BODY_TOO_LARGE");
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error("BODY_MISSING");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw Error("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function readJson(response: Response, maxBytes = 512 * 1024) {
  const raw = await readCapped(response, maxBytes);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
}
export class Drive {
  constructor(
    private token: string,
    private transport: typeof fetch,
    private signal: AbortSignal,
  ) {}
  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Authorization", "Bearer " + this.token);
    let response: Response;
    try {
      response = await this.transport(url, {
        ...options,
        headers,
        redirect: "error",
        signal: AbortSignal.any([this.signal, AbortSignal.timeout(15000)]),
      });
    } catch {
      throw Error("DRIVE_TRANSPORT_FAILED");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw Error("DRIVE_HTTP_" + response.status);
    }
    return response;
  }
  async privateFolder(
    id: string,
    owner: string,
    parent?: string,
    allowedAccounts = new Set([owner]),
  ): Promise<void> {
    if (!/^[-\w]{12,120}$/.test(id)) throw Error("FOLDER_ID_INVALID");
    const r = await this.request(
      API + "/" + encodeURIComponent(id) +
        "?fields=id,mimeType,trashed,parents,owners(emailAddress),permissions(type,role,emailAddress),capabilities(canAddChildren)",
    );
    const f = await readJson(r);
    if (
      f.id !== id || f.trashed || f.mimeType !== FOLDER ||
      f.capabilities?.canAddChildren !== true || !Array.isArray(f.owners) ||
      f.owners.length !== 1 ||
      f.owners[0]?.emailAddress?.toLowerCase() !== owner ||
      !Array.isArray(f.permissions) ||
      !isPrivatePermissionSet(f.permissions, allowedAccounts) ||
      parent &&
        (!Array.isArray(f.parents) || f.parents.length !== 1 ||
          f.parents[0] !== parent)
    ) throw Error("DESTINATION_NOT_PRIVATE");
  }
  async list(folder: string): Promise<Artifact[]> {
    const result: Artifact[] = [], pages = new Set<string>();
    let page = "";
    do {
      if (pages.has(page)) throw Error("DRIVE_PAGINATION_LOOP");
      pages.add(page);
      const params = new URLSearchParams({
        q: "'" + folder + "' in parents and trashed = false",
        pageSize: "100",
        fields:
          "nextPageToken,incompleteSearch,files(id,name,parents,appProperties,size,sha256Checksum)",
      });
      if (page) params.set("pageToken", page);
      const json = await readJson(await this.request(API + "?" + params));
      if (json.incompleteSearch) throw Error("DRIVE_SEARCH_INCOMPLETE");
      if (!Array.isArray(json.files)) throw Error("DRIVE_LIST_INVALID");
      for (const file of json.files) {
        if (!file.id || !/^[-\w]{8,120}$/.test(file.id)) {
          throw Error("DRIVE_FILE_INVALID");
        }
        result.push(file);
      }
      if (result.length > 12000 || pages.size > 120) {
        throw Error("DRIVE_SCAN_CAP");
      }
      page = String(json.nextPageToken || "");
    } while (page);
    return result;
  }
  async upload(
    folder: string,
    name: string,
    bytes: Uint8Array,
    mime: string,
    properties: Record<string, string>,
  ): Promise<Artifact> {
    const hash = await sha256Hex(bytes),
      boundary = "bcbackup" + crypto.randomUUID().replaceAll("-", "");
    const metadata = { name, parents: [folder], appProperties: properties };
    const prefix = "--" + boundary +
      "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) + "\r\n--" + boundary + "\r\nContent-Type: " +
      mime + "\r\n\r\n";
    const owned = new Uint8Array(bytes.length);
    owned.set(bytes);
    const body = new Blob([prefix, owned, "\r\n--" + boundary + "--\r\n"], {
      type: "multipart/related; boundary=" + boundary,
    });
    const r = await this.request(
      UPLOAD +
        "?uploadType=multipart&fields=id,size,sha256Checksum,appProperties,parents",
      { method: "POST", body, headers: { "Content-Type": body.type } },
    );
    const file: Artifact = await readJson(r);
    if (
      !file.id || !/^[-\w]{8,120}$/.test(file.id) ||
      Number(file.size) !== bytes.length || file.sha256Checksum !== hash ||
      file.parents?.length !== 1 || file.parents[0] !== folder
    ) throw Error("REMOTE_CHECKSUM_FAILED");
    return file;
  }
  async read(id: string, maxBytes: number) {
    return await readCapped(
      await this.request(API + "/" + encodeURIComponent(id) + "?alt=media"),
      maxBytes,
    );
  }
  async acknowledge(id: string, properties: Record<string, string>) {
    const response = await this.request(
      API + "/" + encodeURIComponent(id) + "?fields=id",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appProperties: properties }),
      },
    );
    await response.body?.cancel();
  }
}
