import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const publicPages = [
  "index.html", "clinica/index.html", "equipe/index.html", "mel/index.html",
  "procedimentos/index.html", "protocolos/index.html", "resultados/index.html",
  "ambiente/index.html", "valores/index.html", "contato/index.html",
];
const protectedPages = [
  "gestao/index.html", "gestao/login/index.html", "gestao/anamnese-remota/index.html",
  "admin/index.html", "agenda/index.html", "agendamento/index.html",
];
const fromRoot = (path) => new URL("../../" + path, import.meta.url);

function fakeElement(tagName) {
  return {
    tagName, children: [], listeners: {},
    appendChild(el) { this.children.push(el); return el; },
    append(...els) { this.children.push(...els); },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    setAttribute(name, value) { this[name] = value; },
    remove() { this.removed = true; },
  };
}

function runScript(source, pathname, choice = null) {
  const head = fakeElement("head");
  const body = fakeElement("body");
  const footer = fakeElement("footer");
  const values = new Map();
  if (choice !== null) values.set("bc_analytics_consent_v1", choice);
  const document = {
    head, body, title: "BC Estética", referrer: "https://google.com/search?q=nome-paciente",
    readyState: "complete",
    createElement: fakeElement,
    querySelector: (selector) => selector === "footer" ? footer : null,
  };
  const location = {
    hostname: "www.bcesteticaavancada.com.br",
    origin: "https://www.bcesteticaavancada.com.br",
    pathname,
    search: "?email=paciente%40example.com&saude=teste",
    hash: "#dados",
    reload() { this.reloaded = true; },
  };
  const window = {};
  vm.runInNewContext(source, {
    window, document, location,
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    URL, Set, Date, encodeURIComponent,
  }, { timeout: 1000 });
  return { head, body, footer, window, location, values };
}

test("tag da BC somente nas dez páginas institucionais", async () => {
  for (const path of publicPages) {
    const html = await readFile(fromRoot(path), "utf8");
    const relative = path === "index.html" ? "analytics-public.js" : "../analytics-public.js";
    assert.ok(html.includes('<script defer src="' + relative + '"></script>'), path);
    assert.equal((html.match(/analytics-public\.js/g) || []).length, 1, path);
  }
  for (const path of protectedPages) {
    const html = await readFile(fromRoot(path), "utf8");
    assert.doesNotMatch(html, /analytics-public\.js|G-240XLK51VK/, path);
  }
});

test("nenhuma tag de terceiros antes do aceite expresso", async () => {
  const script = await readFile(fromRoot("analytics-public.js"), "utf8");
  const ctx = runScript(script, "/");
  assert.equal(ctx.head.children.filter((node) => node.tagName === "script").length, 0);
  const banner = ctx.body.children.find((node) => node.tagName === "section");
  assert.ok(banner);
  assert.ok(ctx.footer.children.some((node) => node.textContent === "Preferências de privacidade"));

  const buttons = banner.children[1].children;
  buttons[1].listeners.click();
  assert.equal(ctx.values.get("bc_analytics_consent_v1"), "accepted");
  const tags = ctx.head.children.filter((node) => node.tagName === "script");
  assert.equal(tags.length, 1);
  assert.match(tags[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-240XLK51VK$/);
  const events = ctx.window.dataLayer.map((args) => Array.from(args));
  const config = events.find((entry) => entry[0] === "config");
  const pageview = events.find((entry) => entry[0] === "event" && entry[1] === "page_view");
  assert.equal(config[2].send_page_view, false);
  assert.equal(pageview[2].page_location, "https://www.bcesteticaavancada.com.br/");
  assert.equal(pageview[2].page_referrer, "https://google.com");
  assert.doesNotMatch(JSON.stringify(events), /paciente|saude=teste|nome-paciente|example\.com/);
});

test("recusa e rotas sensíveis nunca inicializam o GA4", async () => {
  const script = await readFile(fromRoot("analytics-public.js"), "utf8");
  const rejected = runScript(script, "/", "rejected");
  assert.equal(rejected.head.children.filter((node) => node.tagName === "script").length, 0);
  assert.equal(rejected.body.children.filter((node) => node.tagName === "section").length, 0);
  for (const path of ["/gestao/", "/gestao/anamnese-remota/", "/agendamento/", "/agenda/", "/nfc/"]) {
    const ctx = runScript(script, path, "accepted");
    assert.equal(ctx.head.children.length, 0, path);
    assert.equal(ctx.body.children.length, 0, path);
  }
});
