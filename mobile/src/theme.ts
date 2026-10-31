// Paleta da versão mobile: hierarquia editorial do site BC,
// com acentos rose gold aprováveis separadamente da identidade web.
export const siteIdentity = {
  paper: '#FCFAF8',
  cream: '#F2E9DF',
  dark: '#171310',
  ink: '#211B18',
  muted: '#756C66',
  line: '#D8CEC4',
  roseGold: '#B68682',
  champagne: '#D7B6A8',
} as const;

export const colors = {
  background: siteIdentity.paper,
  surface: '#FFFDFB',
  ink: siteIdentity.ink,
  muted: siteIdentity.muted,
  rose: siteIdentity.roseGold,
  roseDeep: '#6C4745',
  blush: siteIdentity.cream,
  gold: '#B58E7C',
  line: siteIdentity.line,
  success: '#39745B',
  warning: '#8B5E25',
} as const;

export const shadow = {
  shadowColor: '#171417',
  shadowOpacity: 0.11,
  shadowOffset: { width: 0, height: 5 },
  shadowRadius: 13,
  elevation: 3,
} as const;
