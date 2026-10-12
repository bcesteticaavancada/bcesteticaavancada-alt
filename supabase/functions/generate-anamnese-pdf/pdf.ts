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

export type AnamnesePdfSnapshot = {
  document: AnyRecord;
  client: AnyRecord;
  anamnese: AnyRecord;
  answers: AnyRecord[];
  signatures: SignatureSnapshot[];
  photoBytes?: Uint8Array | null;
  photoMimeType?: string | null;
};

const LABELS: Record<string, string> = {
  queixa_principal: 'Queixa principal',
  objetivos_esteticos: 'Objetivos estéticos',
  objetivo_detalhes: 'Detalhes dos objetivos',
  historico_estetico_realizou: 'Já realizou procedimentos estéticos',
  historico_estetico_detalhes: 'Histórico estético',
  historico_estetico_reacao: 'Reações em procedimentos anteriores',
  pele_tipo: 'Tipo de pele',
  pele_condicoes_atuais: 'Condições atuais da pele',
  pele_condicoes_detalhes: 'Detalhes das condições da pele',
  hiperpigmentacao_pos_inflamatoria: 'Hiperpigmentação pós-inflamatória',
  exposicao_solar_recente: 'Exposição solar recente',
  exposicao_solar_faixa: 'Quando ocorreu a exposição solar',
  usa_fotoprotecao: 'Uso de fotoproteção',
  condicao_saude_importante: 'Condição de saúde importante informada',
  condicao_saude_detalhes: 'Detalhes da condição de saúde',
  acompanhamento_medico: 'Acompanhamento médico atual',
  acompanhamento_medico_detalhes: 'Detalhes do acompanhamento médico',
  condicoes_relevantes: 'Condições clínicas relevantes informadas',
  condicoes_relevantes_detalhes: 'Detalhes das condições relevantes',
  medicamentos_continuos: 'Uso contínuo de medicamentos',
  medicamentos_detalhes: 'Medicamentos informados',
  suplementos: 'Uso de suplementos',
  suplementos_detalhes: 'Suplementos informados',
  tratamento_dermatologico_recente: 'Tratamento dermatológico recente',
  tratamento_dermatologico_detalhes: 'Detalhes do tratamento dermatológico',
  alergias_conhecidas: 'Alergias conhecidas',
  alergias_detalhes: 'Alergias informadas',
  reacao_alergica_procedimento: 'Reação alérgica em procedimento anterior',
  reacao_alergica_detalhes: 'Detalhes da reação alérgica',
  herpes_historico: 'Histórico de herpes',
  herpes_regiao: 'Região do histórico de herpes',
  herpes_ultimo_episodio: 'Último episódio de herpes',
  cicatrizacao_alterada_queloide: 'Cicatrização alterada / queloide',
  cicatrizacao_detalhes: 'Detalhes de cicatrização',
  cirurgias_procedimentos_recentes: 'Cirurgias ou procedimentos recentes',
  cirurgias_recentes_detalhes: 'Detalhes de cirurgia/procedimento recente',
  tabagismo_nicotina: 'Tabagismo / nicotina',
  tabagismo_detalhes: 'Detalhes de tabagismo / nicotina',
  alcool: 'Consumo de álcool',
  alcool_frequencia: 'Frequência de consumo de álcool',
  alcool_observacao: 'Observação sobre consumo de álcool',
  gestacao_possibilidade: 'Gestação / possibilidade de gestação',
  amamentacao: 'Amamentação',
  expectativas: 'Expectativas',
  resultado_especifico: 'Resultado específico esperado',
  observacoes_finais: 'Observações finais',
  declaracao_veracidade: 'Declaração de veracidade e atualidade',
  declaracao_dados: 'Declaração de tratamento de dados para atendimento',
};

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('value' in obj && Object.keys(obj).length === 1) return asText(obj.value);
    return Object.entries(obj).map(([key, item]) => `${key}: ${asText(item)}`).join(' • ');
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function answerValue(answer: AnyRecord): string {
  const raw = answer.answer_json;
  return asText(raw);
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
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
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return ['—'];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) <= maxWidth) {
      current = attempt;
    } else if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildAnamnesePdf(snapshot: AnamnesePdfSnapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 48;
  const contentWidth = pageSize[0] - margin * 2;
  const gold = rgb(0.62, 0.47, 0.22);
  const ink = rgb(0.18, 0.13, 0.11);
  const muted = rgb(0.42, 0.38, 0.35);
  const lineColor = rgb(0.86, 0.81, 0.74);

  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const newPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
  };

  const ensure = (height: number) => {
    if (y - height < margin) newPage();
  };

  const line = (text: string, size = 10, font = regular, color = ink, gap = 4) => {
    ensure(size + gap + 4);
    page.drawText(text || '—', { x: margin, y, size, font, color });
    y -= size + gap;
  };

  const paragraph = (text: string, size = 9.5, font = regular, color = ink, left = margin, width = contentWidth) => {
    const lines = wrap(text || '—', width, font, size);
    ensure(lines.length * (size + 3) + 4);
    for (const row of lines) {
      page.drawText(row, { x: left, y, size, font, color });
      y -= size + 3;
    }
    y -= 2;
  };

  const divider = () => {
    ensure(12);
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: pageSize[0] - margin, y }, thickness: 0.6, color: lineColor });
    y -= 10;
  };

  const section = (title: string) => {
    ensure(28);
    page.drawText(title.toUpperCase(), { x: margin, y, size: 9, font: bold, color: gold });
    y -= 18;
  };

  page.drawText('BC Estética Avançada', { x: margin, y, size: 20, font: bold, color: ink });
  y -= 27;
  page.drawText('ANAMNESE GERAL • PRONTUÁRIO CLÍNICO', { x: margin, y, size: 9, font: bold, color: gold });
  y -= 20;
  page.drawText(`Código do documento: ${asText(snapshot.document.document_code) || '—'}`, { x: margin, y, size: 9, font: regular, color: muted });
  y -= 13;
  page.drawText(`Versão do documento: ${asText(snapshot.document.document_version) || '1'} • Versão da anamnese: ${asText(snapshot.anamnese.version) || '—'}`, { x: margin, y, size: 9, font: regular, color: muted });
  y -= 18;
  divider();

  section('Identificação da cliente');
  line(`Nome: ${asText(snapshot.client.nome) || '—'}`, 10, bold);
  line(`CPF: ${formatCpf(snapshot.client.cpf)}`, 9.5);
  line(`Data de nascimento: ${asText(snapshot.client.data_nascimento) || '—'}`, 9.5);
  line(`Telefone: ${asText(snapshot.client.telefone) || '—'}`, 9.5);
  if (snapshot.client.email) line(`E-mail: ${asText(snapshot.client.email)}`, 9.5);

  if (snapshot.photoBytes && snapshot.photoBytes.length) {
    try {
      let image;
      if (snapshot.photoMimeType === 'image/png') image = await pdf.embedPng(snapshot.photoBytes);
      else if (snapshot.photoMimeType === 'image/jpeg' || snapshot.photoMimeType === 'image/jpg') image = await pdf.embedJpg(snapshot.photoBytes);
      if (image) {
        ensure(150);
        const dimensions = image.scaleToFit(110, 130);
        page.drawImage(image, { x: pageSize[0] - margin - dimensions.width, y: y - dimensions.height, width: dimensions.width, height: dimensions.height });
        y -= dimensions.height + 8;
      }
    } catch {
      line('Foto de identificação disponível no prontuário, mas não incorporada a este PDF.', 8.5, regular, muted);
    }
  }

  divider();
  section('Profissional responsável pela revisão');
  line(`Nome: ${asText(snapshot.document.profissional_nome) || '—'}`, 10, bold);
  line(`Profissão: ${asText(snapshot.document.profissional_profissao) || '—'}`, 9.5);
  line(`Conselho / registro: ${asText(snapshot.document.profissional_conselho) || '—'} ${asText(snapshot.document.profissional_registro) || ''}`.trim(), 9.5);
  line(`Revisão profissional: ${formatDate(snapshot.anamnese.reviewed_at)}`, 9.5);
  line(`Finalização: ${formatDate(snapshot.anamnese.finalized_at)}`, 9.5);
  divider();

  section('Anamnese Geral');
  for (const answer of snapshot.answers) {
    const key = String(answer.question_key ?? '');
    const value = answerValue(answer);
    if (!key || !value) continue;
    ensure(34);
    paragraph(LABELS[key] || key, 9, bold, gold);
    paragraph(value, 9.5, regular, ink);
    y -= 3;
  }

  divider();
  section('Assinaturas');
  for (const signature of snapshot.signatures) {
    ensure(110);
    const kind = String(signature.signer_kind || '').toUpperCase();
    line(kind || 'ASSINANTE', 9, bold, gold);
    line(`Nome: ${asText(signature.signer_name) || '—'}`, 9.5, bold);
    if (signature.signer_profissao || signature.signer_conselho || signature.signer_registro) {
      line(`Identificação profissional: ${asText(signature.signer_profissao)} • ${asText(signature.signer_conselho)} ${asText(signature.signer_registro)}`.trim(), 8.8, regular, muted);
    }
    line(`Assinado em: ${formatDate(signature.signed_at)}`, 8.8, regular, muted);
    if (signature.bytes?.length) {
      try {
        const image = await pdf.embedPng(signature.bytes);
        const dimensions = image.scaleToFit(180, 70);
        ensure(dimensions.height + 12);
        page.drawImage(image, { x: margin, y: y - dimensions.height, width: dimensions.width, height: dimensions.height });
        y -= dimensions.height + 10;
      } catch {
        line('Assinatura gráfica registrada no arquivo privado do prontuário.', 8.5, regular, muted);
      }
    }
    y -= 6;
  }

  divider();
  paragraph('Este documento registra informações declaradas pela cliente ou responsável e a revisão profissional realizada no contexto do atendimento da BC Estética Avançada. Alertas do sistema têm finalidade informativa e não constituem diagnóstico automático nem decisão clínica.', 8.5, regular, muted);
  paragraph(`Documento gerado em ${formatDate(new Date().toISOString())}.`, 8.2, regular, muted);

  return await pdf.save({ useObjectStreams: false });
}
