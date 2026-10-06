import { assert, assertEquals, assertGreater } from 'jsr:@std/assert@1';
import type { PdfField, PdfSpan } from './pdf-content.ts';
import { estimateCardHeight, packFieldsIntoRows } from './pdf-layout.ts';

function field(key: string, span: PdfSpan, value = 'Sim'): PdfField {
  return { key, label: key, displayValue: value, span, importance: 'normal' };
}

Deno.test('packFieldsIntoRows keeps three compact fields on one row', () => {
  const rows = packFieldsIntoRows([field('a', 1), field('b', 1), field('c', 1)]);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].map((item) => item.key), ['a', 'b', 'c']);
});

Deno.test('packFieldsIntoRows keeps span 1 plus span 2 together in order', () => {
  const rows = packFieldsIntoRows([field('a', 1), field('b', 2)]);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].map((item) => item.span), [1, 2]);
});

Deno.test('packFieldsIntoRows starts a new row when the next field would exceed three columns', () => {
  const rows = packFieldsIntoRows([field('a', 2), field('b', 2)]);
  assertEquals(rows.length, 2);
  assertEquals(rows[0][0].key, 'a');
  assertEquals(rows[1][0].key, 'b');
});

Deno.test('packFieldsIntoRows always places full-width fields alone and never exceeds three columns', () => {
  const rows = packFieldsIntoRows([
    field('a', 1),
    field('full', 3),
    field('b', 2),
    field('c', 1),
    field('d', 1),
  ]);
  const fullRow = rows.find((row) => row.some((item) => item.key === 'full'));
  assert(fullRow);
  assertEquals(fullRow.length, 1);
  for (const row of rows) {
    assert(row.reduce((sum, item) => sum + item.span, 0) <= 3);
  }
});

Deno.test('estimateCardHeight grows for multiline or long narrative content', () => {
  const short = estimateCardHeight(field('curto', 1, 'Não'), 150);
  const long = estimateCardHeight(field('longo', 3, 'Texto de observação '.repeat(30)), 450);
  assertGreater(long, short);
});
