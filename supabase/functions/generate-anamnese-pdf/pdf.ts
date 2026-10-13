import { degrees, PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

type PhotoDrawPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visibleWidth: number;
  visibleHeight: number;
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

const CHOICE_LABELS: Record<string, string> = {
  sim: 'Sim',
  nao: 'Não',
  nao_sei: 'Não sei',
  prefiro_conversar: 'Prefiro conversar pessoalmente',
  prefiro_nao_informar: 'Prefiro não informar',
  nao_se_aplica: 'Não se aplica',
  as_vezes: 'Às vezes',
  seca: 'Seca',
  oleosa: 'Oleosa',
  mista: 'Mista',
  sensivel: 'Sensível',
  normal: 'Normal',
  ultimos_7_dias: 'Últimos 7 dias',
  '8_15_dias': '8–15 dias',
  '16_30_dias': '16–30 dias',
  mais_de_30_dias: 'Mais de 30 dias',
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

function displayAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(displayAnswerValue).filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string') return CHOICE_LABELS[value] || value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('value' in obj && Object.keys(obj).length === 1) return displayAnswerValue(obj.value);
    return Object.entries(obj).map(([key, item]) => `${key}: ${displayAnswerValue(item)}`).join(' • ');
  }
  return String(value);
}

function answerValue(answer: AnyRecord): string {
  return displayAnswerValue(answer.answer_json);
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

export function readJpegExifOrientation(bytes: Uint8Array | null | undefined): number {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0x01) continue;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) break;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;

    if (marker === 0xe1 && segmentLength >= 10) {
      const exifStart = offset + 2;
      const segmentEnd = offset + segmentLength;
      const isExif =
        bytes[exifStart] === 0x45 && bytes[exifStart + 1] === 0x78 &&
        bytes[exifStart + 2] === 0x69 && bytes[exifStart + 3] === 0x66 &&
        bytes[exifStart + 4] === 0x00 && bytes[exifStart + 5] === 0x00;

      if (isExif) {
        const tiffStart = exifStart + 6;
        if (tiffStart + 8 <= segmentEnd) {
          const littleEndian = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
          const bigEndian = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d;
          if (littleEndian || bigEndian) {
            const read16 = (index: number) => littleEndian
              ? bytes[index] | (bytes[index + 1] << 8)
              : (bytes[index] << 8) | bytes[index + 1];
            const read32 = (index: number) => littleEndian
              ? (bytes[index] | (bytes[index + 1] << 8) | (bytes[index + 2] << 16) | (bytes[index + 3] << 24)) >>> 0
              : (((bytes[index] << 24) >>> 0) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3]) >>> 0;

            if (read16(tiffStart + 2) === 42) {
              const ifdStart = tiffStart + read32(tiffStart + 4);
              if (ifdStart + 2 <= segmentEnd) {
                const entryCount = read16(ifdStart);
                for (let index = 0; index < entryCount; index += 1) {
                  const entry = ifdStart + 2 + index * 12;
                  if (entry + 12 > segmentEnd) break;
                  if (read16(entry) !== 0x0112) continue;
                  const type = read16(entry + 2);
                  const count = read32(entry + 4);
                  if (type === 3 && count >= 1) {
                    const orientation = read16(entry + 8);
                    if (orientation >= 1 && orientation <= 8) return orientation;
                  }
                }
              }
            }
          }
        }
      }
    }

    offset += segmentLength;
  }

  return 1;
}

export function photoDrawPlacement({
  imageWidth,
  imageHeight,
  orientation,
  boxX,
  boxY,
  boxWidth,
  boxHeight,
}: {
  imageWidth: number;
  imageHeight: number;
  orientation: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
}): PhotoDrawPlacement {
  const safeImageWidth = Math.max(1, imageWidth);
  const safeImageHeight = Math.max(1, imageHeight);
  const rotation = orientation === 3 ? 180 : orientation === 5 || orientation === 6 ? -90 : orientation === 7 || orientation === 8 ? 90 : 0;
  const quarterTurn = Math.abs(rotation) === 90;
  const naturalVisibleWidth = quarterTurn ? safeImageHeight : safeImageWidth;
  const naturalVisibleHeight = quarterTurn ? safeImageWidth : safeImageHeight;
  const scale = Math.min(boxWidth / naturalVisibleWidth, boxHeight / naturalVisibleHeight);
  const width = safeImageWidth * scale;
  const height = safeImageHeight * scale;
  const visibleWidth = quarterTurn ? height : width;
  const visibleHeight = quarterTurn ? width : height;
  const left = boxX + (boxWidth - visibleWidth) / 2;
  const bottom = boxY + (boxHeight - visibleHeight) / 2;

  if (rotation === -90) {
    return { x: left, y: bottom + visibleHeight, width, height, rotation, visibleWidth, visibleHeight };
  }
  if (rotation === 90) {
    return { x: left + visibleWidth, y: bottom, width, height, rotation, visibleWidth, visibleHeight };
  }
  if (rotation === 180) {
    return { x: left + visibleWidth, y: bottom + visibleHeight, width, height, rotation, visibleWidth, visibleHeight };
  }
  return { x: left, y: bottom, width, height, rotation, visibleWidth, visibleHeight };
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
        const boxWidth = 110;
        const boxHeight = 130;
        ensure(boxHeight + 20);
        const orientation = snapshot.photoMimeType === 'image/jpeg' || snapshot.photoMimeType === 'image/jpg'
          ? readJpegExifOrientation(snapshot.photoBytes)
          : 1;
        const placement = photoDrawPlacement({
          imageWidth: image.width,
          imageHeight: image.height,
          orientation,
          boxX: pageSize[0] - margin - boxWidth,
          boxY: y - boxHeight,
          boxWidth,
          boxHeight,
        });
        page.drawImage(image, {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          rotate: degrees(placement.rotation),
        });
        y -= boxHeight + 8;
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