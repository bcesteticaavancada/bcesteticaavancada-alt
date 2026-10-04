export function normalizeCpf(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 11);
}

export function formatCpf(value) {
  const digits = normalizeCpf(value);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function checkDigit(digits, factor) {
  let sum = 0;
  for (let index = 0; index < factor - 1; index += 1) {
    sum += Number(digits[index]) * (factor - index);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(value) {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const first = checkDigit(digits, 10);
  if (first !== Number(digits[9])) return false;
  const second = checkDigit(digits, 11);
  return second === Number(digits[10]);
}
