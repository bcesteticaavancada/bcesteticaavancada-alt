import { getClient } from './clientes-api.js';
import { loadClientClinicalBundle, initAnamneseController } from './anamnese-controller.js';
import { renderAnamnesePanel, renderClinicalAlerts } from './anamnese-panel.js';
import { renderTreatmentPanel, initTreatmentController } from './treatment-panel.js';
import { initClientDocumentsPanel } from './client-documents-panel.js';

const INSTALL_KEY = '__bcClinicalFolderRuntimeInstalled';

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function documentLabel(doc = {}) {
  if (doc.document_type === 'consentimento_procedimento') return 'Consentimento do procedimento';
  if (doc.document_type === 'treatment_record') return 'Ficha de atendimento';
  return 'Anamnese Geral';
}

// Compatibilidade 6C: Anamnese e testes antigos continuam usando este renderer.
// A aba Documentos da Central usa o módulo unificado client-documents-panel.js.
export function renderClinicalDocuments(documents = []) {
  if (!documents.length) return '<div class="bcg-empty">Nenhum documento clínico emitido para esta cliente.</div>';
  return `<div class="bcg-clinical-documents">${documents.map((doc) => {
    let action = '';
    if (doc.status === 'emitido' && doc.storage_path) {
      action = `<button class="bcg-small-button" type="button" data-download-clinical-document="${escapeHtml(doc.id)}">Baixar PDF</button>`;
    } else if (doc.status === 'pronto_para_pdf') {
      action = `<button class="bcg-small-button" type="button" data-generate-clinical-document="${escapeHtml(doc.id)}" data-document-type="${escapeHtml(doc.document_type || '')}">Gerar PDF</button>`;
    } else if (doc.status === 'erro_pdf') {
      action = `<button class="bcg-small-button" type="button" data-generate-clinical-document="${escapeHtml(doc.id)}" data-document-type="${escapeHtml(doc.document_type || '')}">Tentar gerar PDF</button>`;
    }
    const statusLabel = doc.status === 'emitido' ? 'PDF emitido' : doc.status === 'gerando_pdf' ? 'Gerando PDF' : (doc.status || '');
    return `<article class="bcg-document-card" data-document-id="${escapeHtml(doc.id)}"><div><strong>${escapeHtml(doc.document_code || 'Documento clínico')}</strong><span>${escapeHtml(documentLabel(doc))} • Versão ${escapeHtml(doc.source_version)}</span></div><span class="bcg-chip">${escapeHtml(statusLabel)}</span>${action}</article>`;
  }).join('')}</div>`;
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
  return `<section data-treatment-timeline-summary><p class="bcg-eyebrow">ATENDIMENTOS CLÍNICOS</p><div class="bcg-history-timeline">${treatments.map((item) => `<article class="bcg-history-entry"><header><div><strong>${escapeHtml(item.procedure_name || 'Procedimento')}</strong><span>${escapeHtml(item.status || '')}</span></div><time>${escapeHtml(String(item.treatment_date || '').split('-').reverse().join('/'))}</time></header><div class="bcg-history-grid">${item.objetivo ? `<div class="bcg-history-field"><span>Objetivo</span><p>${escapeHtml(item.objetivo)}</p></div>` : ''}${item.orientacoes ? `<div class="bcg-history-field"><span>Orientações</span><p>${escapeHtml(item.orientacoes)}</p></div>` : ''}</div></article>`).join('')}</div><div class="bcg-divider"></div></section>`;
}

function updateTimeline(folder, treatments = []) {
  const panel = folder.querySelector?.('[data-folder-panel="resumo"]');
  if (!panel) return;
  panel.querySelector?.('[data-treatment-timeline-summary]')?.remove?.();
  if (!treatments.length) return;
  panel.insertAdjacentHTML?.('beforeend', renderTreatmentTimelineSummary(treatments));
}

