export const PDF_DOCUMENT_TITLE = 'Pré-Avaliação Estética Individualizada';

export type PdfSpan = 1 | 2 | 3;

export type PdfField = {
  key: string;
  label: string;
  displayValue: string;
  span: PdfSpan;
  importance?: 'normal' | 'critical';
};

export type PdfSection = {
  title: string;
  fields: PdfField[];
};

export type PdfContentInput = {
  patient: {
    name: string;
    cpf?: string;
    birthDate?: string;
    age?: number;
    phone: string;
    email?: string;
  };
  procedure: string;
  answers: Record<string, unknown>;
  consents: Record<string, unknown>;
};

export function sanitizePdfText(value: unknown): string {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—―]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  return Array.from(normalized, (ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    return ch === '\n' || ch === '\r' || (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) ? ch : '?';
  }).join('');
}

export function humanLabel(key: string): string {
  const exact: Record<string, string> = {
    nome: 'Nome completo',
    cpf: 'CPF',
    nascimento: 'Data de nascimento',
    idade: 'Idade',
    whatsapp: 'WhatsApp',
    email: 'E-mail',
    sexo: 'Sexo',
    procedimentos: 'Procedimento(s) de interesse',
    outroProc: 'Outro procedimento / descrição',
    objetivos: 'O que você deseja melhorar?',
    objetivoTexto: 'Conte um pouco mais sobre seu objetivo',
    histEst: 'Já realizou procedimentos estéticos?',
    histQual: 'Qual procedimento e quando?',
    histReacao: 'Teve reação ou complicação?',
    histExperiencia: 'Como foi a experiência / há algo importante para informar?',
    pele: 'Como considera sua pele?',
    solIntenso: 'Teve exposição solar intensa recentemente?',
    condPele: 'Apresenta atualmente',
    manchasPos: 'Já apresentou manchas após procedimentos ou inflamações?',
    quandoSol: 'Quando foi a exposição solar?',
    protetor: 'Usa protetor solar?',
    condSaude: 'Possui ou já teve condição de saúde importante?',
    saudeDesc: 'Se sim, descreva',
    cardio: 'Histórico de problemas cardíacos?',
    cardioDesc: 'Detalhes cardíacos / pressão / desmaios, se houver',
    acomp: 'Possui condição médica em acompanhamento?',
    medCont: 'Faz uso contínuo de medicamentos?',
    medDesc: 'Medicamentos: nome, dosagem se souber e motivo',
    derm: 'Usa/usou recentemente medicamentos ou tratamentos dermatológicos?',
    dermDesc: 'Quais e quando?',
    alergia: 'Possui alergia conhecida?',
    alergiaDesc: 'Quais alergias?',
    reacaoEst: 'Já teve reação alérgica durante procedimento estético?',
    reacaoDesc: 'Se sim, explique',
    alcool: 'Consome bebidas alcoólicas?',
    alcFreq: 'Frequência do consumo de bebidas alcoólicas',
    alcObs: 'Observação sobre consumo de bebidas alcoólicas',
    nic: 'Fuma ou utiliza produtos com nicotina?',
    nicFreq: 'Frequência de uso de nicotina',
    nicTempo: 'Há quanto tempo utiliza nicotina?',
    gest: 'Existe possibilidade de gestação?',
    amamenta: 'Está amamentando?',
    recente: 'Realizou cirurgia ou procedimento médico/estético recentemente?',
    recQual: 'Qual procedimento?',
    recQuando: 'Quando?',
    recRecuperacao: 'Está em recuperação?',
    recOrientacao: 'Existe orientação médica relacionada?',
    mFaceReg: 'Módulo facial — Região',
    mFaceObj: 'Módulo facial — O que espera melhorar?',
    mBodyReg: 'Módulo corporal / bem-estar — Região',
    mBodyObj: 'Módulo corporal / bem-estar — Objetivo',
    mVascReg: 'Módulo microvasos — Região',
    mVascTempo: 'Módulo microvasos — Há quanto tempo?',
    mVascAnt: 'Módulo microvasos — Tratamento anterior',
    mPeelAnt: 'Módulo peeling — Já realizou peeling anteriormente?',
    mPeelReac: 'Módulo peeling — Teve reação importante?',
    mPeelProd: 'Módulo peeling — Produtos dermatológicos atuais',
    mMicroAnt: 'Módulo microagulhamento — Microagulhamento anterior',
    mMicroRec: 'Módulo microagulhamento — Como foi a recuperação?',
    mTecAnt: 'Módulo tecnologias — Já realizou tratamento semelhante?',
    mTecReac: 'Módulo tecnologias — Teve reação relevante?',
    mOrient: 'Orientação profissional — O que gostaria de melhorar?',
    mOutro: 'Outro procedimento — Descreva',
    expectativa: 'O que você espera alcançar com o tratamento?',
    resultadoEsp: 'Existe algum resultado específico que gostaria de conversar com a profissional?',
    observacoes: 'Existe algo mais que gostaria de nos contar?',
    consentimento1: 'Veracidade das informações',
    consentimento2: 'Tratamento das informações',
  };
  if (exact[key]) return exact[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

export function displayValue(value: unknown): string {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) {
    const values = value.map(displayValue).filter((item) => item !== '-');
    return values.length ? values.join(', ') : '-';
  }
  if (typeof value === 'object') {
    const values = Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => `${humanLabel(key)}: ${displayValue(child)}`);
    return values.length ? values.join(' | ') : '-';
  }
  return sanitizePdfText(value);
}

