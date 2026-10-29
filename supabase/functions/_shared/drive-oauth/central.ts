import { FOLDERS, SetupError, checkFolder } from "./protocol.ts";

// Catalogue only: validating a folder never makes it a worker destination.
const DESTINATIONS = Object.freeze({
  maya: { name: "03_Site_Maya_e_Midias" },
  manifests: { name: "04_Manifestos_e_Relatorios_de_Backup" },
  database: { name: "05_BC_Gestao_Banco_de_Dados_e_Exportacoes" },
  code: { name: "06_Site_Codigo_Versoes_e_Publicacoes" },
  audit: { name: "07_Configuracoes_Auditoria_e_Restauracao" },
  finance: { name: "08_Financeiro_e_Contabilidade" },
  administration: { name: "09_Administracao_Contratos_e_Equipe" },
});
export type DriveReader = (resource: string) => Promise<Record<string, unknown>>;
function folderId(value: unknown): string {
  if (typeof value !== "string" || !/^[\w-]{3,200}$/.test(value)) throw new SetupError("invalid_folders");
  return value;
}
export async function privateFolder(read: DriveReader, id: string) {
  const safeId = folderId(id);
  const [meta, permissions] = await Promise.all([
    read("files/" + safeId + "?fields=id,name,parents,mimeType,trashed,driveId,owners(emailAddress),capabilities(canAddChildren)"),
    read("files/" + safeId + "/permissions?fields=nextPageToken,permissions(type,role,emailAddress,deleted,pendingOwner)&pageSize=100"),
  ]);
  checkFolder(meta, permissions, safeId);
  return meta;
}
async function centralRoot(read: DriveReader): Promise<string> {
  const anchors = await Promise.all(Object.values(FOLDERS).map(id => privateFolder(read, id)));
  const parents = anchors.map(meta => {
    if (!Array.isArray(meta.parents) || meta.parents.length !== 1) throw new SetupError("invalid_central_root");
    return folderId(meta.parents[0]);
  });
  if (parents[0] !== parents[1] || Object.values(FOLDERS).some(id => id === parents[0])) throw new SetupError("invalid_central_root");
  return parents[0];
}
export async function centralCatalogue(read: DriveReader) {
  // Parent IDs are metadata of the two already-approved folders. The root itself
  // must still be selected in Picker and inspected before any child is accepted.
  const root = await centralRoot(read);
  return { root_id: root, destinations: { root: { name: "Central privada", expected_id: root }, ...DESTINATIONS } };
}
export function checkCentralSelection(role: unknown, id: unknown): asserts role is "root" | keyof typeof DESTINATIONS {
  if (role !== "root" && (typeof role !== "string" || !Object.hasOwn(DESTINATIONS, role))) throw new SetupError("invalid_folders");
  folderId(id);
}
export async function inspectCentralFolder(read: DriveReader, role: unknown, id: unknown) {
  checkCentralSelection(role, id);
  const root = await centralRoot(read);
  const rootMeta = await privateFolder(read, root);
  if (role === "root") {
    if (id !== root) throw new SetupError("invalid_folders");
    return { verified: true, role, name: "Central privada", backup_enabled: false };
  }
  const meta = await privateFolder(read, folderId(id));
  if (meta.name !== DESTINATIONS[role].name || !Array.isArray(meta.parents) ||
    meta.parents.length !== 1 || meta.parents[0] !== root || rootMeta.id !== root) throw new SetupError("invalid_folders");
  return { verified: true, role, name: DESTINATIONS[role].name, backup_enabled: false };
}
