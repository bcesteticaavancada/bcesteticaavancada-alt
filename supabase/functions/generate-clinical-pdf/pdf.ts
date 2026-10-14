import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type AnyRecord = Record<string, unknown>;
type SignatureSnapshot = AnyRecord & {
  signer_kind?: string;
  signer_name?: string;
  signer_profissao?: string | null;
  signer_conselho?: string | null;
  signer_registro?: string | null;
  signed_at?: string;
  bytes?: Uint8Array | null;
};

export type ClinicalPdfSnapshot = {
  document: AnyRecord;
  client: AnyRecord;
  signatures: SignatureSnapshot[];
  consent?: AnyRecord | null;
  consentTemplate?: AnyRecord | null;
  treatmentVersion?: AnyRecord | null;
};

export type Treatment6dSection = { title: string; lines: string[] };

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') {
    return Object.entries(value as AnyRecord)
      .map(([key, item]) => `${humanize(key)}: ${asText(item)}`)
      .filter((item) => !item.endsWith(': '))
      .join(' • ');
  }
  return String(value);
}

function humanize(value: string): string {
  const text = String(value || '').replaceAll('_', ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Campo';
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatCpf(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return String(value ?? '—');
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function wrap(text: string, maxWidth: number, font: any, size: number): string[] {
  const words = String(text || '—').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return ['—'];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) <= maxWidth) current = attempt;
    else if (current) { lines.push(current); current = word; }
    else lines.push(word);
  }
  if (current) lines.push(current);
  return lines;
}

function renderObjectEntries(
  record: AnyRecord | null | undefined,
  skip = new Set<string>(),
): Array<[string, string]> {
  if (!record || typeof record !== 'object') return [];
  return Object.entries(record)
    .filter(([key, value]) => !skip.has(key) && value !== null && value !== undefined && asText(value).trim())
    .map(([key, value]) => [humanize(key), asText(value)]);
}

function hasConsentReference(source: AnyRecord, treatment: AnyRecord): boolean {
  const external = source.external_consent;
  const hasExternal = Boolean(external && typeof external === 'object' && Object.keys(external as AnyRecord).length);
  return Boolean(source.consent_document_id || treatment.consent_document_id || hasExternal);
}

export function buildTreatment6dSections(snapshot: AnyRecord | null | undefined): Treatment6dSection[] {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const photos = Array.isArray(source.photos) ? source.photos as AnyRecord[] : [];
  const products = Array.isArray(source.product_usages) ? source.product_usages as AnyRecord[] : [];
  const equipment = Array.isArray(source.equipment_usages) ? source.equipment_usages as AnyRecord[] : [];
  const intercurrences = Array.isArray(source.intercurrences) ? source.intercurrences as AnyRecord[] : [];
  const sections: Treatment6dSection[] = [];

  if (photos.length) {
    const count = (kind: string) => photos.filter((p) => String(p.kind || '') === kind).length;
    const lines = [`Antes: ${count('antes')} • Depois: ${count('depois')} • Adicional: ${count('adicional')}`];
    for (const photo of photos) {
      const kind = humanize(String(photo.kind || 'foto'));
      const detail = [photo.region, photo.view, photo.caption].map(asText).filter(Boolean).join(' • ');
      lines.push(`${kind}${detail ? ` • ${detail}` : ''}${photo.captured_at ? ` • ${formatDate(photo.captured_at)}` : ''}`);
    }
    sections.push({ title:'Fotos clínicas', lines });
  }

  if (products.length) {
    const lines = products.map((item) => {
      const identity = [item.product_name_snapshot, item.manufacturer_snapshot].map(asText).filter(Boolean).join(' • ');
      const lot = item.lot_code_snapshot ? `Lote ${asText(item.lot_code_snapshot)}` : 'Lote —';
      const expiry = item.expires_on_snapshot ? `Validade ${formatDate(item.expires_on_snapshot)}` : 'Validade —';
      const amount = `${asText(item.quantity)} ${asText(item.unit)}`.trim();
      return [identity,lot,expiry,amount].filter(Boolean).join(' • ');
    });
    sections.push({ title:'Produtos e lotes', lines });
  }

  if (equipment.length) {
    const lines: string[] = [];
    for (const item of equipment) {
      const identity = [item.equipment_name_snapshot,item.manufacturer_snapshot,item.model_snapshot,item.internal_code_snapshot].map(asText).filter(Boolean).join(' • ');
      lines.push(identity || 'Equipamento registrado');
      const values = item.parameter_values && typeof item.parameter_values === 'object' ? item.parameter_values as AnyRecord : {};
      const params = Object.entries(values).map(([key,value]) => `${key}: ${asText(value)}`).join(' • ');
      if (params) lines.push(`Parâmetros: ${params}`);
    }
    sections.push({ title:'Equipamentos e parâmetros', lines });
  }

  if (intercurrences.length) {
    const lines: string[] = [];
    for (const item of intercurrences) {
      lines.push(`${humanize(String(item.severity || ''))} • ${humanize(String(item.moment || ''))} • Status: ${asText(item.status) || '—'}`);
      lines.push(`Descrição: ${asText(item.description) || '—'}`);
      lines.push(`Conduta registrada: ${asText(item.action_taken) || '—'}`);
      const updates = Array.isArray(item.updates) ? item.updates as AnyRecord[] : [];
      for (const update of updates) lines.push(`Evolução: ${asText(update.evolution) || '—'} • Status: ${asText(update.status_after) || '—'}`);
    }
    sections.push({ title:'Intercorrências e evoluções', lines });
  }

  return sections;
}

