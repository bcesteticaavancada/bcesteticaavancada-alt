import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const adminHtml = new URL('../../gestao/admin/index.html', import.meta.url);
const moduleUrl = new URL('../../gestao/js/admin-staff-profile.js', import.meta.url);

test('admin expõe editor de identidade profissional sem hardcode de credenciais', async () => {
  const html = await fs.readFile(adminHtml, 'utf8');
  assert.match(html, /id="staffClinicalIdentityForm"/);
  assert.match(html, /id="staffClinicalProfessional"/);
  assert.match(html, /name="profissao"/);
  assert.match(html, /name="conselho"/);
  assert.match(html, /name="registro_conselho"/);
  assert.match(html, /Identificação profissional/i);
  assert.doesNotMatch(html, /CRBM\s*[-:]?\s*\d{3,}/i);
});

test('módulo administrativo lista staff ativo e inicializa o formulário', async () => {
  const source = await fs.readFile(moduleUrl, 'utf8');
  assert.match(source, /export async function listStaffClinicalProfiles/);
  assert.match(source, /export async function initAdminStaffClinicalIdentity/);
  assert.match(source, /staff_profiles/);
  assert.match(source, /profissao/);
  assert.match(source, /registro_conselho/);
  assert.match(source, /bc_staff_update_clinical_identity/);
});

test('admin inicializa a identificação profissional após autenticação', async () => {
  const html = await fs.readFile(adminHtml, 'utf8');
  assert.match(html, /initAdminStaffClinicalIdentity/);
  assert.match(html, /await initAdminStaffClinicalIdentity\(\{client,root:document\}\)/);
});
