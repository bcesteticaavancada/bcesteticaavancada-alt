import { calculateAge, clientProfileChecklist, formatCpf, isMinor } from './clientes-domain.js';
import { formatClinicDateTime } from './agenda-format.js';
import { renderAnamnesePanel, renderClinicalAlerts } from './anamnese-panel.js';

if (typeof document !== 'undefined') {
  if (!document.querySelector('link[data-client-folder-styles]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../assets/clientes-folder.css', import.meta.url).href;
    link.dataset.clientFolderStyles = 'true';
    document.head?.append(link);
  }
  if (!document.querySelector('link[data-anamnese-styles]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../assets/anamnese.css', import.meta.url).href;
    link.dataset.anamneseStyles = 'true';
    document.head?.append(link);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function field(label, value) {
  const clean = String(value ?? '').trim();
  if (!clean) return '';
  return `<div class="bcg-history-field"><span>${escapeHtml(label)}</span><p>${escapeHtml(clean)}</p></div>`;
}

function checklistItem(label, complete, detail = '') {
  const state = complete ? 'Concluído' : detail || 'Pendente';
  return `<li class="bcg-folder-check-item" data-complete="${complete ? 'true' : 'false'}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(state)}</strong></li>`;
}

export function renderClientFolderChecklist(client = {}, anamneseState = null) {
  const state = clientProfileChecklist(client);
  const anamneseStatus = anamneseState?.status || 'nao_iniciada';
  const anamneseComplete = anamneseStatus === 'finalizada';
  const anamneseDetail = anamneseStatus === 'vencida' ? 'Vencida' : anamneseComplete ? 'Concluído' : 'Pendente';
  return `<ul class="bcg-folder-checklist" aria-label="Checklist da pasta">
    ${checklistItem('Cadastro básico', state.cadastroBasico)}
    ${checklistItem('Endereço', state.enderecoCompleto)}
    ${checklistItem('Foto de identificação', state.fotoIdentificacao)}
    ${checklistItem('Anamnese', anamneseComplete, anamneseDetail)}
  </ul>`;
}

export function renderClientTimeline(history = [], staffMap = new Map()) {
  if (!history.length) return '<div class="bcg-empty">Nenhum atendimento registrado para esta cliente.</div>';
  return `<div class="bcg-history-timeline">${history.map((entry) => {
    const professional = staffMap.get(entry.colaboradora_user_id) || 'Profissional';
    const procedure = entry.procedimentos?.nome || 'Procedimento';
    return `<article class="bcg-history-entry">
      <header><div><strong>${escapeHtml(procedure)}</strong><span>${escapeHtml(professional)}</span></div><time>${escapeHtml(formatClinicDateTime(entry.data_atendimento))}</time></header>
      <div class="bcg-history-grid">
        ${field('Queixa / objetivo', entry.queixa_objetivo)}
        ${field('Observações', entry.observacoes)}
        ${field('Reações', entry.reacoes)}
        ${field('Intercorrências', entry.intercorrencias)}
        ${field('Feedback da cliente', entry.feedback_cliente)}
        ${field('Orientações', entry.orientacoes)}
        ${field('Próxima sessão', entry.recomendacao_proxima_sessao)}
      </div>
    </article>`;
  }).join('')}</div>`;
}

export function renderClientCadastroForm(client, canArchive = false) {
  if (!client?.id) return '<div class="bcg-empty">Cliente não encontrada.</div>';
  const active = client.ativo !== false;
  const archiveAction = canArchive
    ? `<button type="button" class="bcg-small-button" data-toggle-client="${active ? 'false' : 'true'}">${active ? 'Arquivar cliente' : 'Reativar cliente'}</button>`
    : '';
  const showGuardian = isMinor(client.data_nascimento) || Boolean(client.responsavel_nome || client.responsavel_cpf);
  const age = calculateAge(client.data_nascimento);

  return `<form class="bcg-form bcg-form-grid bcg-folder-form" data-client-edit-form data-client-id="${escapeHtml(client.id)}">
    <label>Nome completo<input class="bcg-input" name="nome" value="${escapeHtml(client.nome || '')}" required></label>
    <label>CPF<input class="bcg-input" name="cpf" inputmode="numeric" value="${escapeHtml(formatCpf(client.cpf || ''))}" required></label>
    <label>Data de nascimento<input class="bcg-input" name="data_nascimento" type="date" value="${escapeHtml(client.data_nascimento || '')}" required><small class="bcg-muted" data-client-edit-age>${age === null ? 'Idade não informada' : `${age} anos`}</small></label>
    <label>Telefone<input class="bcg-input" name="telefone" type="tel" value="${escapeHtml(client.telefone || '')}" required></label>
    <label>E-mail <span class="bcg-optional">opcional</span><input class="bcg-input" name="email" type="email" value="${escapeHtml(client.email || '')}"></label>
    <div class="bcg-field-wide bcg-form-section-title"><span>Endereço</span></div>
    <label>CEP<input class="bcg-input" name="cep" inputmode="numeric" value="${escapeHtml(client.cep || '')}"></label>
    <label>Logradouro<input class="bcg-input" name="logradouro" value="${escapeHtml(client.logradouro || '')}"></label>
    <label>Número<input class="bcg-input" name="numero" value="${escapeHtml(client.numero || '')}"></label>
    <label>Complemento <span class="bcg-optional">opcional</span><input class="bcg-input" name="complemento" value="${escapeHtml(client.complemento || '')}"></label>
    <label>Bairro<input class="bcg-input" name="bairro" value="${escapeHtml(client.bairro || '')}"></label>
    <label>Cidade<input class="bcg-input" name="cidade" value="${escapeHtml(client.cidade || '')}"></label>
    <label>UF<input class="bcg-input" name="uf" maxlength="2" value="${escapeHtml(client.uf || '')}"></label>
    <fieldset class="bcg-field-wide bcg-guardian-fields" data-client-edit-guardian ${showGuardian ? '' : 'hidden'}><legend>Responsável legal</legend><label>Nome<input class="bcg-input" name="responsavel_nome" value="${escapeHtml(client.responsavel_nome || '')}"></label><label>CPF<input class="bcg-input" name="responsavel_cpf" inputmode="numeric" value="${escapeHtml(formatCpf(client.responsavel_cpf || ''))}"></label><label>Parentesco / vínculo<input class="bcg-input" name="responsavel_parentesco" value="${escapeHtml(client.responsavel_parentesco || '')}"></label><label>Telefone<input class="bcg-input" name="responsavel_telefone" type="tel" value="${escapeHtml(client.responsavel_telefone || '')}"></label></fieldset>
    <div class="bcg-form-actions bcg-field-wide"><button class="bcg-button" type="submit">Salvar cadastro</button>${archiveAction}<span class="bcg-status" data-client-edit-status role="status" aria-live="polite"></span></div>
  </form>`;
}

function renderPhotoControls(active) {
  if (!active) return '<p class="bcg-muted">Reative a cliente para registrar uma nova foto.</p>';
  return `<div class="bcg-photo-actions" data-client-photo-actions>
    <label class="bcg-small-button bcg-file-button">Tirar foto<input class="bcg-photo-input" type="file" accept="image/*" capture="environment" data-client-photo-input="camera"></label>
    <label class="bcg-small-button bcg-file-button">Escolher da galeria<input class="bcg-photo-input" type="file" accept="image/*" data-client-photo-input="gallery"></label>
    <span class="bcg-status" data-client-photo-status role="status" aria-live="polite"></span>
  </div>`;
}

function renderPhotoHistory(photoHistory = []) {
  if (!photoHistory.length) return '<div class="bcg-empty">Nenhuma foto de identificação registrada.</div>';
  return `<div class="bcg-photo-history">${photoHistory.map((photo) => `<article class="bcg-photo-history-item" data-photo-id="${escapeHtml(photo.id)}">
    ${photo.url ? `<img src="${escapeHtml(photo.url)}" alt="Foto de identificação ${photo.atual ? 'atual' : 'anterior'}">` : '<div class="bcg-photo-history-placeholder">BC</div>'}
    <div><strong>${photo.atual ? 'Atual' : 'Anterior'}</strong><span>${escapeHtml(formatClinicDateTime(photo.created_at))}</span></div>
  </article>`).join('')}</div>`;
}

function renderDocuments(documents = []) {
  if (!documents.length) return '<div class="bcg-empty">Nenhum documento clínico emitido para esta cliente.</div>';
  return `<div class="bcg-clinical-documents">${documents.map((doc) => `<article class="bcg-document-card" data-document-id="${escapeHtml(doc.id)}"><div><strong>${escapeHtml(doc.document_code || 'Documento clínico')}</strong><span>Anamnese Geral • Versão ${escapeHtml(doc.source_version)}</span></div><span class="bcg-chip">${escapeHtml(doc.status === 'emitido' ? 'PDF emitido' : doc.status || '')}</span>${doc.status === 'emitido' && doc.storage_path ? `<button class="bcg-small-button" type="button" data-download-clinical-document="${escapeHtml(doc.id)}">Baixar PDF</button>` : ''}</article>`).join('')}</div>`;
}

export function renderClientFolder({
  client,
  history = [],
  staffMap = new Map(),
  canArchive = false,
  photoUrl = '',
  photoHistory = [],
  anamneseState = null,
  anamneseVersions = [],
  clinicalAlerts = [],
  clinicalDocuments = [],
}) {
  if (!client?.id) return '<div class="bcg-empty">Selecione uma cliente para abrir a pasta.</div>';
  const age = calculateAge(client.data_nascimento);
  const identity = [age === null ? '' : `${age} anos`, client.telefone || '', client.cpf ? formatCpf(client.cpf) : ''].filter(Boolean).join(' • ');
  const status = client.ativo === false ? '<span class="bcg-chip bcg-status-cancelado">Arquivada</span>' : '<span class="bcg-chip">Ativa</span>';
  const photo = photoUrl
    ? `<img class="bcg-folder-photo" src="${escapeHtml(photoUrl)}" alt="Foto de identificação de ${escapeHtml(client.nome || 'cliente')}">`
    : '<div class="bcg-folder-photo bcg-folder-photo-placeholder" data-client-photo-placeholder aria-label="Sem foto de identificação">BC</div>';

  return `<article class="bcg-client-folder" data-client-folder data-client-id="${escapeHtml(client.id)}">
    <header class="bcg-folder-header"><div class="bcg-folder-identity">${photo}<div><p class="bcg-eyebrow">PASTA DA CLIENTE</p><h2>${escapeHtml(client.nome || 'Cliente')}</h2><p class="bcg-muted">${escapeHtml(identity)}</p>${status}</div></div>${renderPhotoControls(client.ativo !== false)}</header>
    ${clinicalAlerts.length ? `<section class="bcg-folder-alert-strip"><p class="bcg-eyebrow">ALERTAS CLÍNICOS ATIVOS</p>${renderClinicalAlerts(clinicalAlerts)}</section>` : ''}
    ${renderClientFolderChecklist(client, anamneseState)}
    <nav class="bcg-folder-tabs" aria-label="Pasta da cliente"><button type="button" class="bcg-folder-tab is-active" data-folder-tab="timeline">Linha do tempo</button><button type="button" class="bcg-folder-tab" data-folder-tab="cadastro">Cadastro</button><button type="button" class="bcg-folder-tab" data-folder-tab="anamnese">Anamnese</button><button type="button" class="bcg-folder-tab" data-folder-tab="documentos">Documentos</button></nav>
    <section data-folder-panel="timeline"><p class="bcg-eyebrow">LINHA DO TEMPO</p>${renderClientTimeline(history, staffMap)}</section>
    <section data-folder-panel="cadastro" hidden><p class="bcg-eyebrow">CADASTRO</p>${renderClientCadastroForm(client, canArchive)}<div class="bcg-divider"></div><p class="bcg-eyebrow">HISTÓRICO DE IDENTIFICAÇÃO</p><h3>Fotos preservadas</h3>${renderPhotoHistory(photoHistory)}</section>
    <section data-folder-panel="anamnese" hidden>${renderAnamnesePanel({ client, state: anamneseState, versions: anamneseVersions, alerts: clinicalAlerts, documents: clinicalDocuments })}</section>
    <section data-folder-panel="documentos" hidden><p class="bcg-eyebrow">DOCUMENTOS CLÍNICOS</p><h3>PDFs da Pasta da Cliente</h3><p class="bcg-muted">Documentos privados, versionados e acessíveis somente à equipe autorizada.</p>${renderDocuments(clinicalDocuments)}</section>
  </article>`;
}
