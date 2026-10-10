export const ROLE_DESTINATIONS = Object.freeze({
  admin: '../admin/',
  colaborador: '../colaborador/',
});

export function destinationForRole(role) {
  if (typeof role !== 'string') return null;
  const normalized = role.trim().toLowerCase();
  return ROLE_DESTINATIONS[normalized] ?? null;
}

export function routeForRole(role) {
  return destinationForRole(role);
}
