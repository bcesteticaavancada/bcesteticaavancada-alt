import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const agendaHtmlUrl = new URL('../../agenda/index.html', import.meta.url);
const agendaCssUrl = new URL('../../agenda/agenda.css', import.meta.url);
const apiUrl = new URL('../../agenda/js/api.js', import.meta.url);
const calendarUrl = new URL('../../agenda/js/calendar.js', import.meta.url);
const mainUrl = new URL('../../agenda/js/main.js', import.meta.url);
const configUrl = new URL('../../assets/js/bc-public-config.js', import.meta.url);

async function read(url) {
  return readFile(url, 'utf8');
}

test('agenda pública expõe somente os dados mínimos do fluxo de reserva', async () => {
  const html = await read(agendaHtmlUrl);
  assert.match(html, /Procedimento/i);
  assert.match(html, /Profissional/i);
  assert.match(html, /Calendário|Escolha uma data/i);
  assert.match(html, /Horários|horário/i);
  assert.match(html, /Nome/i);
  assert.match(html, /WhatsApp/i);
  assert.match(html, /Confirmar agendamento|Confirmar reserva/i);
  assert.doesNotMatch(html, /CPF/i);
  assert.doesNotMatch(html, /Data de nascimento|Nascimento/i);
});

test('cancelamento e remarcação são orientados para contato com a BC', async () => {
  const html = await read(agendaHtmlUrl);
  assert.match(html, /cancelar|cancelamento/i);
  assert.match(html, /remarcar|remarcação/i);
  assert.match(html, /WhatsApp|fale com a BC/i);
  assert.doesNotMatch(html, /data-cancel-booking|data-reschedule-booking/i);
});

test('sucesso mantém resumo da reserva e ação manual de WhatsApp', async () => {
  const html = await read(agendaHtmlUrl);
  assert.match(html, /data-booking-success/i);
  assert.match(html, /data-success-procedure/i);
  assert.match(html, /data-success-professional/i);
  assert.match(html, /data-success-date/i);
  assert.match(html, /data-success-time/i);
  assert.match(html, /data-success-whatsapp/i);
});

test('assets da agenda são relativos e compatíveis com o subpath do GitHub Pages', async () => {
  const html = await read(agendaHtmlUrl);
  assert.match(html, /href=["']\.\.\/styles\.css["']/i);
  assert.match(html, /href=["']\.\/agenda\.css["']/i);
  assert.match(html, /src=["']\.\/js\/main\.js["']/i);
  assert.doesNotMatch(html, /(?:href|src)=["']\/(?!\/)/i);
});

test('config público centraliza WhatsApp e endpoint sem segredo privilegiado', async () => {
  const config = await read(configUrl);
  assert.match(config, /BC_WHATSAPP_NUMBER/);
  assert.match(config, /PUBLIC_AGENDA_FUNCTION_URL/);
  assert.match(config, /tpqsmerlxquyrzrjbogj\.supabase\.co\/functions\/v1\/public-agenda/);
  assert.doesNotMatch(config, /service[_-]?role|SUPABASE_SECRET|secret[_-]?key/i);
});

test('API pública usa POST único, trata conflitos e nunca envia Bearer privilegiado', async () => {
  const api = await read(apiUrl);
  for (const action of ['catalog', 'professionals', 'month', 'slots', 'book']) {
    assert.match(api, new RegExp(`['\"]${action}['\"]`));
  }
  assert.match(api, /method:\s*['"]POST['"]/i);
  assert.match(api, /409/);
  assert.match(api, /429/);
  assert.match(api, /5\d\d|>=\s*500|status\s*>?=\s*500/i);
  assert.doesNotMatch(api, /Authorization\s*[:=].*Bearer/i);
});

test('WhatsApp só é aberto depois da confirmação 2xx do booking', async () => {
  const main = await read(mainUrl);
  const submitStart = main.search(/form\.addEventListener\(['"]submit['"]/i);
  assert.ok(submitStart >= 0, 'fluxo de submit deve existir');

  const submitFlow = main.slice(submitStart);
  const bookCall = submitFlow.search(/await\s+api\.book\s*\(/i);
  const successCall = submitFlow.search(/showSuccess\s*\(/i);
  const whatsAppCall = submitFlow.search(/openWhatsApp\s*\(/i);

  assert.ok(bookCall >= 0, 'booking deve aguardar a resposta da API');
  assert.ok(successCall > bookCall, 'sucesso só pode ser exibido depois do booking confirmado');
  assert.ok(whatsAppCall > successCall, 'WhatsApp só pode ser aberto depois do booking confirmado e do card de sucesso');
});

test('CSS da agenda é mobile-first e preserva foco visível', async () => {
  const css = await read(agendaCssUrl);
  assert.match(css, /:focus-visible/i);
  assert.match(css, /@media\s*\(min-width:/i);
  assert.match(css, /grid/i);
  assert.match(css, /overflow-wrap|word-break/i);
});
