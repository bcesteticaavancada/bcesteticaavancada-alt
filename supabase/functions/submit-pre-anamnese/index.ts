import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { validateSubmission, type ValidSubmission } from './validation.ts';
import { buildPublicCode } from './public-code.ts';
import { generatePreAnamnesePdf } from './pdf.ts';
import { validateRubricPngDataUrl } from './signature.ts';
import { buildCanonicalSubmissionSnapshot, canonicalStringify, sha256Hex } from './integrity.ts';

const ALLOWED_ORIGINS = new Set([
  'https://bcesteticaavancada.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);
const PDF_TTL_SECONDS = 600;
const MAX_CONTENT_LENGTH = 700_000;
const LOGO_URL = 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/assets/logo-oficial/logo-bc-estetica-sem-fundo.png';

function corsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://bcesteticaavancada.github.io',
    'Access-Control-Allow-Headers': 'content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(origin) },
  });
}

async function fetchLogo(): Promise<Uint8Array | null> {
  try {
    const response = await fetch(LOGO_URL, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function storagePaths(publicCode: string, createdAt: string) {
  const date = new Date(createdAt);
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return { signature: `${yyyy}/${mm}/${publicCode}.png`, pdf: `${yyyy}/${mm}/${publicCode}.pdf` };
}

function patientFromAnswers(row: any) {
  const answers = row.answers || {};
  return {
    name: row.patient_name,
    cpf: row.patient_cpf || '',
    birthDate: String(answers.nascimento || ''),
    age: Number(answers.idade || 0),
    phone: row.patient_phone,
    email: row.patient_email || '',
  };
}

async function signedPdfUrl(supabase: any, pdfPath: string) {
  const { data, error } = await supabase.storage.from('pre-anamnese-pdfs').createSignedUrl(pdfPath, PDF_TTL_SECONDS, { download: true });
  if (error || !data?.signedUrl) throw new Error('Falha ao criar acesso temporário ao PDF.');
  return { pdfUrl: data.signedUrl, pdfExpiresAt: new Date(Date.now() + PDF_TTL_SECONDS * 1000).toISOString() };
}

async function finalizePdf(supabase: any, row: any, signatureBytes: Uint8Array) {
  const paths = storagePaths(row.public_code, row.created_at);
  const logoBytes = await fetchLogo();
  const pdfBytes = await generatePreAnamnesePdf({
    publicCode: row.public_code,
    createdAt: row.created_at,
    rubricConfirmedAt: row.rubric_confirmed_at || row.created_at,
    patient: patientFromAnswers(row),
    procedure: row.procedure,
    answers: row.answers || {},
    consents: row.consents || {},
    signaturePngBytes: signatureBytes,
    logoPngBytes: logoBytes,
  });

  const { error: uploadError } = await supabase.storage.from('pre-anamnese-pdfs').upload(paths.pdf, pdfBytes, {
    contentType: 'application/pdf', upsert: true, cacheControl: '0',
  });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase.from('pre_anamneses').update({ pdf_path: paths.pdf }).eq('id', row.id);
  if (updateError) throw updateError;
  return paths.pdf;
}

async function completeExisting(supabase: any, row: any) {
  let pdfPath = row.pdf_path as string | null;
  if (!pdfPath) {
    if (!row.signature_path) throw new Error('Ficha incompleta: assinatura não localizada.');
    const { data: signatureBlob, error } = await supabase.storage.from('pre-anamnese-signatures').download(row.signature_path);
    if (error || !signatureBlob) throw new Error('Não foi possível recuperar a assinatura da ficha.');
    pdfPath = await finalizePdf(supabase, row, new Uint8Array(await signatureBlob.arrayBuffer()));
  }
  const signed = await signedPdfUrl(supabase, pdfPath);
  return { id: row.id, publicCode: row.public_code, createdAt: row.created_at, ...signed };
}

async function insertSubmission(
  supabase: any,
  payload: ValidSubmission,
  signatureBytes: Uint8Array,
  rubricSha256: string,
) {
  const now = new Date();
  const createdAt = now.toISOString();
  let lastError: any = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const publicCode = buildPublicCode(now);
    const paths = storagePaths(publicCode, createdAt);
    const snapshot = buildCanonicalSubmissionSnapshot({
      publicCode,
      patientName: payload.patient.name,
      patientCpf: payload.patient.cpf,
      procedure: payload.procedure,
      answers: payload.answers,
      consents: payload.consents,
      sourceVersion: payload.sourceVersion,
      rubricSha256,
      confirmedAt: createdAt,
    });
    const payloadSha256 = await sha256Hex(
      new TextEncoder().encode(canonicalStringify(snapshot)),
    );

    const { error: signatureError } = await supabase.storage.from('pre-anamnese-signatures').upload(paths.signature, signatureBytes, {
      contentType: 'image/png', upsert: false, cacheControl: '0',
    });
    if (signatureError) {
      lastError = signatureError;
      if (String(signatureError.message || '').toLowerCase().includes('exists')) continue;
      throw signatureError;
    }

    const { data: row, error: insertError } = await supabase.from('pre_anamneses').insert({
      public_code: publicCode,
      created_at: createdAt,
      status: 'recebida',
      patient_name: payload.patient.name,
      patient_cpf: payload.patient.cpf,
      patient_email: payload.patient.email || null,
      patient_phone: payload.patient.phone,
      procedure: payload.procedure,
      answers: payload.answers,
      consents: payload.consents,
      data_authorization_accepted_at: createdAt,
      signature_path: paths.signature,
      rubric_sha256: rubricSha256,
      payload_sha256: payloadSha256,
      rubric_confirmed_at: createdAt,
      source_version: payload.sourceVersion,
      submission_token: payload.submissionToken,
    }).select('*').single();

    if (!insertError && row) return row;

    await supabase.storage.from('pre-anamnese-signatures').remove([paths.signature]);
    lastError = insertError;
    if (insertError?.code === '23505') {
      const { data: existing } = await supabase.from('pre_anamneses').select('*').eq('submission_token', payload.submissionToken).maybeSingle();
      if (existing) return existing;
      continue;
    }
    throw insertError;
  }
  throw lastError || new Error('Não foi possível gerar um código único para a ficha.');
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin);
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin);

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_CONTENT_LENGTH) return json({ error: 'Conteúdo enviado é muito grande.' }, 413, origin);

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return json({ error: 'JSON inválido.' }, 400, origin); }

  const validation = validateSubmission(raw);
  if (!validation.valid) return json({ error: 'Revise os dados antes de enviar.', errors: validation.errors }, 422, origin);
  const payload = validation.data;

  let rubric: Awaited<ReturnType<typeof validateRubricPngDataUrl>>;
  try {
    rubric = await validateRubricPngDataUrl(payload.signatureDataUrl);
  } catch {
    return json({ error: 'Rubrica de confirmação inválida.', errors: { signatureDataUrl: 'Rubrica PNG inválida.' } }, 422, origin);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Serviço temporariamente indisponível.' }, 503, origin);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data: existing, error: lookupError } = await supabase.from('pre_anamneses').select('*').eq('submission_token', payload.submissionToken).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return json(await completeExisting(supabase, existing), 200, origin);

    const row = await insertSubmission(supabase, payload, rubric.bytes, rubric.sha256);
    const result = await completeExisting(supabase, row);
    return json(result, 201, origin);
  } catch (error) {
    const diagnostic = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? 'database_error')
      : error instanceof Error ? error.name : 'unknown_error';
    console.error('submit-pre-anamnese failed', diagnostic);
    return json({ error: 'Não foi possível concluir o envio agora. Seus dados permanecem salvos neste dispositivo para tentar novamente.' }, 500, origin);
  }
});
