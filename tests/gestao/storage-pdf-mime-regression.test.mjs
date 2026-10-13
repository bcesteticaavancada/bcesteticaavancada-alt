import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

test('bucket privado do prontuário aceita application/pdf para documentos clínicos', async () => {
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql'));
  const migrations = await Promise.all(files.map(async (name) => ({
    name,
    source: await readFile(new URL(name, migrationsDir), 'utf8'),
  })));

  const bucketConfigurations = migrations.filter(({ source }) =>
    source.includes('bc-prontuario-private') && source.includes('allowed_mime_types'));

  assert.ok(bucketConfigurations.length > 0, 'deve existir configuração versionada do bucket privado');
  assert.ok(
    bucketConfigurations.some(({ source }) => /application\/pdf/i.test(source)),
    'o bucket bc-prontuario-private precisa permitir application/pdf para salvar PDFs de anamnese e prontuário',
  );
});
