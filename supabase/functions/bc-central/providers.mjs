const gscSite='sc-domain:bcesteticaavancada.com.br';
export const subjects=Object.freeze({
  seo:'Como revisar uma divergência de canonical nas páginas institucionais da clínica?',
  operacao:'Como organizar uma reunião operacional e documentar decisões aprovadas?',
  comercial:'Como avaliar conversão, recorrência e satisfação com indicadores agregados e denominadores claros?',
});
export const scopes={search:'https://www.googleapis.com/auth/webmasters.readonly',analytics:'https://www.googleapis.com/auth/analytics.readonly',workspace:'https://www.googleapis.com/auth/drive.file'};

export function dateWindow(clock=new Date()) {
  const end=new Date(clock);end.setUTCDate(end.getUTCDate()-3);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-27);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}

export function buildProviders(env,request=fetch) {
  const has=(...keys)=>keys.every(k=>Boolean(env(k)));
  const tokenKey=kind=>({search:'BC_GSC_REFRESH_TOKEN',analytics:'BC_GA4_REFRESH_TOKEN',workspace:'BC_REPORT_REFRESH_TOKEN'})[kind];
  const oauth=kind=>has('BC_GOOGLE_ADMIN_EMAIL','BC_GOOGLE_CLIENT_ID','BC_GOOGLE_CLIENT_SECRET',tokenKey(kind));
  const configured={
    checks:true,vitals:true,
    search:oauth('search'),
    analytics:oauth('analytics') && /^\d+$/.test(env('BC_GA4_PROPERTY_ID')||''),
    workspace:oauth('workspace') && /^[\w-]{10,120}$/.test(env('BC_STAGING_FOLDER')||''),
    brief:env('BC_OPENAI_SPEND_APPROVED')==='yes' && has('OPENAI_API_KEY','BC_OPENAI_MODEL')
  };
  async function json(url,init) {
    const response=await request(url,{...init,redirect:'error',signal:AbortSignal.timeout(18000)});
    if (!response.ok) throw Error('provedor');
    return await response.json();
  }
  async function access(kind) {
    const token=await json('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({
      grant_type:'refresh_token',client_id:env('BC_GOOGLE_CLIENT_ID'),client_secret:env('BC_GOOGLE_CLIENT_SECRET'),refresh_token:env(tokenKey(kind))
    })});
    const granted=(token.scope||'').split(' ');
    const allowed=new Set([scopes[kind],'openid','email','profile','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile']);
    if (!token.access_token || !granted.includes(scopes[kind]) || granted.some(scope=>!allowed.has(scope))) throw Error('configuracao');
    const headers={Authorization:'Bearer '+token.access_token};
    const user=await json('https://openidconnect.googleapis.com/v1/userinfo',{headers});
    if (user.email_verified!==true || !env('BC_GOOGLE_ADMIN_EMAIL') || user.email?.toLowerCase()!==env('BC_GOOGLE_ADMIN_EMAIL').toLowerCase()) throw Error('configuracao');
    return headers;
  }
  async function post(url,body,headers) {
    return json(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  }
  const count=value=>{
    const n=Number(value);
    if (value==null || value==='' || !Number.isFinite(n) || n<0) throw Error('provedor');
    return n;
  };
  return {
    configured,scopes,
    async checks() {
      const root='https://api.github.com/repos/bcesteticaavancada/bcesteticaavancada-alt';
      const headers={Accept:'application/vnd.github+json','User-Agent':'BC-Gestao-Homologacao'};
      const pr=await json(root+'/pulls/92',{headers});
      if (!/^[a-f0-9]{40}$/.test(pr.head?.sha||'')) throw Error('provedor');
      const runs=await json(root+'/actions/runs?event=pull_request&head_sha='+pr.head.sha+'&per_page=30',{headers});
      const latest=new Map();
      for (const r of runs.workflow_runs||[]) {
        if (r.head_sha!==pr.head.sha || !['Site CI','Pre-anamnese CI'].includes(r.name)) continue;
        const old=latest.get(r.name);
        if (!old || r.id>old.id) latest.set(r.name,{id:r.id,name:r.name,status:r.status,conclusion:r.conclusion});
      }
      return {revision:pr.head.sha,checks:[...latest.values()]};
    },
    async vitals() {
      const site='https://www.bcesteticaavancada.com.br/';
      const endpoint=new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
      endpoint.searchParams.set('url',site);endpoint.searchParams.set('strategy','mobile');
      if(env('BC_PSI_KEY'))endpoint.searchParams.set('key',env('BC_PSI_KEY'));
      const data=await json(endpoint.toString(),{});
      const field=data.loadingExperience?.metrics||{};
      return {lcp:field.LARGEST_CONTENTFUL_PAINT_MS?.percentile??null,
        inp:field.INTERACTION_TO_NEXT_PAINT?.percentile??null,
        cls:field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile==null?null:field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile/100,
        labScore:data.lighthouseResult?.categories?.performance?.score??null,
        fieldScope:data.loadingExperience?.id===site?'pagina':data.loadingExperience?.id?'origem':null};
    },
    async search(period) {
      const data=await post('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(gscSite)+'/searchAnalytics/query',
        {startDate:period.start,endDate:period.end,dataState:'final',type:'web',aggregationType:'byProperty',rowLimit:1},await access('search'));
      if (!data.rows?.length) return {period,available:false};
      const r=data.rows[0];
      return {period,available:true,clicks:count(r.clicks),impressions:count(r.impressions),ctr:count(r.ctr),position:count(r.position)};
    },
    async analytics(period) {
      const data=await post('https://analyticsdata.googleapis.com/v1beta/properties/'+env('BC_GA4_PROPERTY_ID')+':runReport',
        {dateRanges:[{startDate:period.start,endDate:period.end}],metrics:[{name:'sessions'},{name:'screenPageViews'}],
        dimensionFilter:{filter:{fieldName:'hostName',stringFilter:{matchType:'EXACT',value:'www.bcesteticaavancada.com.br'}}}},await access('analytics'));
      if (!data.rows?.length) return {period,available:false};
      const m=data.rows[0].metricValues;
      return {period,available:true,sessions:count(m[0].value),views:count(m[1].value)};
    },
    async brief(topic) {
      if (!Object.hasOwn(subjects,topic)) throw Error('configuracao');
      const data=await post('https://api.openai.com/v1/responses',{
        model:env('BC_OPENAI_MODEL'),store:false,max_output_tokens:360,
        instructions:'Escreva uma nota de gestão breve em português para revisão humana. Use orientações gerais. Não invente resultados da clínica, diagnósticos, preços nem ações realizadas.',
        input:subjects[topic]
      },{Authorization:'Bearer '+env('OPENAI_API_KEY')});
      const answer=(data.output||[]).filter(i=>i.type==='message').flatMap(i=>i.content||[]).filter(i=>i.type==='output_text').map(i=>i.text).join('\n');
      if (data.status!=='completed' || !answer.trim()) throw Error('provedor');
      return {answer:answer.slice(0,4000)};
    },
    async workspace(period,key) {
      const headers=await access('workspace');
      const folder=env('BC_STAGING_FOLDER');
      const metadata=await json('https://www.googleapis.com/drive/v3/files/'+folder+'?fields=id,mimeType,trashed,capabilities(canAddChildren)',{headers});
      if(metadata.id!==folder || metadata.mimeType!=='application/vnd.google-apps.folder' || metadata.trashed || !metadata.capabilities?.canAddChildren) throw Error('configuracao');
      const report='BC Gestão | Registro de homologação\n\nPeríodo de referência: '+period.start+' a '+period.end+
        '\n\nRegistro técnico criado mediante confirmação. A equipe deve anexar as evidências de testes e revisar os indicadores do período.\n';
      const boundary='bc_'+key;
      const meta={name:'BC Gestão | Registro de homologação '+period.end,mimeType:'application/vnd.google-apps.document',parents:[folder],appProperties:{bc_request:key}};
      const payload='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+
        '\r\n--'+boundary+'\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n'+report+'\r\n--'+boundary+'--';
      const result=await json('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,parents,mimeType',
        {method:'POST',headers:{...headers,'content-type':'multipart/related; boundary='+boundary},body:payload});
      if (!/^[\w-]{1,160}$/.test(result.id||'') || result.mimeType!==meta.mimeType || !result.parents?.includes(folder)) throw Error('provedor');
      return {document:result.id};
    }
  };
}
