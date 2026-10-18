import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { validateSubmission, type ValidSubmission } from './validation.ts';
import { buildPublicCode } from './public-code.ts';
import { generatePreAnamnesePdf } from './pdf.ts';
import { validateRubricPngDataUrl } from './signature.ts';
import { canonicalSubmission, sha256Hex } from './integrity.ts';
import { buildPdfDownloadFilename } from './download-filename.js';

const ALLOWED_ORIGINS = new Set([
  'https://bcesteticaavancada.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);
const PDF_TTL_SECONDS = 600;
const MAX_CONTENT_LENGTH = 3_000_000;
const BUCKET = 'bc-prontuario-private';
const TABLE = 'bc_pre_anamneses';
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
  return { signature: `pre-anamneses/${yyyy}/${mm}/${publicCode}/rubrica.png`, pdf: `pre-anamneses/${yyyy}/${mm}/${publicCode}/ficha.pdf` };
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

async function signedPdfUrl(supabase: any, pdfPath: string, downloadFilename: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(
    pdfPath,
    PDF_TTL_SECONDS,
    { download: downloadFilename },
  );
  if (error || !data?.signedUrl) throw new Error('Falha ao criar acesso temporário ao PDF.');
  return { pdfUrl: data.signedUrl, pdfExpiresAt: new Date(Date.now() + PDF_TTL_SECONDS * 1000).toISOString() };
}

export async function finalizePdf(supabase: any, row: any, signatureBytes: Uint8Array, generate = generatePreAnamnesePdf, logo = fetchLogo) {
  const paths = storagePaths(row.public_code, row.created_at);
  const logoBytes = await logo();
  const pdfBytes = await generate({
    publicCode: row.public_code,
    createdAt: row.created_at,
    patient: patientFromAnswers(row),
    procedure: row.procedure,
    answers: row.answers || {},
    consents: row.consents || {},
    signaturePngBytes: signatureBytes,
    logoPngBytes: logoBytes,
    rubricSha256: row.rubric_sha256 || '',
    rubricConfirmedAt: row.rubric_confirmed_at || row.created_at,
  });

  const hash = await sha256Hex(pdfBytes);
  const pdfPath = paths.pdf.replace('ficha.pdf', `ficha-${hash}.pdf`);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBytes, {
    contentType: 'application/pdf', upsert: false, cacheControl: '0',
  });
  if (uploadError && !/already exists|duplicate/i.test(String(uploadError.message || ''))) throw uploadError;

  const { data: updated, error: updateError } = await supabase.from(TABLE)
    .update({ pdf_path: pdfPath, pdf_sha256: hash, pdf_size_bytes: pdfBytes.byteLength })
    .eq('id', row.id).is('pdf_path', null).select('pdf_path').maybeSingle();
  if (updateError) throw updateError;
  if (updated?.pdf_path) return updated.pdf_path;
  const {data: winner, error: lookupError} = await supabase.from(TABLE).select('pdf_path').eq('id', row.id).single();
  if (lookupError || !winner?.pdf_path) throw lookupError || new Error('PDF ainda em preparação.');
  if (winner.pdf_path !== pdfPath) await supabase.storage.from(BUCKET).remove([pdfPath]);
  return winner.pdf_path;
}

async function completeExisting(supabase: any, row: any) {
  let pdfPath = row.pdf_path as string | null;
  if (!pdfPath) {
    if (!row.signature_path) throw new Error('Ficha incompleta: rubrica não localizada.');
    const { data: signatureBlob, error } = await supabase.storage.from(BUCKET).download(row.signature_path);
    if (error || !signatureBlob) throw new Error('Não foi possível recuperar a rubrica da ficha.');
    pdfPath = await finalizePdf(supabase, row, new Uint8Array(await signatureBlob.arrayBuffer()));
  }
  const downloadFilename = buildPdfDownloadFilename(row.patient_name, row.created_at);
  const signed = await signedPdfUrl(supabase, pdfPath, downloadFilename);
  return { id: row.id, publicCode: row.public_code, createdAt: row.created_at, ...signed };
}

async function insertSubmission(supabase: any, payload: ValidSubmission, signatureBytes: Uint8Array, submissionHash: string) {
  const now = new Date();
  const rubricSha256 = await sha256Hex(signatureBytes);
  let lastError: any = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const publicCode = buildPublicCode(now);
    const createdAt = now.toISOString();
    const paths = storagePaths(publicCode, createdAt);
    const payloadSha256 = await sha256Hex(canonicalSubmission({
      publicCode,
      patientName: payload.patient.name,
      patientCpf: payload.patient.cpf,
      procedure: payload.procedure,
      answers: payload.answers,
      consents: payload.consents,
      sourceVersion: payload.sourceVersion,
      rubricSha256,
      confirmedAt: createdAt,
    }));

    const { error: signatureError } = await supabase.storage.from(BUCKET).upload(paths.signature, signatureBytes, {
      contentType: 'image/png', upsert: false, cacheControl: '0',
    });
    if (signatureError) {
      lastError = signatureError;
      if (String(signatureError.message || '').toLowerCase().includes('exists')) continue;
      throw signatureError;
    }

    const { data: row, error: insertError } = await supabase.from(TABLE).insert({
      public_code: publicCode,
      status: 'recebida',
      patient_name: payload.patient.name,
      patient_cpf: payload.patient.cpf,
      patient_email: payload.patient.email || null,
      patient_phone: payload.patient.phone,
      procedure: payload.procedure,
      answers: payload.answers,
      consents: payload.consents,
      signature_path: paths.signature,
      source_version: payload.sourceVersion,
      submission_token: payload.submissionToken,
      submission_hash: submissionHash,
      created_at: createdAt,
      data_authorization_accepted_at: createdAt,
      rubric_sha256: rubricSha256,
      payload_sha256: payloadSha256,
      rubric_confirmed_at: createdAt,
    }).select('*').single();

    if (!insertError && row) return row;

    await supabase.storage.from(BUCKET).remove([paths.signature]);
    lastError = insertError;
    if (insertError?.code === '23505') {
      const { data: existing } = await supabase.from(TABLE).select('*').eq('submission_token', payload.submissionToken).maybeSingle();
      if (existing) return existing;
      continue;
    }
    throw insertError;
  }
  throw lastError || new Error('Não foi possível gerar um código único para a ficha.');
}

