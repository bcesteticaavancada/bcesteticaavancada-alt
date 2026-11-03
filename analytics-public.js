/* BC Estética — GA4 somente em páginas institucionais e após consentimento explícito. */
(() => {
  "use strict";

  const measurementId = "G-240XLK51VK";
  const choiceKey = "bc_analytics_consent_v1";
  const hosts = new Set([
    "bcesteticaavancada.com.br",
    "www.bcesteticaavancada.com.br",
    "bcesteticaavancada.github.io",
  ]);
  const excluded = /\/(?:gestao|admin|agenda|agendamento|backup|instalar|nfc)(?:\/|$)/i;
  if (!hosts.has(location.hostname) || excluded.test(location.pathname)) return;

  let active = false;
  let banner = null;

  function storedChoice() {
    try { return localStorage.getItem(choiceKey); } catch { return null; }
  }

  function saveChoice(choice) {
    try { localStorage.setItem(choiceKey, choice); } catch { /* Sem persistência: pedir novamente. */ }
  }

  function safeReferrer() {
    try { return document.referrer ? new URL(document.referrer).origin : ""; }
    catch { return ""; }
  }

  function startAnalytics() {
    if (active) return;
    active = true;

    // Nada do conteúdo de formulários, fragmentos ou parâmetros de URL é enviado.
    const cleanLocation = location.origin + location.pathname;
    const referrerOrigin = safeReferrer();
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };

    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: false,
      page_location: cleanLocation,
      page_referrer: referrerOrigin,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    window.gtag("event", "page_view", {
      send_to: measurementId,
      page_location: cleanLocation,
      page_referrer: referrerOrigin,
      page_title: document.title,
    });

    const tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(tag);
  }

  function hideBanner() {
    if (banner) banner.remove();
    banner = null;
  }

  function setChoice(choice) {
    saveChoice(choice);
    hideBanner();
    if (choice === "accepted") startAnalytics();
    else if (active) location.reload(); // Interrompe a tag já carregada após revogação.
  }

  function showBanner() {
    if (banner) return;
    banner = document.createElement("section");
    banner.className = "bc-analytics-consent";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Escolha sobre estatísticas do site");

    const message = document.createElement("p");
    message.textContent = "Podemos usar cookies de estatísticas para entender as visitas ao site? Não enviamos dados dos formulários clínicos ao Analytics.";
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
