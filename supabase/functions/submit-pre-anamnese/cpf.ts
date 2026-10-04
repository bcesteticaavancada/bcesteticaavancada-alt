export function normalizeCpf(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 11);
}

function cpfCheckDigit(digits: string, factor: number): number {
  let sum = 0;
  for (let index = 0; index < factor - 1; index += 1) {
    sum += Number(digits[index]) * (factor - index);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(value: unknown): boolean {
  const digits = normalizeCpf(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  if (cpfCheckDigit(digits, 10) !== Number(digits[9])) return false;
  return cpfCheckDigit(digits, 11) === Number(digits[10]);
}
