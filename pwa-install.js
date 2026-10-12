(() => {
  const button = document.getElementById('installApp');
  const status = document.getElementById('installStatus');
  if (!button || !status) return;

  let deferredPrompt = null;
  let installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  if (installed) {
    status.textContent = 'Você já está usando a BC como aplicativo. Acesse o site ou o BC Gestão pelos links abaixo.';
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    if (installed) return;
    event.preventDefault();
    deferredPrompt = event;
    button.hidden = false;
    status.textContent = 'Seu navegador permite instalar a BC pelo botão abaixo.';
  });

  button.addEventListener('click', async () => {
    if (!deferredPrompt || installed) return;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    button.disabled = true;
    button.hidden = true;
    try {
      const result = await prompt.prompt();
      if (!installed) {
        status.textContent = result?.outcome === 'accepted'
          ? 'Instalação solicitada. Confirme as próximas etapas no navegador e procure o ícone da BC.'
          : 'Instalação cancelada. Você pode tentar novamente pelo menu do navegador.';
      }
    } catch {
      if (!installed) status.textContent = 'Não foi possível abrir a instalação automática. Use as instruções do seu aparelho abaixo.';
    } finally {
      button.disabled = false;
    }
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    button.hidden = true;
    status.textContent = 'App instalado. Procure o ícone BC Estética na tela inicial do seu aparelho.';
  });
})();
