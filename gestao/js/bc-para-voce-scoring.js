// Proposta comercial para homologação: 1 Ponto BC por R$ 1 do valor-base.
// A recomendação não concede pontos automaticamente; a Mel aprova cada regra.
export const BC_LEVELS = Object.freeze([
  { key: 'adesao', name: 'Em adesão', threshold: 0 },
  { key: 'bronze', name: 'Bronze', threshold: 1000 },
  { key: 'prata', name: 'Prata', threshold: 2000 },
  { key: 'ouro', name: 'Ouro', threshold: 4000 },
  { key: 'perola', name: 'Pérola', threshold: 6000 },
  { key: 'diamante', name: 'Diamante', threshold: 10000 },
]);

export function suggestBCPoints(version = {}) {
  const raw = version?.base_price;
  if (raw === null || raw === undefined || raw === '') return null;
  const price = Number(raw);
  if (!Number.isFinite(price) || price <= 0) return null;
  const points = Math.round(price);
  if (points < 1 || points > 100000) return null;
  return { price, points, isStartingAt: version.price_mode === 'starting_at' };
}

export function rankBCProcedures(procedures = []) {
  return procedures.filter((procedure) => !procedure.archived_at).map((procedure) => {
    // A regra é aplicada à biblioteca publicada; o rascunho é apenas fallback.
    const version = procedure.current_version || procedure.draft_version || {};
    return { id: procedure.id, name: procedure.nome || version.nome || 'Procedimento', suggestion: suggestBCPoints(version) };
  }).sort((a, b) => {
    if (!a.suggestion) return b.suggestion ? 1 : a.name.localeCompare(b.name, 'pt-BR');
    if (!b.suggestion) return -1;
    return a.suggestion.price - b.suggestion.price || a.name.localeCompare(b.name, 'pt-BR');
  });
}
