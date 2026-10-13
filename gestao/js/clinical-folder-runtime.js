import { getClient } from './clientes-api.js';
import { loadClientClinicalBundle, initAnamneseController } from './anamnese-controller.js';
import { renderAnamnesePanel, renderClinicalAlerts } from './anamnese-panel.js';
import { renderTreatmentPanel, initTreatmentController } from './treatment-panel.js';

const INSTALL_KEY = '__bcClinicalFolderRuntimeInstalled';

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function documentLabel(doc = {}) {
  if (doc.document_type === 'consentimento_procedimento') return 'Consentimento do procedimento';
  if (doc.document_type === 'treatment_record') return 'Ficha de atendimento';
  return 'Anamnese Geral';
}

function renderDocuments(documents = []) {
  if (!documents.length) return '<div class="bcg-empty">Nenhum documento clínico emitido para esta cliente.</div>';
  return `<div class="bcg-clinical-documents">${documents.map((doc) => `<article class="bcg-document-card" data-document-id="${escapeHtml(doc.id)}"><div><strong>${escapeHtml(doc.document_code || 'Documento clínico')}</strong><span>${escapeHtml(documentLabel(doc))} • Versão ${escapeHtml(doc.source_version)}</span></div><span class="bcg-chip">${escapeHtml(doc.status === 'emitido' ? 'PDF emitido' : doc.status || '')}</span>${doc.status === 'emitido' && doc.storage_path ? `<button class="bcg-small-button" type="button" data-download-clinical-document="${escapeHtml(doc.id)}">Baixar PDF</button>` : ''}</article>`).join('')}</div>`;
}

function updateChecklist(folder, state) {
  const item = [...(folder.querySelectorAll?.('.bcg-folder-check-item') || [])].find((node) => /anamnese/i.test(node.querySelector?.('span')?.textContent || ''));
  if (!item) return;
  const complete = state?.status === 'finalizada';
  item.dataset.complete = complete ? 'true' : 'false';
  const label = state?.status === 'vencida' ? 'Vencida' : complete ? 'Concluído' : 'Pendente';
  const strong = item.querySelector?.('strong');
  if (strong) strong.textContent = label;
}

function updateAlertStrip(folder, alerts) {
  const old = folder.querySelector?.('[data-clinical-alert-strip]');
  old?.remove?.();
  if (!alerts?.length) return;
  const checklist = folder.querySelector?.('.bcg-folder-checklist');
  if (!checklist) return;
  const section = folder.ownerDocument.createElement('section');
  section.className = 'bcg-folder-alert-strip';
  section.dataset.clinicalAlertStrip = '';
  section.innerHTML = `<p class="bcg-eyebrow">ALERTAS CLÍNICOS ATIVOS</p>${renderClinicalAlerts(alerts)}`;
  checklist.before(section);
}

function renderTreatmentTimelineSummary(treatments = []) {
  if (!treatments.length) return '';
  return `<section data-treatment-timeline-summary><p class="bcg-eyebrow">ATENDIMENTOS CLÍNICOS 6C</p><div class="bcg-history-timeline">${treatments.map((item) => `<article class="bcg-history-entry"><header><div><strong>${escapeHtml(item.procedure_name || 'Procedimento')}</strong><span>${escapeHtml(item.status || '')}</span></div><time>${escapeHtml(String(item.treatment_date || '').split('-').reverse().join('/'))}</time></header><div class="bcg-history-grid">${item.objetivo ? `<div class="bcg-history-field"><span>Objetivo</span><p>${escapeHtml(item.objetivo)}</p></div>` : ''}${item.orientacoes ? `<div class="bcg-history-field"><span>Orientações</span><p>${escapeHtml(item.orientacoes)}</p></div>` : ''}</div></article>`).join('')}</div><div class="bcg-divider"></div><p class="bcg-eyebrow">HISTÓRICO LEGADO</p></section>`;
}

function updateTimeline(folder, treatments = []) {
  const panel = folder.querySelector?.('[data-folder-panel="timeline"]');
  if (!panel) return;
  panel.querySelector?.('[data-treatment-timeline-summary]')?.remove?.();
  if (!treatments.length) return;
  panel.insertAdjacentHTML?.('afterbegin', renderTreatmentTimelineSummary(treatments));
}

