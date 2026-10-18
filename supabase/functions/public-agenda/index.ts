import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { validateRequest, type PublicAgendaAction } from './validation.ts';

const ALLOWED_ORIGINS = new Set([
  'https://bcesteticaavancada.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);
const MAX_CONTENT_LENGTH = 16_384;
const CLINIC_TIME_ZONE = 'America/Sao_Paulo';
const SLOT_TAKEN_MESSAGE = 'Esse horário acabou de ser reservado. Escolha outro horário disponível.';
const RATE_LIMIT_MESSAGE = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
const GENERIC_MESSAGE = 'Não foi possível concluir agora. Fale com a BC pelo WhatsApp.';

type RpcError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type RpcResponse = {
  data: unknown;
  error: RpcError | null;
};

type SupabaseAdmin = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResponse>;
};

function corsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : 'https://bcesteticaavancada.github.io',
    'Access-Control-Allow-Headers': 'content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}

function readSecretKey(): string | null {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const key = parsed?.default;
    return typeof key === 'string' && key.trim() ? key.trim() : null;
  } catch {
    return null;
  }
}

function createAdminClient(): SupabaseAdmin | null {
  const url = Deno.env.get('SUPABASE_URL');
  const secretKey = readSecretKey();
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseAdmin;
}

async function rpc(admin: SupabaseAdmin, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw error;
  return data;
}

function safeArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function buildOriginHash(req: Request): Promise<string> {
  const salt = Deno.env.get('PUBLIC_AGENDA_RATE_LIMIT_SALT');
  if (!salt || salt.length < 16) throw new Error('rate_limit_config_missing');
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const payload = new TextEncoder().encode(`${salt}:${forwarded}`);
  return hex(await crypto.subtle.digest('SHA-256', payload));
}

function localPartsAt(instantMs: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(instantMs));
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function clinicLocalDateTimeToIso(localDate: string, localTime: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = targetAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = localPartsAt(guess);
    const representedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const delta = targetAsUtc - representedAsUtc;
    if (delta === 0) break;
    guess += delta;
  }

  const check = localPartsAt(guess);
  const matches = Number(check.year) === year
    && Number(check.month) === month
    && Number(check.day) === day
    && Number(check.hour) === hour
    && Number(check.minute) === minute;
  if (!matches) throw new Error('invalid_clinic_time');
  return new Date(guess).toISOString();
}

function publicDbError(error: unknown): { status: number; message: string } | null {
  const candidate = (error ?? {}) as RpcError;
  const code = String(candidate.code ?? '');
  const message = String(candidate.message ?? '').toLowerCase();
  if(message.includes('request_key_mismatch')) return {status:409,message:'Esta tentativa já foi recebida com outros dados. Revise sua reserva com a BC.'};
  if(message.includes('request_booking_changed')) return {status:409,message:'A reserva desta tentativa foi alterada pela BC. Consulte a equipe antes de reservar novamente.'};
  if (message.includes('slot_unavailable') || code === '23P01') {
    return { status: 409, message: SLOT_TAKEN_MESSAGE };
  }
  if (message.includes('rate_limit_exceeded') || code === '53300') {
    return { status: 429, message: RATE_LIMIT_MESSAGE };
  }
  if (code === '22023') {
    return { status: 422, message: 'Dados de agendamento inválidos. Atualize a disponibilidade e tente novamente.' };
  }
  return null;
}

async function catalog(admin: SupabaseAdmin) {
  const rows = safeArray(await rpc(admin, 'bc_public_agenda_catalog'));
  return rows.map((row) => ({
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    durationMinutes: Number(row.duration ?? 0),
  })).filter((row) => row.id && row.name && row.durationMinutes > 0);
}

async function professionals(admin: SupabaseAdmin, procedureId: string) {
  const rows = safeArray(await rpc(admin, 'bc_public_agenda_professionals', {
    p_procedimento_id: procedureId,
  }));
  return rows.map((row) => ({ id: String(row.id ?? ''), name: String(row.name ?? '') }))
    .filter((row) => row.id && row.name);
}

