import type { PdfField, PdfSpan } from './pdf-content.ts';

export function packFieldsIntoRows(fields: PdfField[]): PdfField[][] {
  const rows: PdfField[][] = [];
  let current: PdfField[] = [];
  let used = 0;

  const flush = () => {
    if (current.length) {
      const remaining = 3 - used;
      if (remaining > 0) {
        const lastIndex = current.length - 1;
        const last = current[lastIndex];
        const expandedSpan = Math.min(3, last.span + remaining) as PdfSpan;
        current = current.map((field, index) =>
          index === lastIndex ? { ...field, span: expandedSpan } : field
        );
      }
      rows.push(current);
    }
    current = [];
    used = 0;
  };

  for (const field of fields) {
    const span = field.span;

    if (span === 3) {
      flush();
      rows.push([field]);
      continue;
    }

    if (used + span > 3) flush();

    current.push(field);
    used += span;

    if (used === 3) flush();
  }

  flush();
  return rows;
}

function estimateWrappedLines(text: string, width: number, averageGlyphWidth: number): number {
  const usableWidth = Math.max(36, width - 28);
  const charsPerLine = Math.max(8, Math.floor(usableWidth / averageGlyphWidth));
  return Math.max(
    1,
    text.split(/\r?\n/).reduce((total, paragraph) => {
      const normalized = paragraph.trim();
      return total + Math.max(1, Math.ceil(normalized.length / charsPerLine));
    }, 0),
  );
}

export function estimateCardHeight(field: PdfField, width: number): number {
  const labelLines = estimateWrappedLines(field.label || '-', width, 5.1);
  const answerLines = estimateWrappedLines(field.displayValue || '-', width, 5.4);
  const verticalPadding = 24;
  const labelHeight = labelLines * 12;
  const gap = 6;
  const answerHeight = answerLines * 14;
  return verticalPadding + labelHeight + gap + answerHeight;
}
