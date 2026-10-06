import { generatePreAnamnesePdf } from '../supabase/functions/submit-pre-anamnese/pdf.ts';

async function fetchLogo(): Promise<Uint8Array | null> {
  try {
    const response = await fetch('https://bcesteticaavancada.github.io/bcesteticaavancada-alt/assets/logo-oficial/logo-bc-estetica-sem-fundo.png');
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

await Deno.mkdir('artifacts', { recursive: true });

const pdf = await generatePreAnamnesePdf({
  publicCode: 'BC-20261005-PREVIEW',
  createdAt: '2026-10-05T21:00:00-03:00',
  patient: {
    name: 'Paciente Exemplo BC',
    cpf: '52998224725',
    birthDate: '1990-04-10',
    age: 36,
    phone: '(31) 99999-9999',
    email: 'paciente.exemplo@example.com',
  },
  procedure: 'Peeling Coreano + avaliação personalizada',
  answers: {
    sexo: 'Feminino',
    objetivos: ['Qualidade da pele', 'Hidratação', 'Rejuvenescimento'],
    objetivoTexto: 'Gostaria de melhorar textura, viço e uniformidade da pele, preservando um resultado natural e sem mudanças artificiais na minha aparência.',
    histEst: 'Sim',
    histQual: 'Limpeza de pele e peeling superficial há cerca de oito meses.',
    histReacao: 'Não apresentou reação importante.',
    histExperiencia: 'Boa experiência anterior. Prefere protocolos com recuperação discreta e orientação clara sobre cuidados em casa.',
    pele: 'Mista',
    solIntenso: 'Não',
    condPele: ['Manchas', 'Sensibilidade ocasional'],
    manchasPos: 'Não',
    protetor: 'Sim',
    condSaude: 'Sim',
    saudeDesc: 'Hipotireoidismo em acompanhamento regular.',
    cardio: 'Não',
    acomp: 'Sim',
    medCont: 'Sim',
    medDesc: 'Levotiroxina em uso contínuo conforme orientação médica.',
    derm: 'Não',
    alergia: 'Não',
    reacaoEst: 'Não',
    alcool: 'Socialmente',
    alcFreq: '1 a 2 vezes por semana',
    nic: 'Não',
    gest: 'Não',
    amamenta: 'Não',
    recente: 'Não',
    mPeelAnt: 'Sim',
    mPeelReac: 'Não',
    mPeelProd: 'Hidratante facial, vitamina C e protetor solar de uso diário.',
    expectativa: 'Melhorar a qualidade global da pele de forma progressiva e natural.',
    resultadoEsp: 'Gostaria de conversar sobre textura, luminosidade e manchas leves.',
    observacoes: 'Paciente relata rotina de trabalho intensa e preferência por um plano de cuidados objetivo, com etapas claras e acompanhamento profissional.',
  },
  consents: {
    truthful: true,
    dataProcessing: true,
    dataAuthorization: true,
  },
  signaturePngBytes: new Uint8Array(),
  logoPngBytes: await fetchLogo(),
  rubricSha256: 'c'.repeat(64),
  rubricConfirmedAt: '2026-10-05T21:00:00-03:00',
});

await Deno.writeFile('artifacts/pre-anamnese-preview.pdf', pdf);
console.log(`generated artifacts/pre-anamnese-preview.pdf (${pdf.length} bytes)`);