async function hydrateFolder({ client, folder, force = false }) {
  if (!folder?.isConnected || !folder.dataset.clientId) return;
  if (folder.dataset.clinicalHydrating === 'true') return;
  if (!force && folder.dataset.clinicalHydrated === 'true') return;
  folder.dataset.clinicalHydrating = 'true';
  const clienteId = folder.dataset.clientId;
  try {
    const [clientRecord, bundle] = await Promise.all([
      getClient({ client, clienteId }),
      loadClientClinicalBundle({ client, clienteId }),
    ]);
    if (!folder.isConnected || folder.dataset.clientId !== clienteId) return;
    folder.__bcClientRecord = clientRecord;
    folder.__bcClinicalBundle = bundle;

    const anamnesePanel = folder.querySelector?.('[data-folder-panel="anamnese"]');
    if (anamnesePanel) {
      anamnesePanel.innerHTML = renderAnamnesePanel({
        client: clientRecord,
        state: bundle.state,
        versions: bundle.versions,
        alerts: bundle.alerts,
        documents: bundle.documents,
      });
    }

    const documentsPanel = folder.querySelector?.('[data-folder-panel="documentos"]');
    if (documentsPanel) {
      documentsPanel.innerHTML = `<p class="bcg-eyebrow">DOCUMENTOS CLÍNICOS</p><h3>PDFs da Pasta da Cliente</h3><p class="bcg-muted">Documentos privados, versionados e acessíveis somente à equipe autorizada.</p>${renderDocuments(bundle.documents)}`;
    }

    const treatmentsPanel = folder.querySelector?.('[data-folder-panel="atendimentos"]');
    if (treatmentsPanel && !folder.__bcTreatmentController) {
      treatmentsPanel.innerHTML = renderTreatmentPanel({ client: clientRecord });
      folder.__bcTreatmentController = initTreatmentController({
        client,
        root: treatmentsPanel,
        getClientRecord: () => folder.__bcClientRecord,
        refreshFolder: () => hydrateFolder({ client, folder, force: true }),
      });
    }
    if (folder.__bcTreatmentController) {
      const treatmentBundle = await folder.__bcTreatmentController.hydrate();
      updateTimeline(folder, treatmentBundle?.treatments || []);
    }

    updateChecklist(folder, bundle.state);
    updateAlertStrip(folder, bundle.alerts);

    if (!folder.__bcAnamneseController) {
      folder.__bcAnamneseController = initAnamneseController({
        client,
        root: folder,
        getClientRecord: () => folder.__bcClientRecord,
        getClinicalBundle: () => folder.__bcClinicalBundle,
        refresh: () => hydrateFolder({ client, folder, force: true }),
      });
    }
    folder.dataset.clinicalHydrated = 'true';
  } catch (error) {
    const anamnesePanel = folder.querySelector?.('[data-folder-panel="anamnese"]');
    if (anamnesePanel) anamnesePanel.innerHTML = `<div class="bcg-empty">${escapeHtml(error?.message || 'Não foi possível carregar a Anamnese Geral.')}</div>`;
    const treatmentsPanel = folder.querySelector?.('[data-folder-panel="atendimentos"]');
    if (treatmentsPanel) treatmentsPanel.innerHTML = `<div class="bcg-empty">${escapeHtml(error?.message || 'Não foi possível carregar os atendimentos clínicos.')}</div>`;
  } finally {
    delete folder.dataset.clinicalHydrating;
  }
}

function foldersFromNode(node) {
  if (!(node instanceof Element)) return [];
  const result = [];
  if (node.matches?.('[data-client-folder]')) result.push(node);
  result.push(...(node.querySelectorAll?.('[data-client-folder]') || []));
  return result;
}

export function installClinicalFolderRuntime({ client, root = document } = {}) {
  if (!client || !root || globalThis[INSTALL_KEY]) return globalThis[INSTALL_KEY] || null;
  const hydrate = (folder) => hydrateFolder({ client, folder }).catch(() => {});
  root.querySelectorAll?.('[data-client-folder]')?.forEach?.(hydrate);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) foldersFromNode(node).forEach(hydrate);
    }
  });
  observer.observe(root.documentElement || root, { childList: true, subtree: true });
  const runtime = { observer, hydrateFolder: (folder, force = true) => hydrateFolder({ client, folder, force }) };
  globalThis[INSTALL_KEY] = runtime;
  return runtime;
}