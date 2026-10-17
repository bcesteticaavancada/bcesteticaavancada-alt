import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAdminSchedulePanel } from '../../gestao/js/admin-schedule.js';
import { renderCollaboratorSchedulePanel } from '../../gestao/js/colaborador-schedule.js';

for (const [role, render] of [['admin', renderAdminSchedulePanel], ['collaborator', renderCollaboratorSchedulePanel]]) {
  test(`${role}: formulário só oferece tipos de bloqueio aceitos pelo banco`, () => {
    const html = render();
    const select = html.match(new RegExp(`<select[^>]*id="${role}ScheduleBlockType"[^>]*>([\\s\\S]*?)</select>`));
    assert.ok(select, 'Tipo do bloqueio deve ser uma lista de opções válidas');
    const values = [...select[1].matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(values, ['compromisso', 'almoco', 'reuniao', 'preparacao_manutencao', 'outro']);
  });
}