export function buildTreatmentReportSection(snapshot: AnyRecord | null | undefined): Treatment6dSection {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const treatment = source.treatment && typeof source.treatment === 'object' ? source.treatment as AnyRecord : {};
  const procedure = source.procedure_version && typeof source.procedure_version === 'object' ? source.procedure_version as AnyRecord : {};
  const professional = source.professional && typeof source.professional === 'object' ? source.professional as AnyRecord : {};
  const report = source.report && typeof source.report === 'object' ? source.report as AnyRecord : {};
  const anamneseId = source.anamnese_id || treatment.anamnese_id;
  const consentLinked = hasConsentReference(source, treatment);
  const lines = [
    `Procedimento: ${asText(procedure.nome) || '—'}`,
    `Profissional responsável: ${asText(professional.name) || '—'}`,
    `Data do atendimento: ${formatDate(treatment.treatment_date)}`,
    `Descrição da sessão: ${asText(report.descricao_sessao) || '—'}`,
    `Resposta observada: ${asText(report.resposta_observada) || '—'}`,
    `Orientações: ${asText(report.orientacoes) || '—'}`,
    `Retorno necessário: ${report.retorno_necessario === true ? 'Sim' : 'Não'}`,
  ];
  if (report.retorno_sugerido_em) lines.push(`Retorno sugerido em: ${formatDate(report.retorno_sugerido_em)}`);
  if (report.observacoes) lines.push(`Observações: ${asText(report.observacoes)}`);
  lines.push(`Anamnese Geral vinculada: ${anamneseId ? 'Sim' : 'Não'}`);
  lines.push(`Consentimento vinculado: ${consentLinked ? 'Sim' : 'Não'}`);
  return { title:'Relatório / Parecer do Atendimento', lines };
}

