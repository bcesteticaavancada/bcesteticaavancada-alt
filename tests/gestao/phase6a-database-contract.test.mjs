import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration(fragment) {
  const names = await readdir(migrationsDir);
  const filename = names.find((name) => name.includes(fragment) && name.endsWith('.sql'));
  assert.ok(filename, `migration ${fragment} deve existir`);
  return (await readFile(new URL(filename, migrationsDir), 'utf8')).toLowerCase();
}

const loadCoreMigration = () => loadMigration('bc_gestao_phase6a_client_core');
const loadPhotoMigration = () => loadMigration('bc_gestao_phase6a_client_photo');

test('fase 6A amplia clientes de forma forward-safe sem persistir idade', async () => {
  const sql = await loadCoreMigration();
  for (const column of [
    'cpf text',
    'data_nascimento date',
    'cep text',
    'logradouro text',
    'numero text',
    'complemento text',
    'bairro text',
    'cidade text',
    'uf text',
    'responsavel_nome text',
    'responsavel_cpf text',
    'responsavel_parentesco text',
    'responsavel_telefone text',
  ]) {
    assert.match(sql, new RegExp(`add\\s+column\\s+if\\s+not\\s+exists\\s+${column.replace(' ', '\\s+')}`));
  }
  assert.doesNotMatch(sql, /add\s+column\s+if\s+not\s+exists\s+idade\b/);
  assert.doesNotMatch(sql, /add\s+column\s+if\s+not\s+exists\s+cpf\s+text\s+not\s+null/);
  assert.doesNotMatch(sql, /add\s+column\s+if\s+not\s+exists\s+data_nascimento\s+date\s+not\s+null/);
});

test('fase 6A protege CPF normalizado, unicidade e nascimento futuro', async () => {
  const sql = await loadCoreMigration();
  assert.match(sql, /check\s*\(\s*cpf\s+is\s+null\s+or\s+cpf\s*~\s*'\^\[0-9\]\{11\}\$'\s*\)/);
  assert.match(sql, /create\s+unique\s+index[\s\S]*on\s+public\.clientes\s*\(\s*cpf\s*\)[\s\S]*where\s+cpf\s+is\s+not\s+null/);
  assert.match(sql, /data_nascimento[\s\S]*current_date/);
  assert.match(sql, /regexp_replace[\s\S]*'\[\^0-9\]'[\s\S]*'g'/);
});

test('fase 6A expõe wrappers invoker e mantém autorização sensível no private', async () => {
  const sql = await loadCoreMigration();
  for (const fn of ['bc_cliente_create_v2', 'bc_cliente_update_v2']) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\(`));
    assert.match(sql, new RegExp(`public\\.${fn}[\\s\\S]*security\\s+invoker`));
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${fn}_impl\\s*\\(`));
    assert.match(sql, new RegExp(`private\\.${fn}_impl[\\s\\S]*security\\s+definer`));
  }
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bc_cliente_duplicate_candidates\s*\(/);
  assert.match(sql, /bc_cliente_create_v2_impl[\s\S]*auth\.uid\(\)/);
  assert.match(sql, /bc_cliente_create_v2_impl[\s\S]*private\.is_bc_active_staff\(\)/);
  assert.match(sql, /bc_cliente_update_v2_impl[\s\S]*private\.is_bc_active_staff\(\)/);
  assert.match(sql, /bc_cliente_update_v2_impl[\s\S]*private\.is_bc_admin\(\)/);
});

test('fase 6A exige identidade mínima no RPC v2 e responsável para menor', async () => {
  const sql = await loadCoreMigration();
  for (const field of ['nome', 'cpf', 'data_nascimento', 'telefone']) {
    assert.match(sql, new RegExp(`bc_cliente_create_v2_impl[\\s\\S]*${field}`));
  }
  assert.match(sql, /interval\s+'18\s+years'/);
  assert.match(sql, /responsavel_nome/);
  assert.match(sql, /responsavel_cpf/);
  assert.match(sql, /responsavel_parentesco/);
  assert.match(sql, /responsavel_telefone/);
});

test('fase 6A minimiza auditoria cadastral e não abre financeiro', async () => {
  const sql = await loadCoreMigration();
  assert.match(sql, /audit_log|bc_audit/);
  assert.doesNotMatch(sql, /grant\s+select[\s\S]*(comissao|livros_financeiros|repasses)[\s\S]*to\s+authenticated/);
});

test('foto de identificação usa bucket privado e tabela com RLS', async () => {
  const sql = await loadPhotoMigration();
  assert.match(sql, /bc-prontuario-private/);
  assert.match(sql, /public\s*=\s*false|false\s*,\s*8\s*\*?\s*1024/i);
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.cliente_identificacao_fotos/);
  assert.match(sql, /alter\s+table\s+public\.cliente_identificacao_fotos\s+enable\s+row\s+level\s+security/);
  assert.match(sql, /create\s+unique\s+index[\s\S]*cliente_identificacao_fotos[\s\S]*where\s+atual\s*=\s*true/);
});

test('Storage privado permite somente equipe ativa e caminho de identificação', async () => {
  const sql = await loadPhotoMigration();
  assert.match(sql, /on\s+storage\.objects[\s\S]*for\s+select[\s\S]*to\s+authenticated/);
  assert.match(sql, /on\s+storage\.objects[\s\S]*for\s+insert[\s\S]*to\s+authenticated/);
  assert.match(sql, /bucket_id\s*=\s*'bc-prontuario-private'/);
  assert.match(sql, /storage\.foldername\(name\)[\s\S]*identificacao/);
  assert.match(sql, /private\.is_bc_active_staff\(\)/);
  assert.doesNotMatch(sql, /for\s+delete[\s\S]*to\s+authenticated[\s\S]*bucket_id\s*=\s*'bc-prontuario-private'/);
});

test('metadado da foto e troca da atual são autoridade do backend', async () => {
  const sql = await loadPhotoMigration();
  for (const fn of ['bc_cliente_register_id_photo', 'bc_cliente_set_current_id_photo']) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\(`));
    assert.match(sql, new RegExp(`public\\.${fn}[\\s\\S]*security\\s+invoker`));
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${fn}_impl\\s*\\(`));
    assert.match(sql, new RegExp(`private\\.${fn}_impl[\\s\\S]*auth\\.uid\\(\\)`));
    assert.match(sql, new RegExp(`private\\.${fn}_impl[\\s\\S]*private\\.is_bc_active_staff\\(\\)`));
  }
  assert.match(sql, /created_by[\s\S]*v_user_id/);
  assert.match(sql, /substituida_at/);
});
