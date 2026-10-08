import { assertEquals } from "jsr:@std/assert@1.0.14";
import { buildPdfDownloadFilename } from './download-filename.ts';

Deno.test('gera nome BC-Ficha com data de Belo Horizonte, primeiro nome e último sobrenome', () => {
  assertEquals(
    buildPdfDownloadFilename('Vitória da Cunha', '2026-11-10T15:30:00.000Z'),
    'BC-Ficha2026-11-10Vitória-Cunha.pdf',
  );
});

Deno.test('usa a data local de Belo Horizonte quando UTC já virou o dia', () => {
  assertEquals(
    buildPdfDownloadFilename('Fernando Victor Barbosa de Faria', '2026-11-11T01:30:00.000Z'),
    'BC-Ficha2026-11-10Fernando-Faria.pdf',
  );
});

Deno.test('normaliza espaços e caracteres inseguros sem alterar o padrão', () => {
  assertEquals(
    buildPdfDownloadFilename('  Ana   Clara / Souza  ', '2026-10-08T12:00:00.000Z'),
    'BC-Ficha2026-10-08Ana-Souza.pdf',
  );
});
