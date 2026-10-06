import {
  PDF_DOCUMENT_TITLE,
  PDF_PROFESSIONAL_NOTES_TITLE,
  buildPdfSections,
  buildStructuredSummary,
  displayValue,
  sanitizePdfText,
  type PdfContentInput,
  type PdfField,
  type PdfSection,
} from './pdf-content.ts';
import { estimateCardHeight, packFieldsIntoRows } from './pdf-layout.ts';

export { sanitizePdfText };

export function formatPageLabel(pageNumber: number, pageCount: number): string {
  return `Página ${pageNumber} de ${pageCount}`;
}

export function wrapPdfText(value: unknown, maxChars = 78): string[] {
  const text = sanitizePdfText(value).trim();
  if (!text) return ['-'];
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      if (!line) {
        line = word;
        continue;
      }
      if (`${line} ${word}`.length <= maxChars) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : ['-'];
}

function formatDateTime(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export type PdfInput = PdfContentInput & {
  publicCode: string;
  createdAt: string | Date;
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
  const bodyTopY = 775;
  const bottomY = 70;
  const contentWidth = pageSize[0] - marginX * 2;
  const columnGap = 8;
  const columnWidth = (contentWidth - columnGap * 2) / 3;
  const maxBodyHeight = bodyTopY - bottomY;
  const colors = {
    ink: rgb(0.18, 0.15, 0.13),
    muted: rgb(0.43, 0.38, 0.35),
    rose: rgb(0.62, 0.43, 0.39),
    gold: rgb(0.72, 0.57, 0.32),
    cream: rgb(0.97, 0.95, 0.92),
    creamStrong: rgb(0.945, 0.91, 0.865),
    line: rgb(0.86, 0.82, 0.78),
  };

  let page = pdfDoc.addPage(pageSize);
  let y = topY;
  let embeddedLogo: any = null;
  let embeddedSignature: any = null;
  try {
    if (input.logoPngBytes?.length) embeddedLogo = await pdfDoc.embedPng(input.logoPngBytes);
  } catch {
    embeddedLogo = null;
  }
  try {
    if (input.signaturePngBytes?.length) embeddedSignature = await pdfDoc.embedPng(input.signaturePngBytes);
  } catch {
    embeddedSignature = null;
  }

  const drawBrandHeader = () => {
    page.drawRectangle({ x: 0, y: 802, width: pageSize[0], height: 40, color: colors.cream });
    if (embeddedLogo) {
      const scale = Math.min(54 / embeddedLogo.width, 34 / embeddedLogo.height);
      page.drawImage(embeddedLogo, {
        x: marginX,
        y: 805,
        width: embeddedLogo.width * scale,
        height: embeddedLogo.height * scale,
      });
    }
    const textX = embeddedLogo ? 112 : marginX;
    page.drawText('BC ESTÉTICA AVANÇADA', { x: textX, y: 822, size: 10, font: bold, color: colors.ink });
    page.drawText(PDF_DOCUMENT_TITLE, { x: textX, y: 807, size: 8.6, font: regular, color: colors.muted });
    page.drawLine({
      start: { x: marginX, y: 798 },
      end: { x: pageSize[0] - marginX, y: 798 },
      thickness: 1,
      color: colors.gold,
    });
  };

  const newPage = () => {
    page = pdfDoc.addPage(pageSize);
    drawBrandHeader();
    y = bodyTopY;
  };

  const ensure = (height: number) => {
    if (y - height < bottomY) newPage();
  };

  const charsForWidth = (width: number, glyphWidth = 5.25) =>
    Math.max(10, Math.floor((Math.max(40, width - 24)) / glyphWidth));

  const fieldWidth = (span: 1 | 2 | 3) => columnWidth * span + columnGap * (span - 1);

  const fieldMetrics = (field: PdfField, width: number) => {
    const labelLines = wrapPdfText(field.label, charsForWidth(width, 5.0));
    const answerLines = wrapPdfText(field.displayValue, charsForWidth(width, 5.3));
    const actualHeight = 16 + labelLines.length * 10 + 4 + answerLines.length * 12;
    const estimated = estimateCardHeight(field, width);
    return {
      labelLines,
      answerLines,
      height: Math.max(actualHeight, Math.min(estimated, actualHeight + 3)),
    };
  };

  const drawCard = (
    field: PdfField,
    x: number,
    width: number,
    height: number,
    labelLines?: string[],
    answerLines?: string[],
  ) => {
    const labels = labelLines ?? wrapPdfText(field.label, charsForWidth(width, 5.0));
    const answers = answerLines ?? wrapPdfText(field.displayValue, charsForWidth(width, 5.3));
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: field.importance === 'critical' ? colors.creamStrong : colors.cream,
      borderColor: colors.line,
      borderWidth: 0.65,
    });

    let textY = y - 12;
    for (const line of labels) {
      page.drawText(sanitizePdfText(line), {
        x: x + 10,
        y: textY,
        size: 8.2,
        font: bold,
        color: colors.ink,
        maxWidth: width - 20,
      });
      textY -= 10;
    }
    textY -= 4;
    for (const line of answers) {
      page.drawText(sanitizePdfText(line || '-'), {
        x: x + 10,
        y: textY,
        size: 9.2,
        font: regular,
        color: colors.muted,
        maxWidth: width - 20,
      });
      textY -= 12;
    }
  };

  const drawLongFullWidthField = (field: PdfField) => {
    const width = contentWidth;
    const allAnswerLines = wrapPdfText(field.displayValue, charsForWidth(width, 5.3));
    let offset = 0;
    let continuation = false;

    while (offset < allAnswerLines.length) {
      if (y - bottomY < 82) newPage();
      const label = continuation ? `${field.label} (continuação)` : field.label;
      const labelLines = wrapPdfText(label, charsForWidth(width, 5.0));
      const fixedHeight = 16 + labelLines.length * 10 + 4;
      const available = y - bottomY;
      const maxLines = Math.max(1, Math.floor((available - fixedHeight - 4) / 12));
      const answerLines = allAnswerLines.slice(offset, offset + maxLines);
      const height = fixedHeight + answerLines.length * 12;
      drawCard(field, marginX, width, height, labelLines, answerLines);
      y -= height + 6;
      offset += answerLines.length;
      continuation = true;
      if (offset < allAnswerLines.length) newPage();
    }
  };

  const drawRow = (row: PdfField[]) => {
    if (row.length === 1 && row[0].span === 3) {
      const width = contentWidth;
      const metrics = fieldMetrics(row[0], width);
      if (metrics.height > maxBodyHeight - 20) {
        drawLongFullWidthField(row[0]);
        return;
      }
      ensure(metrics.height + 6);
      drawCard(row[0], marginX, width, metrics.height, metrics.labelLines, metrics.answerLines);
      y -= metrics.height + 6;
      return;
    }

    const metrics = row.map((field) => {
      const width = fieldWidth(field.span);
      return { field, width, metrics: fieldMetrics(field, width) };
    });
    const rowHeight = Math.max(...metrics.map((item) => item.metrics.height));
    ensure(rowHeight + 6);

    let usedColumns = 0;
    for (const item of metrics) {
      const x = marginX + usedColumns * (columnWidth + columnGap);
      drawCard(
        item.field,
        x,
        item.width,
        rowHeight,
        item.metrics.labelLines,
        item.metrics.answerLines,
      );
      usedColumns += item.field.span;
    }
    y -= rowHeight + 6;
  };

  const drawSectionTitle = (title: string) => {
    page.drawText(sanitizePdfText(title).toUpperCase(), {
      x: marginX,
      y,
      size: 8.8,
      font: bold,
      color: colors.rose,
    });
    y -= 5;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: pageSize[0] - marginX, y },
      thickness: 0.7,
      color: colors.line,
    });
    y -= 12;
  };

  const renderSection = (section: PdfSection) => {
    if (!section.fields.length) return;
    const rows = packFieldsIntoRows(section.fields);
    const firstRow = rows[0];
    const firstHeight = firstRow.length === 1 && firstRow[0].span === 3
      ? Math.min(82, fieldMetrics(firstRow[0], contentWidth).height)
      : Math.min(
        82,
        Math.max(...firstRow.map((field) => fieldMetrics(field, fieldWidth(field.span)).height)),
      );
    ensure(22 + firstHeight);
    drawSectionTitle(section.title);
    for (const row of rows) drawRow(row);
    y -= 2;
  };

  drawBrandHeader();
  y = 771;
  page.drawText(PDF_DOCUMENT_TITLE.toUpperCase(), { x: marginX, y, size: 17.5, font: bold, color: colors.ink });
  y -= 21;
  page.drawText(`Código: ${sanitizePdfText(input.publicCode)}`, {
    x: marginX,
    y,
    size: 9,
    font: bold,
    color: colors.rose,
  });
  page.drawText(`Gerada em: ${formatDateTime(input.createdAt)}`, {
    x: 330,
    y,
    size: 8.5,
    font: regular,
    color: colors.muted,
  });
  y -= 27;

  for (const section of buildPdfSections(input)) renderSection(section);

  const summary = buildStructuredSummary(input);
  summary.fields = summary.fields.filter((field) => {
    const normalized = field.displayValue.trim().toLowerCase();
    return !['-', 'não', 'nao', 'não se aplica', 'nao se aplica'].includes(normalized);
  });
  if (summary.fields.length) renderSection(summary);

  renderSection({
    title: 'Consentimentos',
    fields: [
      {
        key: 'consentTruthful',
        label: 'Informações declaradas verdadeiras',
        displayValue: displayValue(input.consents?.truthful === true),
        span: 1,
        importance: 'critical',
      },
      {
        key: 'consentProcessing',
        label: 'Tratamento para atendimento',
        displayValue: displayValue(input.consents?.dataProcessing === true),
        span: 1,
        importance: 'critical',
      },
      {
        key: 'consentData',
        label: 'Tratamento dos dados autorizado',
        displayValue: displayValue(input.consents?.dataAuthorization === true),
        span: 1,
        importance: 'critical',
      },
    ],
  });

  ensure(150);
  drawSectionTitle('Rubrica de confirmação e assinatura presencial');
  if (embeddedSignature) {
    const maxW = 190;
    const maxH = 56;
    const scale = Math.min(maxW / embeddedSignature.width, maxH / embeddedSignature.height);
    page.drawImage(embeddedSignature, {
      x: marginX,
      y: y - embeddedSignature.height * scale + 3,
      width: embeddedSignature.width * scale,
      height: embeddedSignature.height * scale,
    });
  }
  page.drawLine({ start: { x: marginX, y: y - 60 }, end: { x: 260, y: y - 60 }, thickness: 0.8, color: colors.ink });
  page.drawText('Rubrica de confirmação da pré-anamnese', { x: marginX, y: y - 72, size: 7.5, font: regular, color: colors.muted });
  page.drawLine({ start: { x: 330, y: y - 60 }, end: { x: pageSize[0] - marginX, y: y - 60 }, thickness: 0.8, color: colors.ink });
  page.drawText('Assinatura da profissional responsável (presencial)', { x: 330, y: y - 72, size: 7.5, font: regular, color: colors.muted });
  page.drawText(`Confirmação registrada em: ${formatDateTime(input.rubricConfirmedAt || input.createdAt)}`, {
    x: marginX,
    y: y - 93,
    size: 7.8,
    font: regular,
    color: colors.ink,
  });
  if (input.rubricSha256) {
    page.drawText('SHA-256 da rubrica:', { x: marginX, y: y - 108, size: 7, font: bold, color: colors.muted });
    page.drawText(sanitizePdfText(input.rubricSha256), {
      x: marginX,
      y: y - 119,
      size: 6.2,
      font: regular,
      color: colors.muted,
      maxWidth: contentWidth,
    });
  }

  const notesTop = y - (input.rubricSha256 ? 143 : 117);
  const notesBottom = bottomY + 14;
  const notesHeight = notesTop - notesBottom;
  if (notesHeight >= 100) {
    const headerHeight = 27;
    page.drawRectangle({
      x: marginX,
      y: notesBottom,
      width: contentWidth,
      height: notesHeight,
      borderColor: colors.line,
      borderWidth: 0.7,
    });
    page.drawRectangle({
      x: marginX,
      y: notesTop - headerHeight,
      width: contentWidth,
      height: headerHeight,
      color: colors.cream,
      borderColor: colors.line,
      borderWidth: 0.7,
    });
    page.drawText(sanitizePdfText(PDF_PROFESSIONAL_NOTES_TITLE), {
      x: marginX + 12,
      y: notesTop - 18,
      size: 8.3,
      font: bold,
      color: colors.rose,
    });
    page.drawText('Espaço reservado para registro manual durante a avaliação presencial.', {
      x: marginX + 12,
      y: notesTop - 39,
      size: 7.2,
      font: regular,
      color: colors.muted,
    });
    for (let lineY = notesTop - 61; lineY > notesBottom + 16; lineY -= 27) {
      page.drawLine({
        start: { x: marginX + 12, y: lineY },
        end: { x: pageSize[0] - marginX - 12, y: lineY },
        thickness: 0.45,
        color: colors.line,
      });
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((p: any, index: number) => {
    p.drawLine({
      start: { x: marginX, y: 54 },
      end: { x: pageSize[0] - marginX, y: 54 },
      thickness: 0.6,
      color: colors.line,
    });
    p.drawText(`BC Estética Avançada • ${sanitizePdfText(input.publicCode)}`, {
      x: marginX,
      y: 40,
      size: 7,
      font: bold,
      color: colors.muted,
    });
    p.drawText('Pré-anamnese não substitui avaliação profissional.', {
      x: marginX,
      y: 29,
      size: 6.6,
      font: regular,
      color: colors.muted,
    });
    const pageLabel = formatPageLabel(index + 1, pages.length);
    const pageLabelWidth = regular.widthOfTextAtSize(pageLabel, 7);
    p.drawText(pageLabel, {
      x: pageSize[0] - marginX - pageLabelWidth,
      y: 40,
      size: 7,
      font: regular,
      color: colors.muted,
    });
  });

  return await pdfDoc.save();
}
