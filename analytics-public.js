/* BC Estética — GA4 somente em páginas institucionais e após consentimento explícito. */
(() => {
  "use strict";

  const policyApproved = false;
  const containerId = "GTM-W8NFXSFW";
  const choiceKey = "bc_analytics_consent_v2";
  const official = "https://www.bcesteticaavancada.com.br";
  const pages = new Map([["/clinica/", "clinica"], ["/equipe/", "equipe"], ["/ambiente/", "ambiente"], ["/contato/", "contato"]]);
  if (!policyApproved || location.origin !== official || !pages.has(location.pathname) ||
      location.search || location.hash || document.querySelector("form") || window.google_tag_manager || window.gtag || window.dataLayer ||
      document.querySelector('script[src*="googletagmanager.com"],script[src*="google-analytics.com"]')) return;

  // Um contêiner de terceiro pode ler document.referrer ao carregar.
  // Recusar entradas com parâmetros, fragmentos, caminhos internos sensíveis ou origem externa com caminho.
  if (document.referrer) {
    let ref;
    try { ref = new URL(document.referrer); } catch { return; }
    if (!["https:", "http:"].includes(ref.protocol) || ref.search || ref.hash || ref.username || ref.password ||
        (ref.pathname !== "/" && !(ref.origin === official && pages.has(ref.pathname)))) return;
  }

  let active = false;
  let banner = null;

  function storedChoice() {
    try { return localStorage.getItem(choiceKey); } catch { return null; }
  }

  function saveChoice(choice) {
    try { localStorage.setItem(choiceKey, choice); } catch { /* Sem persistência: pedir novamente. */ }
  }

  function startAnalytics() {
    if (active) return;
    active = true;
    const layer = window.dataLayer = [];
    function consent() { layer.push(arguments); }
    consent("consent", "default", {analytics_storage:"denied", ad_storage:"denied", ad_user_data:"denied", ad_personalization:"denied"});
    consent("consent", "update", {analytics_storage:"granted"});
    layer.push({"gtm.start":Date.now(),event:"gtm.js"});
    const tag = document.createElement("script");
    tag.async = true;
    tag.referrerPolicy = "no-referrer";
    tag.src = "https://www.googletagmanager.com/gtm.js?id="+containerId;
    document.head.appendChild(tag);
    const page = pages.get(location.pathname);
    layer.push({event:"bc_institutional_view",bc_page:page});
    document.addEventListener("click", event => {
      const a = event.target.closest?.("a[href]");
      if (!active || !a) return;
      let channel;
      if (a.protocol === "tel:") channel="telefone";
      if (a.protocol === "https:" && a.hostname === "wa.me") channel="whatsapp";
      if (channel) layer.push({event:"bc_public_contact",bc_page:page,bc_channel:channel});
    });
  }

  function clearAnalyticsCookies() {
    for (const entry of document.cookie.split(";")) {
      const name=entry.trim().split("=")[0];
      if (!/^_ga(?:_[A-Za-z0-9]+)?$/.test(name)) continue;
      for (const domain of ["", "; Domain=www.bcesteticaavancada.com.br","; Domain=bcesteticaavancada.com.br"]) {
        document.cookie=name+"=; Max-Age=0; Path=/; Secure; SameSite=Lax"+domain;
      }
    }
  }

  function hideBanner() {
    if (banner) banner.remove();
    banner = null;
  }

  function setChoice(choice) {
    saveChoice(choice);
    hideBanner();
    if (choice === "accepted") startAnalytics();
    else if (active) { active=false; clearAnalyticsCookies(); location.reload(); }
  }

  function showBanner() {
    hideBanner();
    if (banner) return;
    banner = document.createElement("section");
    banner.className = "bc-analytics-consent";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Escolha sobre estatísticas do site");

    const message = document.createElement("p");
    message.textContent = "A BC pode usar cookies de estatísticas para contar visitas a esta página e cliques nos canais de contato? Você pode mudar sua escolha no rodapé.";
    const buttons = document.createElement("div");
    buttons.className = "bc-analytics-actions";

    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "Recusar";
    reject.addEventListener("click", () => setChoice("rejected"));

    const allow = document.createElement("button");
    allow.type = "button";
    allow.className = "bc-analytics-allow";
    allow.textContent = "Permitir estatísticas";
    allow.addEventListener("click", () => setChoice("accepted"));

    buttons.append(reject, allow);
    banner.append(message, buttons);
    document.body.appendChild(banner);
  }

  function init() {
    const css = document.createElement("style");
    css.textContent = [
      ".bc-analytics-consent{position:fixed;z-index:9999;bottom:14px;left:14px;right:14px;max-width:620px;margin:0 auto;padding:16px 18px;background:#18120f;color:#fff;border:1px solid #9e8156;border-radius:14px;box-shadow:0 10px 35px #0008;font:14px/1.5 system-ui,sans-serif}",
      ".bc-analytics-consent p{margin:0 0 12px;color:#fff}",
      ".bc-analytics-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}",
      ".bc-analytics-actions button{cursor:pointer;border:1px solid #bb9c6c;background:transparent;color:#fff;padding:9px 14px;border-radius:8px;font:inherit}",
      ".bc-analytics-actions .bc-analytics-allow{background:#d5b681;color:#21170f;font-weight:700}",
      ".bc-analytics-preferences{margin-left:12px;background:none;border:0;padding:3px;color:inherit;text-decoration:underline;cursor:pointer;font:inherit;font-size:12px}",
      "@media(max-width:500px){.bc-analytics-consent{bottom:8px;left:8px;right:8px;padding:13px}.bc-analytics-actions button{flex:1}}",
    ].join("\n");
    document.head.appendChild(css);

    const footer = document.querySelector("footer");
    if (footer) {
      const preferences = document.createElement("button");
      preferences.type = "button";
      preferences.className = "bc-analytics-preferences";
      preferences.textContent = "Preferências de privacidade";
      preferences.addEventListener("click", showBanner);
      footer.appendChild(preferences);
    }

    const choice = storedChoice();
    if (choice === "accepted") startAnalytics();
    else if (choice !== "rejected") showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