const COMPACT_KEYS = new Set([
  'cpf', 'idade', 'sexo', 'pele', 'gest', 'amamenta', 'alergia', 'nic', 'alcool', 'cardio', 'acomp', 'derm',
  'solIntenso', 'protetor', 'manchasPos', 'reacaoEst', 'recRecuperacao', 'medCont', 'histEst',
]);

const MEDIUM_KEYS = new Set([
  'nascimento', 'whatsapp', 'email', 'quandoSol', 'alcFreq', 'nicFreq', 'nicTempo', 'recQuando', 'mVascTempo',
]);

const FULL_KEYS = new Set([
  'objetivos', 'objetivoTexto', 'histQual', 'histReacao', 'histExperiencia', 'condPele', 'saudeDesc', 'cardioDesc',
  'medDesc', 'dermDesc', 'alergiaDesc', 'reacaoDesc', 'alcObs', 'recQual', 'recOrientacao', 'mFaceObj', 'mBodyObj',
  'mVascAnt', 'mPeelProd', 'mMicroRec', 'mTecReac', 'mOrient', 'mOutro', 'expectativa', 'resultadoEsp', 'observacoes',
]);

export function fieldSpan(key: string, value: unknown): PdfSpan {
  if (FULL_KEYS.has(key)) return 3;
  if (COMPACT_KEYS.has(key)) return 1;
  if (MEDIUM_KEYS.has(key)) return 2;

  const rendered = displayValue(value);
  if (rendered.length > 180 || rendered.includes('\n')) return 3;
  if (rendered.length > 70) return 2;
  return 2;
}

function formatCpf(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11);
  return digits.length === 11
    ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
    : digits || '-';
}

function makeField(key: string, value: unknown, overrides: Partial<PdfField> = {}): PdfField {
  return {
    key,
    label: humanLabel(key),
    displayValue: displayValue(value),
    span: fieldSpan(key, value),
    importance: 'normal',
    ...overrides,
  };
}

