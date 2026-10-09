import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationForRole, ROLE_DESTINATIONS } from '../../gestao/js/routes.js';

test('known roles map to their isolated destinations', () => {
  assert.equal(ROLE_DESTINATIONS.admin, '../admin/');
  assert.equal(ROLE_DESTINATIONS.colaborador, '../colaborador/');
  assert.equal(destinationForRole('admin'), '../admin/');
  assert.equal(destinationForRole('colaborador'), '../colaborador/');
});

test('unknown or empty roles do not receive a destination', () => {
  for (const role of ['', '   ', 'financeiro', null, undefined]) {
    assert.equal(destinationForRole(role), null);
  }
});
