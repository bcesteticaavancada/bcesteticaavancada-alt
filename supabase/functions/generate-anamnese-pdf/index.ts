import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import { buildAnamnesePdf } from './pdf.ts';

const BUCKET = 'bc-prontuario-private';
const ALLOWED_ORIGINS = new Set([
  'https://bcesteticaavancada.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);

function corsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://bcesteticaavancada.github.io',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
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

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function downloadBytes(supabase: any, storagePath: string | null | undefined): Promise<Uint8Array | null> {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin);
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin);

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return json({ error: 'Autenticação obrigatória.' }, 401, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) return json({ error: 'Serviço temporariamente indisponível.' }, 503, origin);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let documentId: string | null = null;
  try {
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.id) return json({ error: 'Sessão inválida.' }, 401, origin);

    const { data: staff, error: staffError } = await service
      .from('staff_profiles')
      .select('user_id,role,active')
      .eq('user_id', user.id)
      .maybeSingle();
    if (staffError) throw staffError;
    if (!staff?.active || !['admin', 'colaborador'].includes(staff.role)) {
      return json({ error: 'Acesso restrito à equipe clínica ativa.' }, 403, origin);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'JSON inválido.' }, 400, origin);
    }
    const keys = Object.keys(body || {});
    if (keys.length !== 1 || keys[0] !== 'documentId' || !isUuid(body.documentId)) {
      return json({ error: 'Informe somente um documentId válido.' }, 400, origin);
    }
    documentId = body.documentId;

    const { data: document, error: documentError } = await service
      .from('clinical_documents')
      .select('*')
      .eq('id', documentId)
      .single();
    if (documentError || !document) return json({ error: 'Documento clínico não encontrado.' }, 404, origin);

    if (document.status === 'emitido' && document.storage_path) {
      return json({ ok: true, documentId, status: 'emitido', storagePath: document.storage_path, idempotent: true }, 200, origin);
    }
    if (!['pronto_para_pdf', 'erro_pdf'].includes(document.status)) {
      return json({ error: 'Documento ainda não está pronto para geração do PDF.' }, 409, origin);
    }

    const { data: locked, error: lockError } = await service
      .from('clinical_documents')
      .update({ status: 'gerando_pdf' })
      .eq('id', documentId)
      .in('status', ['pronto_para_pdf', 'erro_pdf'])
      .select('id')
      .maybeSingle();
    if (lockError) throw lockError;
    if (!locked) {
      const { data: latest } = await service.from('clinical_documents').select('status,storage_path').eq('id', documentId).maybeSingle();
      if (latest?.status === 'emitido' && latest.storage_path) {
        return json({ ok: true, documentId, status: 'emitido', storagePath: latest.storage_path, idempotent: true }, 200, origin);
      }
      return json({ error: 'O documento está sendo processado por outra solicitação.' }, 409, origin);
    }

    const [clientResult, anamneseResult, answersResult, signaturesResult, photoResult] = await Promise.all([
      service.from('clientes').select('*').eq('id', document.cliente_id).single(),
      service.from('anamneses_gerais').select('*').eq('id', document.source_id).single(),
      service.from('anamnese_respostas').select('question_key,answer_json,updated_at').eq('anamnese_id', document.source_id).order('updated_at', { ascending: true }),
      service.from('clinical_signatures').select('*').eq('document_id', documentId).order('signed_at', { ascending: true }),
      service.from('cliente_identificacao_fotos').select('storage_path,mime_type').eq('cliente_id', document.cliente_id).eq('atual', true).maybeSingle(),
    ]);

    if (clientResult.error) throw clientResult.error;
    if (anamneseResult.error) throw anamneseResult.error;
    if (answersResult.error) throw answersResult.error;
    if (signaturesResult.error) throw signaturesResult.error;
    if (photoResult.error) throw photoResult.error;

    const signatures = [];
    for (const signature of signaturesResult.data || []) {
      const signatureBytes = await downloadBytes(service, signature.storage_path);
      if (!signatureBytes) throw new Error('Assinatura privada não encontrada.');
      const signatureHash = await sha256Hex(signatureBytes);
      if (signatureHash !== String(signature.sha256 || '').trim().toLowerCase()) {
        throw new Error('Integridade da assinatura inválida.');
      }
      signatures.push({ ...signature, bytes: signatureBytes });
    }

    const photoBytes = await downloadBytes(service, photoResult.data?.storage_path);
    const pdfBytes = await buildAnamnesePdf({
      document,
      client: clientResult.data,
      anamnese: anamneseResult.data,
      answers: answersResult.data || [],
      signatures,
      photoBytes,
      photoMimeType: photoResult.data?.mime_type || null,
    });

    const sha256 = await sha256Hex(pdfBytes);
    const storagePath = `documentos/anamnese/${document.cliente_id}/${document.id}-v${document.document_version}.pdf`;
    const { error: uploadError } = await service.storage.from(BUCKET).upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '0',
    });
    if (uploadError) throw uploadError;

    const generatedAt = new Date().toISOString();
    const { error: updateError } = await service
      .from('clinical_documents')
      .update({ status: 'emitido', storage_path: storagePath, sha256, generated_at: generatedAt })
      .eq('id', documentId);
    if (updateError) throw updateError;

    const { error: auditError } = await service.from('audit_log').insert({
      actor_user_id: user.id,
      action: 'clinical_document_pdf_generated',
      entity_type: 'clinical_documents',
      entity_id: documentId,
      new_data: { storage_path: storagePath, sha256 },
    });
    if (auditError) console.error('audit pdf generation failed', auditError.message);

    return json({ ok: true, documentId, status: 'emitido', storagePath, sha256, generatedAt }, 200, origin);
  } catch (error) {
    console.error('generate-anamnese-pdf failed', error instanceof Error ? error.message : 'unknown error');
    if (documentId) {
      await service.from('clinical_documents').update({ status: 'erro_pdf' }).eq('id', documentId).eq('status', 'gerando_pdf');
    }
    return json({ error: 'Não foi possível gerar o PDF agora. O documento e as assinaturas foram preservados para nova tentativa.' }, 500, origin);
  }
});
