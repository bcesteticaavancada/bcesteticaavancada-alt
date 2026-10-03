export const DRAFT_KEY = 'bc.preAnamnese.draft.v1';

export function createInitialState() {
  return { step: 1, values: {} };
}

export function loadDraft(storage) {
  try {
    const raw = storage?.getItem?.(DRAFT_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return createInitialState();
    if (!Number.isInteger(parsed.step) || parsed.step < 1) return createInitialState();
    if (!parsed.values || typeof parsed.values !== 'object' || Array.isArray(parsed.values)) return createInitialState();
    return parsed;
  } catch {
    return createInitialState();
  }
}

export function saveDraft(storage, state) {
  storage?.setItem?.(DRAFT_KEY, JSON.stringify(state));
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