function createAdminClient() {
  const url=Deno.env.get('SUPABASE_URL');
  let key: string | undefined;
  try { key=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default; } catch { /* legacy fallback */ }
  key ||= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
}

export async function readLimitedJson(req: Request) {
  const reader=req.body?.getReader();
  if(!reader) throw new Error('JSON inválido.');
  const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>MAX_CONTENT_LENGTH){await reader.cancel();throw new Error('payload_too_large');}chunks.push(value);}
  } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function createPreAnamneseHandler(getAdmin = createAdminClient) {
return async (req: Request) => {
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
  try { raw = await readLimitedJson(req); }
  catch(error) { return json({ error: 'Conteúdo inválido ou muito grande.' }, error instanceof Error && error.message==='payload_too_large' ? 413 : 400, origin); }

  const validation = validateSubmission(raw);
  if (!validation.valid) return json({ error: 'Revise os dados antes de enviar.', errors: validation.errors }, 422, origin);
  const payload = validation.data;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = validateRubricPngDataUrl(payload.signatureDataUrl).bytes;
  } catch {
    return json({ error: 'Rubrica de confirmação inválida.', errors: { signatureDataUrl: 'Rubrica PNG inválida.' } }, 422, origin);
  }

  const supabase = getAdmin();
  if (!supabase) return json({ error: 'Serviço temporariamente indisponível.' }, 503, origin);
  const submissionHash=await sha256Hex(new TextEncoder().encode(JSON.stringify({patient:payload.patient,procedure:payload.procedure,answers:payload.answers,consents:payload.consents,sourceVersion:payload.sourceVersion,rubric:await sha256Hex(signatureBytes)})));

  try {
    const salt=Deno.env.get('PUBLIC_AGENDA_RATE_LIMIT_SALT');
    if(!salt || salt.length<16) return json({error:'Serviço temporariamente indisponível.'},503,origin);
    const originHash=await sha256Hex(new TextEncoder().encode(salt+':'+(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown')));
    const {data:allowed,error:rateError}=await supabase.rpc('bc_pre_anamnese_rate_limit',{p_origin_hash:originHash});
    if(rateError)throw rateError;
    if(allowed!==true)return json({error:'Muitas tentativas. Aguarde alguns minutos e tente novamente.'},429,origin);
    const { data: existing, error: lookupError } = await supabase.from(TABLE).select('*').eq('submission_token', payload.submissionToken).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      if(existing.submission_hash!==submissionHash)return json({error:'Este envio já foi recebido com outros dados. Inicie uma nova ficha.'},409,origin);
      return json(await completeExisting(supabase, existing), 200, origin);
    }

    const row = await insertSubmission(supabase, payload, signatureBytes, submissionHash);
    if(row.submission_hash!==submissionHash)return json({error:'Este envio já foi recebido com outros dados. Inicie uma nova ficha.'},409,origin);
    const result = await completeExisting(supabase, row);
    return json(result, 201, origin);
  } catch (error) {
    console.error('submit-pre-anamnese failed', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Não foi possível concluir o envio agora. Mantenha esta página aberta e tente novamente, ou fale com a BC pelo WhatsApp.' }, 500, origin);
  }
};
}

if(import.meta.main)Deno.serve(createPreAnamneseHandler());
