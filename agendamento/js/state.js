export const DRAFT_KEY = 'bc.preAnamnese.draft.v1';
export const DRAFT_TTL_MS = 30 * 60 * 1000;
const TOKEN_KEY = 'bc.preAnamnese.submissionToken.v1';

export function prepareSessionStorage(view) {
  try { view.localStorage?.removeItem(DRAFT_KEY); view.localStorage?.removeItem(TOKEN_KEY); } catch { /* Browser can deny storage. */ }
  const memory = new Map();
  let session;
  try { session = view.sessionStorage; session?.setItem('bc.storage.probe', '1'); session?.removeItem('bc.storage.probe'); } catch { session = null; }
  return {
    getItem(key) { try { return session?.getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; } },
    setItem(key, value) { memory.set(key, String(value)); try { session?.setItem(key, String(value)); } catch { /* Keep page usable in memory. */ } },
    removeItem(key) { memory.delete(key); try { session?.removeItem(key); } catch { /* Already unavailable. */ } },
  };
}

export function createInitialState() {
  return { step: 1, values: {} };
}

export function stripSensitiveDraftValues(values) {
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const { cpf: _cpf, ...safeValues } = source;
  return safeValues;
}

export function loadDraft(storage, now = Date.now()) {
  try {
    const raw = storage?.getItem?.(DRAFT_KEY);
    if (!raw) { storage?.removeItem?.(TOKEN_KEY); return createInitialState(); }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now) {
      clearDraft(storage); storage?.removeItem?.(TOKEN_KEY); return createInitialState();
    }
    if (!Number.isInteger(parsed.step) || parsed.step < 1) return createInitialState();
    if (!parsed.values || typeof parsed.values !== 'object' || Array.isArray(parsed.values)) return createInitialState();
    return { step: parsed.step, values: stripSensitiveDraftValues(parsed.values) };
  } catch {
    return createInitialState();
  }
}

export function saveDraft(storage, state, now = Date.now()) {
  const safeState = {
    ...(state && typeof state === 'object' ? state : createInitialState()),
    values: stripSensitiveDraftValues(state?.values),
    expiresAt: now + DRAFT_TTL_MS,
  };
  storage?.setItem?.(DRAFT_KEY, JSON.stringify(safeState));
}

export function clearDraft(storage) {
  storage?.removeItem?.(DRAFT_KEY);
}

export function serializeForm(formElement) {
  const out = {};
  const checkboxGroups = new Map();
  const elements = Array.from(formElement?.elements ?? []);

  for (const element of elements) {
    if (!element || element.disabled) continue;
    const type = String(element.type || '').toLowerCase();
    if (['button', 'submit', 'reset', 'file'].includes(type)) continue;

    const key = element.name || element.id;
    if (!key) continue;

    if (type === 'radio') {
      if (element.checked) out[key] = element.value;
      continue;
    }

    if (type === 'checkbox') {
      if (element.name) {
        if (!checkboxGroups.has(key)) checkboxGroups.set(key, []);
        if (element.checked) checkboxGroups.get(key).push(element.value);
      } else {
        out[key] = Boolean(element.checked);
      }
      continue;
    }

    const value = typeof element.value === 'string' ? element.value.trim() : element.value;
    out[key] = value ?? '';
  }

  for (const [key, values] of checkboxGroups) out[key] = values;
  return out;
}