async function hydrateFolder({ client, folder, force = false, section = 'resumo' }) {
  if (!folder?.isConnected || !folder.dataset.clientId) return;
  if (folder.dataset.clinicalHydrating === 'true') {
    folder.__bcPendingClinicalSection = section;
    return;
  }
  folder.dataset.clinicalHydrating = 'true';
  const clienteId = folder.dataset.clientId;
  try {
    let clientRecord = folder.__bcClientRecord;
    let bundle = folder.__bcClinicalBundle;
    if (force || !clientRecord || !bundle) {
      [clientRecord, bundle] = await Promise.all([
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
      updateChecklist(folder, bundle.state);
      updateAlertStrip(folder, bundle.alerts);
    }

    if (!folder.__bcAnamneseController) {
      folder.__bcAnamneseController = initAnamneseController({
        client,
        root: folder,
        getClientRecord: () => folder.__bcClientRecord,
        getClinicalBundle: () => folder.__bcClinicalBundle,
        refresh: () => hydrateFolder({ client, folder, force: true, section: 'anamnese' }),
      });
    }

    if (section === 'documentos') {
      const documentsPanel = folder.querySelector?.('[data-folder-panel="documentos"]');
      if (documentsPanel && !folder.__bcDocumentsController) {
        folder.__bcDocumentsController = initClientDocumentsPanel({
          client,
          root: documentsPanel,
          getClientRecord: () => folder.__bcClientRecord,
        });
      }
      if (folder.__bcDocumentsController) await folder.__bcDocumentsController.hydrate();
    }

    if (section === 'atendimentos') {
      const treatmentsPanel = folder.querySelector?.('[data-folder-panel="atendimentos"]');
      if (treatmentsPanel && !folder.__bcTreatmentController) {
        treatmentsPanel.innerHTML = renderTreatmentPanel({ client: clientRecord });
        folder.__bcTreatmentController = initTreatmentController({
          client,
          root: treatmentsPanel,
          getClientRecord: () => folder.__bcClientRecord,
          refreshFolder: () => hydrateFolder({ client, folder, force: true, section: 'atendimentos' }),
        });
      }
      if (folder.__bcTreatmentController) {
        const treatmentBundle = await folder.__bcTreatmentController.hydrate();
        updateTimeline(folder, treatmentBundle?.treatments || []);
      }
    }

    folder.dataset.clinicalHydrated = 'true';
  } catch (error) {
    if (section === 'anamnese') {
      const panel = folder.querySelector?.('[data-folder-panel="anamnese"]');
      if (panel) panel.innerHTML = `<div class="bcg-empty">${escapeHtml(error?.message || 'Não foi possível carregar a Anamnese Geral.')}</div>`;
    }
    if (section === 'atendimentos') {
      const panel = folder.querySelector?.('[data-folder-panel="atendimentos"]');
      if (panel) panel.innerHTML = `<div class="bcg-empty">${escapeHtml(error?.message || 'Não foi possível carregar os atendimentos clínicos.')}</div>`;
    }
    if (section === 'documentos') {
      const panel = folder.querySelector?.('[data-folder-panel="documentos"]');
      if (panel && !folder.__bcDocumentsController) panel.innerHTML = `<div class="bcg-empty">${escapeHtml(error?.message || 'Não foi possível carregar os documentos.')}</div>`;
    }
  } finally {
    delete folder.dataset.clinicalHydrating;
    const pending = folder.__bcPendingClinicalSection;
    delete folder.__bcPendingClinicalSection;
    if (pending && pending !== section) hydrateFolder({ client, folder, section: pending }).catch(() => {});
  }
}

function foldersFromNode(node) {
  if (!(node instanceof Element)) return [];
  const result = [];
  if (node.matches?.('[data-client-folder]')) result.push(node);
  result.push(...(node.querySelectorAll?.('[data-client-folder]') || []));
  return result;
}

function dispatchFolderEvent(folder, name, detail = {}) {
  const EventCtor = folder?.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;
  if (typeof EventCtor !== 'function') return;
  folder.dispatchEvent(new EventCtor(name, { bubbles: true, detail }));
}

export function installClinicalFolderRuntime({ client, root = document } = {}) {
  if (!client || !root || globalThis[INSTALL_KEY]) return globalThis[INSTALL_KEY] || null;
  const hydrate = (folder) => hydrateFolder({ client, folder, section: 'resumo' }).catch(() => {});
  root.querySelectorAll?.('[data-client-folder]')?.forEach?.(hydrate);

  const onClick = (event) => {
    const folder = event.target.closest?.('[data-client-folder]');
    if (!folder) return;

    const tab = event.target.closest?.('[data-folder-tab]');
    if (tab && !tab.hidden) {
      dispatchFolderEvent(folder, 'bc:folder-tab-change', { tab: tab.dataset.folderTab });
      return;
    }

    if (event.target.closest?.('[data-client-upload-document]')) {
      folder.querySelector?.('[data-folder-tab="documentos"]')?.click?.();
      return;
    }
    if (event.target.closest?.('[data-client-edit-cadastro]')) {
      const panel = folder.querySelector?.('[data-client-cadastro-panel]');
      if (panel) panel.hidden = false;
      return;
    }
    if (event.target.closest?.('[data-client-close-cadastro]')) {
      const panel = folder.querySelector?.('[data-client-cadastro-panel]');
      if (panel) panel.hidden = true;
      return;
    }
    if (event.target.closest?.('[data-client-schedule]')) {
      dispatchFolderEvent(folder, 'bc:client-schedule', { clienteId: folder.dataset.clientId });
      return;
    }
    if (event.target.closest?.('[data-client-new-treatment]')) {
      dispatchFolderEvent(folder, 'bc:client-new-treatment', { clienteId: folder.dataset.clientId });
    }
  };

  const onTabChange = (event) => {
    const folder = event.target.closest?.('[data-client-folder]') || event.target;
    const section = String(event.detail?.tab || 'resumo');
    if (!folder?.matches?.('[data-client-folder]')) return;
    hydrateFolder({ client, folder, section }).catch(() => {});
  };

  root.addEventListener?.('click', onClick);
  root.addEventListener?.('bc:folder-tab-change', onTabChange);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) foldersFromNode(node).forEach(hydrate);
    }
  });
  observer.observe(root.documentElement || root, { childList: true, subtree: true });
  const runtime = {
    observer,
    hydrateFolder: (folder, force = true, section = 'resumo') => hydrateFolder({ client, folder, force, section }),
    destroy() {
      observer.disconnect();
      root.removeEventListener?.('click', onClick);
      root.removeEventListener?.('bc:folder-tab-change', onTabChange);
      delete globalThis[INSTALL_KEY];
    },
  };
  globalThis[INSTALL_KEY] = runtime;
  return runtime;
}