export async function buildClinicalPdf(snapshot: ClinicalPdfSnapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 48;
  const width = pageSize[0] - margin * 2;
  const gold = rgb(0.62, 0.47, 0.22);
  const ink = rgb(0.16, 0.12, 0.10);
  const muted = rgb(0.42, 0.38, 0.35);
  const rule = rgb(0.86, 0.81, 0.74);

  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;
  const newPage = () => { page = pdf.addPage(pageSize); y = pageSize[1] - margin; };
  const ensure = (height: number) => { if (y - height < margin) newPage(); };
  const line = (text: string, size = 9.5, font = regular, color = ink) => {
    const rows = wrap(text || '—', width, font, size);
    ensure(rows.length * (size + 3) + 4);
    for (const row of rows) { page.drawText(row, { x: margin, y, size, font, color }); y -= size + 3; }
    y -= 1;
  };
  const paragraph = (text: string, size = 9.3, font = regular, color = ink) => line(text, size, font, color);
  const divider = () => { ensure(14); y -= 4; page.drawLine({ start:{x:margin,y}, end:{x:pageSize[0]-margin,y}, thickness:.6, color:rule }); y -= 10; };
  const section = (title: string) => { ensure(26); page.drawText(title.toUpperCase(), { x:margin, y, size:9, font:bold, color:gold }); y -= 18; };
  const pair = (label: string, value: unknown, strong = false) => {
    const text = `${label}: ${asText(value) || '—'}`;
    line(text, 9.3, strong ? bold : regular, ink);
  };

  const documentType = String(snapshot.document.document_type || '');
  const isConsent = documentType === 'consentimento_procedimento';
  const title = isConsent ? 'CONSENTIMENTO E AUTORIZAÇÃO • PRONTUÁRIO CLÍNICO' : 'FICHA DE ATENDIMENTO • PRONTUÁRIO CLÍNICO';

  page.drawText('BC Estética Avançada', { x:margin, y, size:20, font:bold, color:ink });
  y -= 27;
  page.drawText(title, { x:margin, y, size:9, font:bold, color:gold });
  y -= 19;
  pair('Código do documento', snapshot.document.document_code);
  pair('Versão do documento', snapshot.document.document_version || 1);
  divider();

  section('Identificação da cliente');
  pair('Nome', snapshot.client.nome, true);
  pair('CPF', formatCpf(snapshot.client.cpf));
  pair('Data de nascimento', snapshot.client.data_nascimento);
  pair('Telefone', snapshot.client.telefone);
  if (snapshot.client.email) pair('E-mail', snapshot.client.email);
  divider();

  section('Profissional responsável');
  pair('Nome', snapshot.document.profissional_nome, true);
  pair('Profissão', snapshot.document.profissional_profissao);
  pair('Conselho / registro', `${asText(snapshot.document.profissional_conselho)} ${asText(snapshot.document.profissional_registro)}`.trim());
  divider();

  if (isConsent) {
    const consent = snapshot.consent || {};
    const template = snapshot.consentTemplate || {};
    section('Procedimento');
    pair('Procedimento', consent.procedure_name_snapshot, true);
    pair('Classe documental', consent.consent_class === 'injetavel' ? 'Injetável / invasivo' : 'Não injetável');
    if (Array.isArray(consent.component_keys) && consent.component_keys.length) pair('Componentes da sessão', consent.component_keys);
    divider();

    section(asText(template.title) || 'Termo de consentimento');
    paragraph(asText(template.body) || '—', 9.4);
    if (consent.supplement_snapshot) {
      y -= 5;
      section('Complemento específico do procedimento');
      paragraph(asText(consent.supplement_snapshot), 9.4);
    }
  } else {
    const version = snapshot.treatmentVersion || {};
    const snap = (version.snapshot && typeof version.snapshot === 'object' ? version.snapshot : {}) as AnyRecord;
    const treatment = (snap.treatment && typeof snap.treatment === 'object' ? snap.treatment : {}) as AnyRecord;
    const procedure = (snap.procedure_version && typeof snap.procedure_version === 'object' ? snap.procedure_version : {}) as AnyRecord;
    const components = Array.isArray(snap.components) ? snap.components as AnyRecord[] : [];

    section('Procedimento e versão clínica');
    pair('Procedimento', procedure.nome, true);
    pair('Versão do procedimento', procedure.version || '—');
    pair('Classe documental', procedure.classe_documental === 'injetavel' ? 'Injetável / invasivo' : 'Não injetável');
    pair('Data do atendimento', treatment.treatment_date);
    pair('Versão da ficha', version.version || snapshot.document.source_version || 1);
    if (version.correction_mode && version.correction_mode !== 'initial') pair('Tipo de correção', version.correction_mode === 'same_day' ? 'Correção no mesmo dia' : 'Correção após reabertura controlada');
    if (components.length) pair('Componentes da sessão', components.map((item) => item.component_name_snapshot || item.component_key).filter(Boolean));
    divider();

    section('Registro da sessão');
    const treatmentSkip = new Set([
      'id','cliente_id','procedimento_id','procedure_version_id','profissional_user_id','agendamento_id','status',
      'price_mode_snapshot','base_price_snapshot','final_price','anamnese_id','consent_document_id','current_version_id',
      'pending_version_id','pending_document_id','correction_mode','correction_reason','started_at','finalized_at','created_by',
      'created_at','updated_at','cycle_key','specific_data','technical_data','treatment_date',
    ]);
    for (const [label, value] of renderObjectEntries(treatment, treatmentSkip)) {
      paragraph(label, 8.8, bold, gold);
      paragraph(value, 9.4);
      y -= 3;
    }
    const specific = treatment.specific_data as AnyRecord | undefined;
    if (specific && Object.keys(specific).length) {
      section('Módulo específico');
      for (const [label, value] of renderObjectEntries(specific)) { paragraph(label, 8.8, bold, gold); paragraph(value, 9.4); y -= 2; }
    }
    const technical = treatment.technical_data as AnyRecord | undefined;
    if (technical && Object.keys(technical).length) {
      section('Dados técnicos registrados');
      for (const [label, value] of renderObjectEntries(technical)) { paragraph(label, 8.8, bold, gold); paragraph(value, 9.4); y -= 2; }
    }

    if (snap.report && typeof snap.report === 'object') {
      const reportSection = buildTreatmentReportSection(snap);
      divider();
      section(reportSection.title);
      for (const entry of reportSection.lines) paragraph(entry, 9.2);
    }

    const phase6dSections = buildTreatment6dSections(snap);
    if (phase6dSections.length) {
      divider();
      for (const block of phase6dSections) {
        section(block.title);
        for (const entry of block.lines) paragraph(entry, 9.2);
        y -= 3;
      }
    }

    divider();
    section('Referências do prontuário');
    pair('Anamnese Geral vinculada', treatment.anamnese_id ? 'Sim' : 'Não registrada nesta versão');
    pair('Consentimento vinculado', hasConsentReference(snap, treatment) ? 'Sim' : 'Não registrado nesta versão');
  }

  divider();
  section('Assinaturas');
  for (const signature of snapshot.signatures || []) {
    ensure(110);
    const kind = String(signature.signer_kind || '').toUpperCase();
    line(kind || 'ASSINANTE', 8.8, bold, gold);
    pair('Nome', signature.signer_name, true);
    if (signature.signer_profissao || signature.signer_conselho || signature.signer_registro) {
      pair('Identificação profissional', `${asText(signature.signer_profissao)} • ${asText(signature.signer_conselho)} ${asText(signature.signer_registro)}`.trim());
    }
    pair('Assinado em', formatDate(signature.signed_at));
    if (signature.bytes?.length) {
      try {
        const image = await pdf.embedPng(signature.bytes);
        const dimensions = image.scaleToFit(180, 70);
        ensure(dimensions.height + 12);
        page.drawImage(image, { x:margin, y:y-dimensions.height, width:dimensions.width, height:dimensions.height });
        y -= dimensions.height + 10;
      } catch {
        line('Assinatura gráfica registrada no armazenamento privado do prontuário.', 8.5, regular, muted);
      }
    }
    y -= 6;
  }

  divider();
  if (isConsent) paragraph('Este documento registra informação, ciência e consentimento para o procedimento descrito. Não constitui promessa de resultado nem substitui avaliação clínica individualizada.', 8.4, regular, muted);
  else paragraph('Esta ficha registra a sessão clínica e a versão assinada pela profissional responsável. Correções posteriores geram nova versão e preservam o registro anterior.', 8.4, regular, muted);
  paragraph(`Documento gerado em ${formatDate(new Date().toISOString())}.`, 8.2, regular, muted);

  return await pdf.save({ useObjectStreams:false });
}