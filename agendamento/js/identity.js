export const CPF_FIELD_HTML = '<div class="field"><label for="cpf">CPF *</label><input id="cpf" name="cpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00"></div>';

export const DATA_AUTHORIZATION_HTML = '<div class="consent data-authorization" id="dataAuthorizationWrap"><input id="dataAuthorization" type="checkbox"><label for="dataAuthorization">Declaro estar ciente e autorizo o tratamento dos dados informados nesta pré-anamnese, incluindo CPF, exclusivamente para identificação, preparação e continuidade do atendimento na BC Estética. *</label></div>';

export function mountCpfIdentification(form, documentImpl = globalThis.document) {
  if (!form || !documentImpl) return { cpfInput: null, authorizationInput: null };

  let cpfInput = form.querySelector?.('#cpf') || null;
  if (!cpfInput) {
    const whatsappInput = form.querySelector?.('#whatsapp');
    const whatsappField = whatsappInput?.closest?.('.field');
    const grid = whatsappField?.parentElement;
    if (grid) {
      const holder = documentImpl.createElement('div');
      holder.innerHTML = CPF_FIELD_HTML;
      const field = holder.firstElementChild;
      if (field) {
        if (whatsappField.nextSibling) grid.insertBefore(field, whatsappField.nextSibling);
        else grid.appendChild(field);
        cpfInput = field.querySelector?.('#cpf') || null;
      }
    }
  }

  let authorizationInput = form.querySelector?.('#dataAuthorization') || null;
  if (!authorizationInput) {
    const step1 = form.querySelector?.('#step1');
    const firstGrid = step1?.querySelector?.('.grid');
    if (firstGrid) {
      const holder = documentImpl.createElement('div');
      holder.innerHTML = DATA_AUTHORIZATION_HTML;
      const block = holder.firstElementChild;
      if (block) {
        const spacer = documentImpl.createElement('div');
        spacer.className = 'spacer';
        firstGrid.insertAdjacentElement?.('afterend', spacer);
        spacer.insertAdjacentElement?.('afterend', block);
        authorizationInput = block.querySelector?.('#dataAuthorization') || null;
      }
    }
  }

  return { cpfInput, authorizationInput };
}
