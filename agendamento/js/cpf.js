export function normalizeCpf(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 11);
}

export function formatCpf(value) {
  const digits = normalizeCpf(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function checkDigit(base, factor) {
  let sum = 0;
  for (const digit of base) {
    sum += Number(digit) * factor;
    factor -= 1;
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const first = checkDigit(cpf.slice(0, 9), 10);
  if (first !== Number(cpf[9])) return false;
  const second = checkDigit(cpf.slice(0, 10), 11);
  return second === Number(cpf[10]);
}
