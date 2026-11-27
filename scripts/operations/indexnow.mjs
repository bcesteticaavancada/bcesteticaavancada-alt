import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DOMParser} from 'linkedom';

const origin = 'https://www.bcesteticaavancada.com.br';
const key = '344fc1cd179648fe8495ce927331cad2';
const git = (...args) => execFileSync('git', args, {encoding:'utf8', maxBuffer:32*1024*1024});
const revision = ref => git('rev-parse','--verify','--end-of-options',ref+'^{commit}').trim();
const digest = body => createHash('sha256').update(body).digest('hex');

function snapshot(ref) {
  const tree = new Map(git('ls-tree','-rz',ref).split('\0').filter(Boolean).map(line => {
    const [metadata,path] = line.split('\t');
    return [path, metadata.split(' ')[2]];
  }));
  const read = path => git('show', ref+':'+path);
  const xml = new DOMParser().parseFromString(read('sitemap.xml'),'application/xml');
  function pageAt(url) {
    const file = url.pathname.slice(1)+'index.html';
    if (!tree.has(file)) return null;
    const source = read(file);
    const doc = new DOMParser().parseFromString(source,'text/html');
    const assets = {};
    for (const el of doc.querySelectorAll('script[src],img[src],source[src],link[rel="stylesheet"],link[rel="preload"]')) {
      const attr = el.getAttribute('src') || el.getAttribute('href');
      if (!attr) continue;
      const asset = new URL(attr,url);
      if (asset.origin === origin && tree.has(asset.pathname.slice(1))) assets[asset.href] = tree.get(asset.pathname.slice(1));
    }
    return {file,hash:digest(source),assets};
  }
  const pages = new Map();
  for (const item of xml.querySelectorAll('loc')) {
    const url = new URL(item.textContent.trim());
    if (url.origin !== origin || !/^\/(?:[a-z0-9-]+\/)*$/.test(url.pathname) || url.href !== origin+url.pathname ||
        /^\/(?:gestao|admin|backup|instalar|supabase)(?:\/|$)/.test(url.pathname)) throw Error('URL de sitemap fora do escopo');
    const page=pageAt(url);
    if (!page) throw Error('Arquivo de página ausente: '+url.href);
    pages.set(url.href,page);
  }
  return {pages,tree,pageAt};
}

export function changes(before,after) {
  const base=snapshot(revision(before)), head=snapshot(revision(after)), result=[];
  for (const [url,page] of head.pages) {
    const previous=base.pages.get(url) || base.pageAt(new URL(url));
    const assets=Object.entries(page.assets).filter(([uri,sha])=>previous?.assets[uri]!==sha);
    if (!previous || previous.hash!==page.hash || assets.length) {
      result.push({url,kind:!previous?'criada':'modificada',hash:page.hash,assets});
    }
  }
  for (const [url,page] of base.pages) {
    if (!head.pages.has(url) && !head.tree.has(page.file)) result.push({url,kind:'removida'});
  }
  return result;
}

export async function submit(changed, request=fetch) {
  if (!changed.length) return 0;
  const keyLocation=origin+'/'+key+'.txt';
  const get=url=>request(url,{redirect:'error',signal:AbortSignal.timeout(12000)});
  const keyResponse=await get(keyLocation);
  if (keyResponse.status!==200 || (await keyResponse.text()).trim()!==key) throw Error('Verificação da chave pública falhou');
  const dependencies=new Map();
  for (const page of changed) {
    const response=await get(page.url);
    const verified=page.kind==='removida' ? [404,410].includes(response.status) :
      response.status===200 && digest(await response.text())===page.hash;
    if (!verified) throw Error('A publicação diverge da revisão. Envio cancelado: '+page.url);
    for (const [uri,sha] of page.assets || []) dependencies.set(uri,sha);
  }
  for (const [uri,sha] of dependencies) {
    const response=await get(uri);
    if (response.status!==200) throw Error('Recurso não publicado');
    const bytes=Buffer.from(await response.arrayBuffer());
    const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    if (blob!==sha) throw Error('Recurso divergente. Envio cancelado: '+uri);
  }
  const response=await request('https://api.indexnow.org/indexnow',{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
    headers:{'content-type':'application/json'},body:JSON.stringify({host:new URL(origin).hostname,key,keyLocation,urlList:changed.map(p=>p.url)})});
  if (![200,202].includes(response.status)) throw Error('IndexNow HTTP '+response.status);
  return response.status;
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [before,after,action,...extra]=process.argv.slice(2);
  if (!before || !after || extra.length || (action && action!=='--enviar-apos-publicacao')) throw Error('Informe revisão anterior, revisão publicada e, só após autorização, --enviar-apos-publicacao');
  const batch=changes(before,after);
  console.log(JSON.stringify(batch.map(({url,kind})=>({url,kind})),null,2));
  if (action) console.log('Resposta IndexNow:',await submit(batch));
}
