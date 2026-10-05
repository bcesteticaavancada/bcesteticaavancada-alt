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

export function wrapPdfText(value: unknown, maxChars = 78): string[] {
  const text = sanitizePdfText(value).trim();
  if (!text) return ['-'];
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const word of words) {
      if (!line) { line = word; continue; }
      if (`${line} ${word}`.length <= maxChars) line += ` ${word}`;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
  }
  return out.length ? out : ['-'];
}

function displayValue(value: unknown): string {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.map(displayValue).join(', ');
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>)
    .map(([key, child]) => `${humanLabel(key)}: ${displayValue(child)}`).join(' | ');
  return sanitizePdfText(value);
}

function humanLabel(key: string): string {
  const exact: Record<string, string> = {
    nome: 'Nome completo', nascimento: 'Data de nascimento', idade: 'Idade', whatsapp: 'WhatsApp', email: 'E-mail', sexo: 'Sexo',
    procedimentos: 'Qual atendimento você procura?', outroProc: 'Outro procedimento / descrição',
    objetivos: 'O que você deseja melhorar?', objetivoTexto: 'Conte um pouco mais sobre seu objetivo',
    histEst: 'Já realizou procedimentos estéticos?', histQual: 'Qual procedimento e quando?', histReacao: 'Teve reação ou complicação?',
    histExperiencia: 'Como foi a experiência / há algo importante para informar?',
    pele: 'Como considera sua pele?', solIntenso: 'Teve exposição solar intensa recentemente?', condPele: 'Apresenta atualmente',
    manchasPos: 'Já apresentou manchas após procedimentos ou inflamações?', quandoSol: 'Quando foi a exposição solar?', protetor: 'Usa protetor solar?',
    condSaude: 'Possui ou já teve condição de saúde importante?', saudeDesc: 'Se sim, descreva',
    cardio: 'Histórico de problemas cardíacos?', cardioDesc: 'Detalhes cardíacos / pressão / desmaios, se houver',
    acomp: 'Possui condição médica em acompanhamento?', medCont: 'Faz uso contínuo de medicamentos?',
    medDesc: 'Medicamentos: nome, dosagem se souber e motivo',
    derm: 'Usa/usou recentemente medicamentos ou tratamentos dermatológicos?', dermDesc: 'Quais e quando?',
    alergia: 'Possui alergia conhecida?', alergiaDesc: 'Quais alergias?',
    reacaoEst: 'Já teve reação alérgica durante procedimento estético?', reacaoDesc: 'Se sim, explique',
    alcool: 'Consome bebidas alcoólicas?', alcFreq: 'Frequência do consumo de bebidas alcoólicas', alcObs: 'Observação sobre consumo de bebidas alcoólicas',
    nic: 'Fuma ou utiliza produtos com nicotina?', nicFreq: 'Frequência de uso de nicotina', nicTempo: 'Há quanto tempo utiliza nicotina?',
    gest: 'Existe possibilidade de gestação?', amamenta: 'Está amamentando?',
    recente: 'Realizou cirurgia ou procedimento médico/estético recentemente?', recQual: 'Qual procedimento?', recQuando: 'Quando?',
    recRecuperacao: 'Está em recuperação?', recOrientacao: 'Existe orientação médica relacionada?',
    mFaceReg: 'Módulo facial — Região', mFaceObj: 'Módulo facial — O que espera melhorar?',
    mBodyReg: 'Módulo corporal / bem-estar — Região', mBodyObj: 'Módulo corporal / bem-estar — Objetivo',
    mVascReg: 'Módulo microvasos — Região', mVascTempo: 'Módulo microvasos — Há quanto tempo?', mVascAnt: 'Módulo microvasos — Tratamento anterior',
    mPeelAnt: 'Módulo peeling — Já realizou peeling anteriormente?', mPeelReac: 'Módulo peeling — Teve reação importante?', mPeelProd: 'Módulo peeling — Produtos dermatológicos atuais',
    mMicroAnt: 'Módulo microagulhamento — Microagulhamento anterior', mMicroRec: 'Módulo microagulhamento — Como foi a recuperação?',
    mTecAnt: 'Módulo tecnologias — Já realizou tratamento semelhante?', mTecReac: 'Módulo tecnologias — Teve reação relevante?',
    mOrient: 'Orientação profissional — O que gostaria de melhorar?', mOutro: 'Outro procedimento — Descreva',
    expectativa: 'O que você espera alcançar com o tratamento?',
    resultadoEsp: 'Existe algum resultado específico que gostaria de conversar com a profissional?',
    observacoes: 'Existe algo mais que gostaria de nos contar?',
    consentimento1: 'Veracidade das informações', consentimento2: 'Tratamento das informações',
  };
  if (exact[key]) return exact[key];
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

function formatCpf(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  return digits.length === 11 ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}` : digits || '-';
}

function formatDateTime(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export type PdfInput = {
  publicCode: string;
  createdAt: string | Date;
  patient: { name: string; cpf?: string; birthDate?: string; age?: number; phone: string; email?: string };
  procedure: string;
  answers: Record<string, unknown>;
  consents: Record<string, unknown>;
  signaturePngBytes: Uint8Array;
  logoPngBytes?: Uint8Array | null;
  rubricSha256?: string;
  rubricConfirmedAt?: string | Date;
};

export async function generatePreAnamnesePdf(input: PdfInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('npm:pdf-lib@1.17.1');
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89];
  const marginX = 46;
  const topY = 785;
  const bottomY = 70;
  const colors = {
    ink: rgb(0.18, 0.15, 0.13),
    muted: rgb(0.43, 0.38, 0.35),
    rose: rgb(0.62, 0.43, 0.39),
    gold: rgb(0.72, 0.57, 0.32),
    cream: rgb(0.97, 0.95, 0.92),
    line: rgb(0.86, 0.82, 0.78),
  };

  let page = pdfDoc.addPage(pageSize);
  let y = topY;
  let embeddedLogo: any = null;
  let embeddedSignature: any = null;
  try { if (input.logoPngBytes?.length) embeddedLogo = await pdfDoc.embedPng(input.logoPngBytes); } catch { embeddedLogo = null; }
  try { if (input.signaturePngBytes?.length) embeddedSignature = await pdfDoc.embedPng(input.signaturePngBytes); } catch { embeddedSignature = null; }

  const drawBrandHeader = () => {
    page.drawRectangle({ x: 0, y: 802, width: pageSize[0], height: 40, color: colors.cream });
    if (embeddedLogo) {
      const scale = Math.min(54 / embeddedLogo.width, 34 / embeddedLogo.height);
      page.drawImage(embeddedLogo, { x: marginX, y: 805, width: embeddedLogo.width * scale, height: embeddedLogo.height * scale });
    }
    page.drawText('BC ESTÉTICA AVANÇADA', { x: embeddedLogo ? 112 : marginX, y: 822, size: 10, font: bold, color: colors.ink });
    page.drawText('Ficha de Pré-Anamnese', { x: embeddedLogo ? 112 : marginX, y: 807, size: 9, font: regular, color: colors.muted });
    page.drawLine({ start: { x: marginX, y: 798 }, end: { x: pageSize[0] - marginX, y: 798 }, thickness: 1, color: colors.gold });
  };

  const newPage = () => {
    page = pdfDoc.addPage(pageSize);
    y = topY;
    drawBrandHeader();
    y = 775;
  };

  const ensure = (height: number) => { if (y - height < bottomY) newPage(); };

  const drawSection = (title: string) => {
    ensure(34);
    page.drawText(sanitizePdfText(title).toUpperCase(), { x: marginX, y, size: 10, font: bold, color: colors.rose });
    y -= 7;
    page.drawLine({ start: { x: marginX, y }, end: { x: pageSize[0] - marginX, y }, thickness: 0.8, color: colors.line });
    y -= 17;
  };

  const drawField = (label: string, value: unknown) => {
    const questionLines = wrapPdfText(label, 66);
    const answerLines = wrapPdfText(displayValue(value), 66);
    const innerHeight = questionLines.length * 13 + 8 + answerLines.length * 15;
    const height = innerHeight + 22;
    ensure(height);

    const boxTop = y + 7;
    const boxHeight = innerHeight + 12;
    page.drawRectangle({
      x: marginX,
      y: boxTop - boxHeight,
      width: pageSize[0] - marginX * 2,
      height: boxHeight,
      color: colors.cream,
      borderColor: colors.line,
      borderWidth: 0.6,
    });

    let fieldY = y - 5;
    for (const line of questionLines) {
      page.drawText(sanitizePdfText(line), {
        x: marginX + 14, y: fieldY, size: 10.2, font: bold, color: colors.ink,
        maxWidth: pageSize[0] - marginX * 2 - 28,
      });
      fieldY -= 13;
    }

    fieldY -= 4;
    for (const line of answerLines) {
      page.drawText(line || '-', {
        x: marginX + 14, y: fieldY, size: 11.2, font: regular, color: colors.muted,
        maxWidth: pageSize[0] - marginX * 2 - 28,
      });
      fieldY -= 15;
    }

    y = boxTop - boxHeight - 12;
  };

  drawBrandHeader();
  y = 771;
  page.drawText('FICHA DE PRÉ-ANAMNESE', { x: marginX, y, size: 20, font: bold, color: colors.ink });
  y -= 21;
  page.drawText(`Código: ${sanitizePdfText(input.publicCode)}`, { x: marginX, y, size: 9, font: bold, color: colors.rose });
  page.drawText(`Gerada em: ${formatDateTime(input.createdAt)}`, { x: 330, y, size: 8.5, font: regular, color: colors.muted });
  y -= 31;

  drawSection('Identificação');
  drawField('Nome completo', input.patient.name);
  drawField('CPF', formatCpf(input.patient.cpf || ''));
  drawField('Data de nascimento', input.patient.birthDate || '-');
  drawField('Idade', input.patient.age ?? '-');
  drawField('WhatsApp', input.patient.phone);
  drawField('E-mail', input.patient.email || '-');

  drawSection('Procedimento');
  drawField('Procedimento(s) de interesse', input.procedure);

  drawSection('Respostas da pré-anamnese');
  for (const [key, value] of Object.entries(input.answers || {})) {
    if (['nome', 'nascimento', 'idade', 'whatsapp', 'email', 'consentimento1', 'consentimento2'].includes(key)) continue;
    drawField(humanLabel(key), value);
  }

  drawSection('Consentimentos');
  drawField('Informações fornecidas declaradas como verdadeiras', input.consents?.truthful === true);
  drawField('Tratamento das informações para atendimento autorizado', input.consents?.dataProcessing === true);
  drawField('Tratamento dos dados informados, incluindo CPF, autorizado', input.consents?.dataAuthorization === true);
  ensure(48);
  const disclaimer = 'Esta pré-anamnese organiza informações antes do atendimento e não substitui a avaliação profissional. A rubrica abaixo confirma o preenchimento desta pré-anamnese, mas não substitui a assinatura formal nem os termos específicos do procedimento, que serão realizados presencialmente.';
  for (const line of wrapPdfText(disclaimer, 92)) {
    page.drawText(line, { x: marginX, y, size: 8.2, font: regular, color: colors.muted });
    y -= 10;
  }
  y -= 18;

  drawSection('Rubrica de confirmação e assinatura presencial');
  ensure(172);
  if (embeddedSignature) {
    const maxW = 190;
    const maxH = 70;
    const scale = Math.min(maxW / embeddedSignature.width, maxH / embeddedSignature.height);
    page.drawImage(embeddedSignature, { x: marginX, y: y - embeddedSignature.height * scale + 5, width: embeddedSignature.width * scale, height: embeddedSignature.height * scale });
  }
  page.drawLine({ start: { x: marginX, y: y - 72 }, end: { x: 260, y: y - 72 }, thickness: 0.8, color: colors.ink });
  page.drawText('Rubrica de confirmação da pré-anamnese', { x: marginX, y: y - 85, size: 8, font: regular, color: colors.muted });
  page.drawLine({ start: { x: 330, y: y - 72 }, end: { x: pageSize[0] - marginX, y: y - 72 }, thickness: 0.8, color: colors.ink });
  page.drawText('Assinatura da profissional responsável (presencial)', { x: 330, y: y - 85, size: 8, font: regular, color: colors.muted });
  page.drawText(`Confirmação registrada em: ${formatDateTime(input.rubricConfirmedAt || input.createdAt)}`, { x: marginX, y: y - 108, size: 8.2, font: regular, color: colors.ink });
  if (input.rubricSha256) {
    page.drawText('SHA-256 da rubrica:', { x: marginX, y: y - 124, size: 7.5, font: bold, color: colors.muted });
    page.drawText(sanitizePdfText(input.rubricSha256), { x: marginX, y: y - 136, size: 6.6, font: regular, color: colors.muted, maxWidth: pageSize[0] - marginX * 2 });
  }

  const pages = pdfDoc.getPages();
  pages.forEach((p: any, index: number) => {
    p.drawLine({ start: { x: marginX, y: 52 }, end: { x: pageSize[0] - marginX, y: 52 }, thickness: 0.6, color: colors.line });
    p.drawText('BC Estética Avançada • Belo Horizonte/MG • Documento confidencial', { x: marginX, y: 36, size: 7.2, font: regular, color: colors.muted });
    p.drawText(`${index + 1}/${pages.length}`, { x: pageSize[0] - marginX - 22, y: 36, size: 7.2, font: regular, color: colors.muted });
  });

  return await pdfDoc.save();
}
