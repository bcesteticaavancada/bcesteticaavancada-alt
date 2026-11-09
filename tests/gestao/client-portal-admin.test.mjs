import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { bindClientPortalControls } from '../../gestao/js/client-portal-admin.js';
import { renderClientFolder } from '../../gestao/js/clientes-folder.js';

const record = { id: 'cliente-ficticia', nome: 'Cliente Fictícia', ativo: true };
const nextTick = () => new Promise((resolve) => setImmediate(resolve));

test('os controles aparecem na pasta administrativa e não permitem emissão em cadastro arquivado', () => {
  assert.doesNotMatch(renderClientFolder({ client: record }), /data-portal-issue/);
  assert.match(renderClientFolder({ client: record, canManagePortal: true }), /data-portal-issue/);
  const archived = renderClientFolder({ client: { ...record, ativo: false }, canManagePortal: true });
  assert.doesNotMatch(archived, /data-portal-issue/);
  assert.match(archived, /Reative o cadastro/);
});

test('gera e revoga somente para o cadastro aberto e apaga o link exibido', async () => {
  const { document } = parseHTML(renderClientFolder({ client: record, canManagePortal: true }));
  const host = document.querySelector('[data-client-portal-controls]');
  const calls = [];
  const token = 'b'.repeat(64);
  bindClientPortalControls({
    host,
    clienteId: record.id,
    client: {
      async rpc(name, args) {
        calls.push([name, args]);
        const data = name.endsWith('issue') ? { token, expires_at: '2026-12-10T14:00:00Z' } : true;
        return { data };
      },
    },
  });
  const link = host.querySelector('[data-portal-link]');
  host.querySelector('[data-portal-issue]').click();
  await nextTick();
  assert.equal(link.hidden, false);
  assert.match(link.querySelector('input').value, new RegExp('/cliente/#acesso=' + token + '$'));
  host.querySelector('[data-portal-revoke]').click();
  await nextTick();
  assert.equal(link.hidden, true);
  assert.equal(link.querySelector('input').value, '');
  assert.deepEqual(calls, [
    ['bc_client_portal_issue', { p_cliente_id: record.id }],
    ['bc_client_portal_revoke', { p_cliente_id: record.id }],
  ]);
});
