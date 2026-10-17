import test from 'node:test';
import assert from 'node:assert/strict';
const origin = await import('../../gestao/js/agenda-origin.js').catch(() => ({}));
import * as api from '../../gestao/js/agenda-api.js';
import {readFile} from 'node:fs/promises';

test('canal separado tem precedência e mantém origens legadas internas', () => {
  assert.equal(typeof origin.agendaOriginKind, 'function');
  for (const value of ['agenda','encaixe','interno',null]) assert.equal(origin.agendaOriginKind({origem:value}), 'internal');
  assert.equal(origin.agendaOriginKind({origem:'site'}), 'site');
  assert.equal(origin.agendaOriginKind({origem:'agenda',booking_channel:'site'}), 'site');
  assert.equal(origin.agendaOriginLabel({booking_channel:'site'}), 'Site');
  assert.equal(origin.agendaOriginLabel({origem:'encaixe'}), 'Interna');
  assert.throws(() => origin.normalizeAgendaView('other'), /visão/i);
});

test('uma RPC aplica filtros de canal sem receber identidade de autorização do navegador', async () => {
  assert.equal(typeof api.listAppointments, 'function');
  const calls=[];
  const client={from(){throw Error('Não deve listar tabelas');},async rpc(...args){calls.push(args);return {data:[{id:'a1',booking_channel:'site'}],error:null};}};
  for (const value of ['all','site','internal']) {
    const rows=await api.listAppointments({client,fromIso:'2026-10-15T03:00:00Z',toIso:'2026-10-16T03:00:00Z',origin:value,userId:'forjado'});
    assert.equal(rows[0].id,'a1');
    assert.deepEqual(calls.at(-1),['bc_agenda_list',{p_from:'2026-10-15T03:00:00Z',p_to:'2026-10-16T03:00:00Z',p_origin:value}]);
  }
  await assert.rejects(() => api.listAppointments({client,fromIso:'A',toIso:'B',origin:'other'}), /visão/i);
});

test('telas administrativa e colaboradora oferecem as três visões', async () => {
  for(const page of ['admin','colaborador']) {
    const html=await readFile(new URL(`../../gestao/${page}/index.html`,import.meta.url),'utf8');
    for(const [value,label] of [['all','Geral'],['site','Site'],['internal','Interna']]) assert.match(html,new RegExp(`value="${value}"[^>]*>${label}<`));
  }
});
