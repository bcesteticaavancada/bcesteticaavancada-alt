import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

// Real admin/collaborator forms and shared controller; isolated in-memory API.
// This harness never authenticates against or writes to a hosted database.
const base = process.cwd();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const route = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(base, `.${route.endsWith('/') ? route + 'index.html' : route}`);
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    let body = await readFile(file);
    if (/^\/gestao\/(admin|colaborador)\/$/.test(route)) {
      body = body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
await mkdir('test-results/agenda', { recursive: true });
try {
  for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
    const browser = await browserType.launch();
    try {
      for (const area of ['admin', 'colaborador']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${url}/gestao/${area}/`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(async (area) => {
          const { initClientesPanel } = await import('/gestao/js/clientes-panel.js?v=20261018-basic');
          const records = [];
          window.testCalls = [];
          const client = {
            storage: { from: () => ({}) },
            from(table) {
              let id;
              const result = () => ({ data: table === 'clientes' ? records.filter(row => !id || row.id === id) : [], error: null });
              const q = {};
              for (const method of ['select', 'ilike', 'or', 'order', 'limit']) q[method] = () => q;
              q.eq = (key, value) => { if (key === 'id') id = value; return q; };
              q.then = (resolve, reject) => Promise.resolve(result()).then(resolve, reject);
              q.maybeSingle = async () => ({ ...result(), data: result().data[0] || null });
              return q;
            },
            async rpc(name, args) {
              window.testCalls.push({ name, args });
              if (name === 'bc_staff_directory') return { data: [], error: null };
              if (name === 'bc_cliente_duplicate_candidates') {
                return { data: records.filter(row => row.nome === args.p_nome && row.telefone.replace(/\D/g, '') === args.p_telefone), error: null };
              }
              if (['bc_cliente_create_v2', 'bc_cliente_update_v2'].includes(name)) {
                const p = args.p_payload;
                for (const key of ['cpf', 'responsavel_cpf']) {
                  if (p[key] && p[key].replace(/\D/g, '').length !== 11) return { data: null, error: { message: 'CPF deve conter 11 dígitos.' } };
                }
                let row = records.find(row => row.id === args.p_cliente_id);
                if (!row) { row = { id: `fictitious-${records.length + 1}`, ativo: true }; records.push(row); }
                Object.assign(row, p);
                return { data: row.id, error: null };
              }
              throw new Error(`Unexpected test RPC: ${name}`);
            },
          };
          document.getElementById('gestaoApp').hidden = false;
          document.getElementById('authStatus').hidden = true;
          document.querySelectorAll('[data-area-panel]').forEach(node => { node.hidden = node.id !== 'clientes'; });
          await initClientesPanel({ client, profile: { user_id: 'fictitious-staff' }, canArchive: area === 'admin' });
        }, area);
        const form = page.locator('#clientCreateForm');
        await form.locator('[name=nome]').fill('Pessoa Fictícia');
        await form.locator('[name=telefone]').fill('(31) 90000-0000');
        await form.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
        await page.locator('[data-client-folder]').waitFor();
        const create = await page.evaluate(() => window.testCalls.find(call => call.name === 'bc_cliente_create_v2'));
        assert.equal(create.args.p_payload.cpf, '');
        assert.equal(create.args.p_payload.data_nascimento, '');
        assert.equal(await page.locator('[data-client-new-treatment]').isEnabled(), true);
        assert.equal(await page.locator('[data-client-schedule]').isEnabled(), true);
        // Reveal the editor panel normally opened by the surrounding folder controller.
        await page.evaluate(() => { document.querySelector('[data-client-cadastro-panel]').hidden = false; });
        let edit = page.locator('[data-client-edit-form]');
        await edit.locator('[name=cpf]').fill('123.456.789-00');
        await edit.locator('[name=email]').fill('ficticia@example.invalid');
        await edit.getByRole('button', { name: 'Salvar cadastro', exact: true }).click();
        await page.waitForFunction(() => window.testCalls.filter(call => call.name === 'bc_cliente_update_v2').length === 1 && document.querySelector('[data-client-cadastro-panel]')?.hidden);
        await page.evaluate(() => { document.querySelector('[data-client-cadastro-panel]').hidden = false; });
        edit = page.locator('[data-client-edit-form]');
        assert.equal(await edit.locator('[name=email]').inputValue(), 'ficticia@example.invalid');
        await edit.locator('[name=cpf]').fill('abc');
        await edit.getByRole('button', { name: 'Salvar cadastro', exact: true }).click();
        await edit.locator('[data-client-edit-status][data-kind=error]').waitFor();
        assert.equal(await page.evaluate(() => window.testCalls.filter(call => call.name === 'bc_cliente_update_v2').at(-1).args.p_payload.cpf), 'abc');
        assert.equal(await edit.locator('[name=email]').inputValue(), 'ficticia@example.invalid');
        await form.locator('[name=nome]').fill('Outra Pessoa Fictícia');
        await form.locator('[name=telefone]').fill('31900000001');
        await form.locator('[name=cpf]').fill('abc');
        await form.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
        await page.locator('#clientCreateStatus[data-kind=error]').waitFor();
        assert.equal(await page.evaluate(() => window.testCalls.filter(call => call.name === 'bc_cliente_create_v2').at(-1).args.p_payload.cpf), 'abc');
        assert.equal(await form.locator('[name=nome]').inputValue(), 'Outra Pessoa Fictícia');
        await form.locator('[name=cpf]').fill('');
        await form.locator('[name=nome]').fill('Pessoa Fictícia');
        await form.locator('[name=telefone]').fill('(31) 90000-0000');
        await form.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
        await form.locator('[data-open-duplicate]').waitFor();
        assert.deepEqual(errors, [], `${engine}/${area}: runtime errors`);
        await form.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/agenda/${engine}-${area}-basic-registration.png`, fullPage: true });
        console.log(`PASS ${engine}/${area}: name+phone registration, optional complements, invalid CPF retained, duplicates without birth`);
        await page.close();
      }
    } finally { await browser.close(); }
  }
} finally { server.close(); }
