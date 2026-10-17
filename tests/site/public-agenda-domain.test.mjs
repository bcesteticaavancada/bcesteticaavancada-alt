import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone,
  sanitizePublicAgendaPayload,
  validatePublicAgendaPayload,
} from '../../supabase/functions/public-agenda/domain.js';

test('telefone público é normalizado para dígitos e rejeita entradas implausíveis', () => {
  assert.equal(normalizePhone('(31) 99999-0000'), '31999990000');
  assert.equal(normalizePhone('+55 (31) 99999-0000'), '5531999990000');
  assert.throws(() => normalizePhone('1234'), /telefone|whatsapp/i);
  assert.throws(() => normalizePhone('abc'), /telefone|whatsapp/i);
});

test('honeypot preenchido rejeita booking sem ecoar conteúdo', () => {
  assert.throws(() => validatePublicAgendaPayload({
    action:'book', procedureId:'11111111-1111-4111-8111-111111111111', professionalId:'22222222-2222-4222-8222-222222222222',
    date:'2026-10-20', time:'14:30', name:'Cliente Teste', phone:'31999990000', website:'spam.example',
  }), /requisição inválida/i);
});

test('ação desconhecida é rejeitada', () => {
  assert.throws(() => validatePublicAgendaPayload({ action:'delete_all' }), /ação inválida/i);
});

test('overview aceita somente mês civil e elimina identidades e filtros internos', () => {
  assert.deepEqual(sanitizePublicAgendaPayload({ action:'overview', month:'2027-10',
    procedureId:'PRIVATE', professionalId:'PRIVATE', patient_name:'PRIVATE', internal_note:'PRIVATE' }),
  { action:'overview', month:'2027-10' });
  for (const month of [undefined, '2027-13', '2027-1', '2027-10-01']) {
    assert.throws(() => validatePublicAgendaPayload({ action:'overview', month }), /mês inválido/i);
  }
});

test('month e date precisam de formato civil estrito', () => {
  assert.throws(() => validatePublicAgendaPayload({ action:'month', procedureId:'11111111-1111-4111-8111-111111111111', professionalId:'22222222-2222-4222-8222-222222222222', month:'20/10/2026' }), /mês inválido/i);
  assert.throws(() => validatePublicAgendaPayload({ action:'slots', procedureId:'11111111-1111-4111-8111-111111111111', professionalId:'22222222-2222-4222-8222-222222222222', date:'31-10-2026' }), /data inválida/i);
});

test('booking exige nome humano mínimo e horário HH:MM', () => {
  const base = { action:'book', procedureId:'11111111-1111-4111-8111-111111111111', professionalId:'22222222-2222-4222-8222-222222222222', date:'2026-10-20', time:'14:30', phone:'31999990000', website:'' };
  assert.throws(() => validatePublicAgendaPayload({ ...base, name:'A' }), /nome/i);
  assert.throws(() => validatePublicAgendaPayload({ ...base, name:'Ana', time:'2pm' }), /horário/i);
});

test('DTO sanitizado mantém somente campos públicos permitidos', () => {
  const result = sanitizePublicAgendaPayload({
    action:'book', procedureId:'11111111-1111-4111-8111-111111111111', professionalId:'22222222-2222-4222-8222-222222222222',
    date:'2026-10-20', time:'14:30', name:'  Ana Teste  ', phone:'(31) 99999-0000', website:'',
    cliente_id:'forbidden', internal_note:'forbidden', reason:'forbidden', observacao_administrativa:'forbidden', created_by:'forbidden',
  });
  assert.deepEqual(result, {
    action:'book', procedureId:'11111111-1111-4111-8111-111111111111', professionalId:'22222222-2222-4222-8222-222222222222',
    date:'2026-10-20', time:'14:30', name:'Ana Teste', phone:'31999990000', website:'',
  });
  for (const forbidden of ['cliente_id','internal_note','reason','observacao_administrativa','created_by']) assert.equal(forbidden in result, false);
});

test('ações de leitura são reduzidas ao DTO mínimo de cada contrato', () => {
  assert.deepEqual(sanitizePublicAgendaPayload({ action:'catalog', junk:'x' }), { action:'catalog' });
  assert.deepEqual(sanitizePublicAgendaPayload({ action:'professionals', procedureId:'11111111-1111-4111-8111-111111111111', junk:'x' }), { action:'professionals', procedureId:'11111111-1111-4111-8111-111111111111' });
  assert.deepEqual(sanitizePublicAgendaPayload({ action:'month', procedureId:'11111111-1111-4111-8111-111111111111', professionalId:'22222222-2222-4222-8222-222222222222', month:'2026-10', junk:'x' }), { action:'month', procedureId:'11111111-1111-4111-8111-111111111111', professionalId:'22222222-2222-4222-8222-222222222222', month:'2026-10' });
});
