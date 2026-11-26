import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const publicPages = [
  "clinica/index.html", "equipe/index.html",
  "ambiente/index.html", "contato/index.html",
];
const protectedPages = [
  "index.html","mel/index.html","procedimentos/index.html","protocolos/index.html","resultados/index.html","valores/index.html",
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

function runScript(source, pathname, choice = null, options={}) {
  const head = fakeElement("head");
  const body = fakeElement("body");
  const footer = fakeElement("footer");
  const values = new Map();
  if (choice !== null) values.set("bc_analytics_consent_v2", choice);
  const document = {
    head, body, title: "BC Estética", referrer: options.referrer || "", cookie:"", addEventListener() {},
    readyState: "complete",
    createElement: fakeElement,
    querySelector: (selector) => selector === "footer" ? footer : null,
  };
  const location = {
    hostname: "www.bcesteticaavancada.com.br",
    origin: "https://www.bcesteticaavancada.com.br",
    pathname,
    search: options.search || "",
    hash: options.hash || "",
    reload() { this.reloaded = true; },
  };
  const window = options.window || {};
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

test("tag da BC somente nas quatro páginas institucionais elegíveis", async () => {
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

const source=await readFile(fromRoot("analytics-public.js"),"utf8");
// Apenas o fixture altera a política em memória. Nenhuma requisição externa é feita.
const approved=source.replace("const policyApproved = false","const policyApproved = true");
const scripts=ctx=>ctx.head.children.filter(el=>el.tagName==="script");

test("a versão entregue fica inerte mesmo com consentimento gravado",()=>{
  for (const page of ["/clinica/","/equipe/","/ambiente/","/contato/"]) {
    const ctx=runScript(source,page,"accepted");
    assert.equal(scripts(ctx).length,0);assert.equal(ctx.body.children.length,0);
  }
});
test("aceite, preferência e revogação usam um único contêiner e eventos fechados",()=>{
  const ctx=runScript(approved,"/clinica/");
  assert.equal(scripts(ctx).length,0);
  const banner=ctx.body.children[0];
  banner.children[1].children[1].listeners.click();
  assert.equal(scripts(ctx).length,1);assert.equal(scripts(ctx)[0].referrerPolicy,"no-referrer");
  assert.match(scripts(ctx)[0].src,/gtm\.js\?id=GTM-W8NFXSFW$/);
  assert.equal(ctx.window.dataLayer.filter(x=>x.event==="bc_institutional_view").length,1);
  assert.equal(ctx.window.dataLayer.at(-1).bc_page,"clinica");
  ctx.footer.children[0].listeners.click();
  ctx.body.children.at(-1).children[1].children[0].listeners.click();
  assert.equal(ctx.values.get("bc_analytics_consent_v2"),"rejected");assert.equal(ctx.location.reloaded,true);
});
test("recusa, rotas excluídas, parâmetros, referências sensíveis e tags anteriores não carregam o GTM",()=>{
  assert.equal(scripts(runScript(approved,"/equipe/","rejected")).length,0);
  for(const page of ["/","/procedimentos/","/protocolos/","/gestao/","/agenda/","/agendamento/","/nfc/","/valores/","/diamond/","/futura/"])
    assert.equal(scripts(runScript(approved,page,"accepted")).length,0,page);
  for(const options of [{search:"?email=teste"},{hash:"#cliente"},{referrer:"https://www.bcesteticaavancada.com.br/agenda/"},{referrer:"https://site.test/paciente"},{window:{dataLayer:[]}}])
    assert.equal(scripts(runScript(approved,"/clinica/","accepted",options)).length,0);
});