const SECTION_KEYS: Array<{ title: string; keys: string[] }> = [
  {
    title: 'Objetivo da avaliação',
    keys: ['objetivos', 'objetivoTexto', 'outroProc'],
  },
  {
    title: 'Histórico estético',
    keys: ['histEst', 'histQual', 'histReacao', 'histExperiencia', 'recente', 'recQual', 'recQuando', 'recRecuperacao', 'recOrientacao'],
  },
  {
    title: 'Pele e exposição solar',
    keys: ['pele', 'solIntenso', 'quandoSol', 'condPele', 'manchasPos', 'protetor'],
  },
  {
    title: 'Saúde e segurança',
    keys: ['condSaude', 'saudeDesc', 'cardio', 'cardioDesc', 'acomp', 'medCont', 'medDesc', 'derm', 'dermDesc', 'alergia', 'alergiaDesc', 'reacaoEst', 'reacaoDesc', 'gest', 'amamenta'],
  },
  {
    title: 'Hábitos e contexto',
    keys: ['alcool', 'alcFreq', 'alcObs', 'nic', 'nicFreq', 'nicTempo'],
  },
  {
    title: 'Módulo específico do procedimento',
    keys: ['mFaceReg', 'mFaceObj', 'mBodyReg', 'mBodyObj', 'mVascReg', 'mVascTempo', 'mVascAnt', 'mPeelAnt', 'mPeelReac', 'mPeelProd', 'mMicroAnt', 'mMicroRec', 'mTecAnt', 'mTecReac', 'mOrient', 'mOutro'],
  },
  {
    title: 'Expectativas e observações',
    keys: ['expectativa', 'resultadoEsp', 'observacoes'],
  },
];

function hasMeaningfulValue(value: unknown): boolean {
  return displayValue(value) !== '-';
}

export function buildPdfSections(input: PdfContentInput): PdfSection[] {
  const answers = input.answers || {};
  const sections: PdfSection[] = [
    {
      title: 'Identificação',
      fields: [
        makeField('nome', input.patient.name, { span: 3 }),
        makeField('cpf', formatCpf(input.patient.cpf), { span: 1, importance: 'critical' }),
        makeField('nascimento', input.patient.birthDate || '-', { span: 1 }),
        makeField('idade', input.patient.age ?? '-', { span: 1 }),
        makeField('whatsapp', input.patient.phone, { span: 2 }),
        makeField('email', input.patient.email || '-', { span: 1 }),
      ],
    },
    {
      title: 'Objetivo da avaliação',
      fields: [
        makeField('procedimentos', input.procedure, { span: 3, importance: 'critical' }),
        ...SECTION_KEYS[0].keys.filter((key) => hasMeaningfulValue(answers[key])).map((key) => makeField(key, answers[key])),
      ],
    },
  ];

  for (const definition of SECTION_KEYS.slice(1)) {
    const fields = definition.keys
      .filter((key) => hasMeaningfulValue(answers[key]))
      .map((key) => makeField(key, answers[key]));
    if (fields.length) sections.push({ title: definition.title, fields });
  }

  const known = new Set(SECTION_KEYS.flatMap((section) => section.keys));
  const ignored = new Set(['nome', 'cpf', 'nascimento', 'idade', 'whatsapp', 'email', 'consentimento1', 'consentimento2', 'procedimentos']);
  const remaining = Object.entries(answers)
    .filter(([key, value]) => !known.has(key) && !ignored.has(key) && hasMeaningfulValue(value))
    .map(([key, value]) => makeField(key, value));
  if (remaining.length) sections.push({ title: 'Outras informações declaradas', fields: remaining });

  return sections;
}

function summaryField(key: string, label: string, value: unknown): PdfField | null {
  if (!hasMeaningfulValue(value)) return null;
  return {
    key,
    label,
    displayValue: displayValue(value),
    span: 3,
    importance: 'critical',
  };
}

export function buildStructuredSummary(input: PdfContentInput): PdfSection {
  const answers = input.answers || {};
  const candidates = [
    summaryField('summaryObjetivos', 'Objetivos declarados', answers.objetivos),
    summaryField('summaryObjetivoTexto', 'Descrição do objetivo', answers.objetivoTexto),
    summaryField('summaryHistorico', 'Histórico estético informado', answers.histQual ?? answers.histEst),
    summaryField('summarySaude', 'Informações de saúde declaradas', answers.saudeDesc ?? answers.condSaude),
    summaryField('summaryAlergias', 'Alergias declaradas', answers.alergiaDesc ?? answers.alergia),
    summaryField('summaryMedicamentos', 'Medicamentos declarados', answers.medDesc ?? answers.medCont),
    summaryField('summaryObservacoes', 'Observações', answers.observacoes),
  ];

  return {
    title: 'Síntese da pré-avaliação',
    fields: candidates.filter((field): field is PdfField => Boolean(field)),
  };
}
