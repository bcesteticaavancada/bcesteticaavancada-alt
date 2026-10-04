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

export function formatCpfForPdf(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return '-';
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function fitImageWithinBox(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) return { width: 0, height: 0 };
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
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
    procedimentos: 'Procedimento(s) de interesse', outroProc: 'Outro procedimento', objetivo: 'Objetivo principal', histEst: 'Histórico estético',
    expectativa: 'Expectativa com o tratamento', resultadoEsp: 'Resultado específico para conversar', observacoes: 'Observações',
    consentimento1: 'Veracidade das informações', consentimento2: 'Tratamento das informações', dataAuthorization: 'Autorização de dados',
  };
  if (exact[key]) return exact[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function formatOfficialDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function centeredX(pageWidth: number, width: number): number {
  return (pageWidth - width) / 2;
}

export type PdfInput = {
  publicCode: string;
  createdAt: string | Date;
  rubricConfirmedAt?: string | Date | null;
  patient: { name: string; cpf?: string; birthDate?: string; age?: number; phone: string; email?: string };
  procedure: string;
  answers: Record<string, unknown>;
  consents: Record<string, unknown>;
  signaturePngBytes: Uint8Array;
  logoPngBytes?: Uint8Array | null;
};

export async function generatePreAnamnesePdf(input: PdfInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('npm:pdf-lib@1.17.1');
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89];
  const [pageWidth, pageHeight] = pageSize;
  const marginX = 48;
  const bottomY = 72;
  const contentWidth = pageWidth - marginX * 2;
  const colors = {
    ink: rgb(0.16, 0.14, 0.13),
    muted: rgb(0.43, 0.39, 0.37),
    rose: rgb(0.60, 0.43, 0.40),
    gold: rgb(0.72, 0.58, 0.36),
    champagne: rgb(0.93, 0.88, 0.80),
    cream: rgb(0.975, 0.965, 0.945),
    paper: rgb(0.995, 0.992, 0.985),
    line: rgb(0.86, 0.82, 0.78),
    white: rgb(1, 1, 1),
  };

  let page = pdfDoc.addPage(pageSize);
  let y = 0;
  let embeddedLogo: any = null;
  let embeddedSignature: any = null;
  try { if (input.logoPngBytes?.length) embeddedLogo = await pdfDoc.embedPng(input.logoPngBytes); } catch { embeddedLogo = null; }
  try { if (input.signaturePngBytes?.length) embeddedSignature = await pdfDoc.embedPng(input.signaturePngBytes); } catch { embeddedSignature = null; }

  const drawCenteredText = (text: string, yPos: number, size: number, font: any, color: any) => {
    const safe = sanitizePdfText(text);
    const width = font.widthOfTextAtSize(safe, size);
    page.drawText(safe, { x: centeredX(pageWidth, width), y: yPos, size, font, color });
  };

  const drawInternalHeader = () => {
    page.drawRectangle({ x: 0, y: pageHeight - 56, width: pageWidth, height: 56, color: colors.paper });
    if (embeddedLogo) {
      const dims = fitImageWithinBox(embeddedLogo.width, embeddedLogo.height, 52, 30);
      page.drawImage(embeddedLogo, { x: marginX, y: pageHeight - 43, width: dims.width, height: dims.height });
    }
    page.drawText('BC ESTÉTICA AVANÇADA', { x: embeddedLogo ? 112 : marginX, y: pageHeight - 28, size: 9.5, font: bold, color: colors.ink });
    page.drawText('Pré-Anamnese • documento confidencial', { x: embeddedLogo ? 112 : marginX, y: pageHeight - 42, size: 7.7, font: regular, color: colors.muted });
    page.drawLine({ start: { x: marginX, y: pageHeight - 58 }, end: { x: pageWidth - marginX, y: pageHeight - 58 }, thickness: 0.8, color: colors.gold });
  };

  const newContentPage = () => {
    page = pdfDoc.addPage(pageSize);
    drawInternalHeader();
    y = pageHeight - 86;
  };

  const ensure = (height: number) => {
    if (y - height < bottomY) newContentPage();
  };

  const drawSection = (title: string) => {
    ensure(38);
    page.drawText(sanitizePdfText(title).toUpperCase(), { x: marginX, y, size: 10.2, font: bold, color: colors.rose });
    y -= 8;
    page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 0.75, color: colors.line });
    y -= 18;
  };

  const drawField = (label: string, value: unknown, options: { maxChars?: number; gapAfter?: number } = {}) => {
    const lines = wrapPdfText(displayValue(value), options.maxChars ?? 82);
    const height = 17 + lines.length * 12 + (options.gapAfter ?? 6);
    ensure(height);
    page.drawText(sanitizePdfText(label), { x: marginX, y, size: 8.3, font: bold, color: colors.ink });
    y -= 12;
    for (const line of lines) {
      page.drawText(line || '-', { x: marginX, y, size: 9.1, font: regular, color: colors.muted, maxWidth: contentWidth });
      y -= 12;
    }
    y -= options.gapAfter ?? 6;
  };

  const drawCover = () => {
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: colors.paper });
    page.drawRectangle({ x: 0, y: pageHeight - 9, width: pageWidth, height: 9, color: colors.champagne });

    if (embeddedLogo) {
      const dims = fitImageWithinBox(embeddedLogo.width, embeddedLogo.height, 118, 62);
      page.drawImage(embeddedLogo, {
        x: centeredX(pageWidth, dims.width),
        y: 743,
        width: dims.width,
        height: dims.height,
      });
    }

    drawCenteredText('BC ESTÉTICA AVANÇADA', 713, 11.5, bold, colors.ink);
    drawCenteredText('FICHA DE PRÉ-ANAMNESE', 675, 23, bold, colors.ink);
    drawCenteredText('Menos achismo. Mais ciência.', 650, 10.5, regular, colors.rose);
    page.drawLine({ start: { x: 150, y: 630 }, end: { x: pageWidth - 150, y: 630 }, thickness: 1.2, color: colors.gold });

    page.drawRectangle({ x: marginX, y: 550, width: contentWidth, height: 58, color: colors.cream, borderColor: colors.champagne, borderWidth: 0.8 });
    page.drawText('PROTOCOLO BC', { x: marginX + 18, y: 585, size: 7.4, font: bold, color: colors.rose });
    page.drawText(sanitizePdfText(input.publicCode), { x: marginX + 18, y: 565, size: 11.2, font: bold, color: colors.ink });
    page.drawText('DATA DA FICHA', { x: 330, y: 585, size: 7.4, font: bold, color: colors.rose });
    page.drawText(formatOfficialDate(input.createdAt), { x: 330, y: 565, size: 8.8, font: regular, color: colors.ink });

    page.drawText('CLIENTE / PACIENTE', { x: marginX, y: 515, size: 7.4, font: bold, color: colors.rose });
    for (const [index, line] of wrapPdfText(input.patient.name, 62).slice(0, 2).entries()) {
      page.drawText(line, { x: marginX, y: 493 - index * 14, size: 13.5, font: bold, color: colors.ink, maxWidth: contentWidth });
    }

    y = 448;
  };

  drawCover();

  drawSection('Identificação');
  drawField('Nome completo', input.patient.name);
  drawField('CPF', formatCpfForPdf(input.patient.cpf));
  drawField('Data de nascimento', input.patient.birthDate || '-');
  drawField('Idade', input.patient.age ?? '-');
  drawField('WhatsApp', input.patient.phone);
  drawField('E-mail', input.patient.email || '-');

  drawSection('Procedimento');
  drawField('Procedimento(s) de interesse', input.procedure, { maxChars: 76, gapAfter: 10 });

  drawSection('Respostas da pré-anamnese');
  const hiddenAnswerKeys = new Set([
    'nome', 'cpf', 'nascimento', 'idade', 'whatsapp', 'email', 'procedimentos',
    'consentimento1', 'consentimento2', 'dataAuthorization',
  ]);
  for (const [key, value] of Object.entries(input.answers || {})) {
    if (hiddenAnswerKeys.has(key)) continue;
    drawField(humanLabel(key), value);
  }

  drawSection('Consentimentos');
  drawField('Informações fornecidas declaradas como verdadeiras', input.consents?.truthful === true);
  drawField('Tratamento das informações para atendimento autorizado', input.consents?.dataProcessing === true);
  drawField('Tratamento dos dados desta pré-anamnese autorizado', input.consents?.dataAuthorization === true);
  ensure(62);
  const disclaimer = 'Esta pré-anamnese organiza informações antes do atendimento e não substitui a avaliação profissional. A indicação, contraindicação e conduta devem ser definidas pela profissional responsável.';
  for (const line of wrapPdfText(disclaimer, 92)) {
    page.drawText(line, { x: marginX, y, size: 8.2, font: regular, color: colors.muted });
    y -= 10;
  }

  // Página final dedicada à confirmação: evita competir visualmente com o questionário.
  newContentPage();
  y = 720;
  drawCenteredText('CONFIRMAÇÃO DO PREENCHIMENTO', y, 15, bold, colors.ink);
  y -= 18;
  drawCenteredText('Rubrica de confirmação da pré-anamnese', y, 9, regular, colors.rose);
  y -= 28;

  const cardX = 72;
  const cardW = pageWidth - 144;
  const cardTop = y;
  const cardH = 330;
  page.drawRectangle({ x: cardX, y: cardTop - cardH, width: cardW, height: cardH, color: colors.white, borderColor: colors.champagne, borderWidth: 1 });
  page.drawRectangle({ x: cardX, y: cardTop - 42, width: cardW, height: 42, color: colors.cream });
  page.drawText('RUBRICA REGISTRADA NO ENVIO', { x: cardX + 20, y: cardTop - 26, size: 8, font: bold, color: colors.rose });

  const rubricBox = { x: cardX + 30, y: cardTop - 168, width: cardW - 60, height: 108 };
  page.drawRectangle({ x: rubricBox.x, y: rubricBox.y, width: rubricBox.width, height: rubricBox.height, borderColor: colors.line, borderWidth: 0.7 });
  if (embeddedSignature) {
    const dims = fitImageWithinBox(embeddedSignature.width, embeddedSignature.height, 260, 90);
    page.drawImage(embeddedSignature, {
      x: rubricBox.x + (rubricBox.width - dims.width) / 2,
      y: rubricBox.y + (rubricBox.height - dims.height) / 2,
      width: dims.width,
      height: dims.height,
    });
  } else {
    const missing = 'Rubrica não disponível na renderização.';
    page.drawText(missing, { x: rubricBox.x + 18, y: rubricBox.y + 48, size: 8, font: regular, color: colors.muted });
  }

  const infoX = cardX + 30;
  const infoValueX = cardX + 138;
  const infoStartY = rubricBox.y - 30;
  const rows: Array<[string, string]> = [
    ['Nome', sanitizePdfText(input.patient.name)],
    ['CPF', formatCpfForPdf(input.patient.cpf)],
    ['Data/hora oficial', formatOfficialDate(input.rubricConfirmedAt || input.createdAt)],
    ['Protocolo BC', sanitizePdfText(input.publicCode)],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = infoStartY - index * 25;
    page.drawText(label.toUpperCase(), { x: infoX, y: rowY, size: 7.2, font: bold, color: colors.rose });
    page.drawText(value, { x: infoValueX, y: rowY, size: 9, font: index === 3 ? bold : regular, color: colors.ink, maxWidth: cardX + cardW - infoValueX - 24 });
  });

  y = cardTop - cardH - 25;
  const confirmationText = 'Rubrica eletrônica referente exclusivamente à confirmação das informações prestadas nesta pré-anamnese. A documentação e assinatura definitiva relacionadas ao procedimento serão formalizadas presencialmente pela BC Estética.';
  for (const line of wrapPdfText(confirmationText, 88)) {
    page.drawText(line, { x: marginX, y, size: 8.4, font: regular, color: colors.muted });
    y -= 11;
  }

  y -= 28;
  page.drawText('ASSINATURA DA PROFISSIONAL RESPONSÁVEL', { x: marginX, y, size: 8, font: bold, color: colors.rose });
  y -= 44;
  page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 0.8, color: colors.ink });
  y -= 14;
  page.drawText('Assinatura realizada presencialmente. Nenhuma assinatura profissional foi aplicada automaticamente a este documento.', {
    x: marginX,
    y,
    size: 7.8,
    font: regular,
    color: colors.muted,
    maxWidth: contentWidth,
  });

  const pages = pdfDoc.getPages();
  pages.forEach((currentPage: any, index: number) => {
    currentPage.drawLine({ start: { x: marginX, y: 52 }, end: { x: pageWidth - marginX, y: 52 }, thickness: 0.55, color: colors.line });
    currentPage.drawText('BC Estética Avançada • Belo Horizonte/MG • Documento confidencial', { x: marginX, y: 36, size: 7.1, font: regular, color: colors.muted });
    const pageNumber = `${index + 1}/${pages.length}`;
    const numberWidth = regular.widthOfTextAtSize(pageNumber, 7.1);
    currentPage.drawText(pageNumber, { x: pageWidth - marginX - numberWidth, y: 36, size: 7.1, font: regular, color: colors.muted });
  });

  return await pdfDoc.save();
}