async function executeAction(admin: SupabaseAdmin, req: Request, payload: PublicAgendaAction) {
  switch (payload.action) {
    case 'catalog': {
      return { status: 200, body: { procedures: await catalog(admin) } };
    }
    case 'professionals': {
      return { status: 200, body: { professionals: await professionals(admin, payload.procedureId) } };
    }
    case 'overview':
    case 'month': {
      const rows = safeArray(await rpc(admin,
        payload.action === 'overview' ? 'bc_public_agenda_overview' : 'bc_public_agenda_month', {
        ...(payload.action === 'month' ? {
          p_professional_user_id: payload.professionalId,
          p_procedimento_id: payload.procedureId,
        } : {}),
        p_month: `${payload.month}-01`,
      }));
      return {
        status: 200,
        body: {
          month: payload.month,
          days: rows.map((row) => ({
            date: String(row.date ?? '').slice(0, 10),
            available: row.available === true,
            state: row.available === true ? 'available' : 'unavailable',
          })).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date)),
        },
      };
    }
    case 'slots': {
      const rows = safeArray(await rpc(admin, 'bc_public_agenda_slots', {
        p_professional_user_id: payload.professionalId,
        p_procedimento_id: payload.procedureId,
        p_local_date: payload.date,
      }));
      return {
        status: 200,
        body: {
          slots: rows.map((row) => String(row.time ?? '')).filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)),
        },
      };
    }
    case 'book': {
      if(payload.requestKey) {
        const booking=safeObject(await rpc(admin,'bc_public_agenda_book_v2',{
          p_request_key:payload.requestKey,p_name:payload.name,p_phone:payload.phone,
          p_professional_user_id:payload.professionalId,p_procedimento_id:payload.procedureId,
          p_inicio:clinicLocalDateTimeToIso(payload.date,payload.time),p_origin_hash:await buildOriginHash(req),
        }));
        if(typeof booking.error_code==='string')throw {code:booking.error_code,message:String(booking.error||'')};
        if(!booking.appointment_id)throw new Error('missing_booking_confirmation');
        return {status:201,body:{booking:{id:String(booking.appointment_id),procedureName:String(booking.procedure_name||''),professionalName:String(booking.professional_name||''),date:payload.date,time:payload.time}}};
      }
      const [procedures, eligibleProfessionals] = await Promise.all([
        catalog(admin),
        professionals(admin, payload.procedureId),
      ]);
      const procedure = procedures.find((item) => item.id === payload.procedureId);
      const professional = eligibleProfessionals.find((item) => item.id === payload.professionalId);
      if (!procedure || !professional) {
        return { status: 422, body: { error: 'Procedimento ou profissional indisponível para agendamento online.' } };
      }

      const originHash = await buildOriginHash(req);
      const startAt = clinicLocalDateTimeToIso(payload.date, payload.time);
      const booking = safeObject(await rpc(admin, 'bc_public_agenda_book', {
        p_name: payload.name,
        p_phone: payload.phone,
        p_professional_user_id: payload.professionalId,
        p_procedimento_id: payload.procedureId,
        p_inicio: startAt,
        p_origin_hash: originHash,
      }));
      if (typeof booking.error_code === 'string') {
        throw { code: booking.error_code, message: String(booking.error ?? '') };
      }
      return {
        status: 201,
        body: {
          booking: {
            id: String(booking.appointment_id ?? ''),
            procedureName: procedure.name,
            professionalName: professional.name,
            date: payload.date,
            time: payload.time,
          },
        },
      };
    }
  }
}

export function createPublicAgendaHandler(getAdmin: () => SupabaseAdmin | null = createAdminClient) {
return async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin);
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin);

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_CONTENT_LENGTH) return json({ error: 'Requisição muito grande.' }, 413, origin);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400, origin);
  }

  const validation = validateRequest(raw);
  if (!validation.ok) return json({ error: validation.error }, 422, origin);

  const admin = getAdmin();
  if (!admin) return json({ error: 'Serviço temporariamente indisponível. Fale com a BC pelo WhatsApp.' }, 503, origin);

  try {
    const result = await executeAction(admin, req, validation.data);
    return json(result.body, result.status, origin);
  } catch (error) {
    const mapped = publicDbError(error);
    if (mapped) return json({ error: mapped.message }, mapped.status, origin);
    console.error('public-agenda failed', {
      action: validation.data.action,
      code: typeof (error as RpcError)?.code === 'string' ? (error as RpcError).code : 'unknown',
    });
    return json({ error: GENERIC_MESSAGE }, 500, origin);
  }
};
}

if (import.meta.main) Deno.serve(createPublicAgendaHandler());
