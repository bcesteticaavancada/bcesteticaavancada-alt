function clean(value) {
  return String(value ?? '').trim();
}

export function normalizeCpf(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function formatCpf(value) {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return digits;
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function parseBirthDate(value) {
  const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

export function calculateAge(dataNascimento, referenceDate = new Date()) {
  const birth = parseBirthDate(dataNascimento);
  if (!birth || !(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) return null;

  const reference = {
    year: referenceDate.getFullYear(),
    month: referenceDate.getMonth() + 1,
    day: referenceDate.getDate(),
  };

  if (
    birth.year > reference.year
    || (birth.year === reference.year && birth.month > reference.month)
    || (birth.year === reference.year && birth.month === reference.month && birth.day > reference.day)
  ) return null;

  let age = reference.year - birth.year;
  if (reference.month < birth.month || (reference.month === birth.month && reference.day < birth.day)) {
    age -= 1;
  }
  return age;
}

export function isMinor(dataNascimento, referenceDate = new Date()) {
  const age = calculateAge(dataNascimento, referenceDate);
  return age !== null && age < 18;
}

export function clientProfileChecklist(client = {}) {
  const cadastroBasico = Boolean(
    clean(client.nome)
    && normalizeCpf(client.cpf).length === 11
    && parseBirthDate(client.data_nascimento)
    && clean(client.telefone),
  );
  const enderecoCompleto = Boolean(
    clean(client.cep)
    && clean(client.logradouro)
    && clean(client.numero)
    && clean(client.bairro)
    && clean(client.cidade)
    && clean(client.uf),
  );
  const fotoIdentificacao = Boolean(client.foto_identificacao_id || client.foto_atual_id || client.fotoAtualId);

  return {
    cadastroBasico,
    enderecoCompleto,
    fotoIdentificacao,
    anamnese: 'pendente',
  };
}
