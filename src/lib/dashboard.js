const json=(data,status=200)=>Response.json(data,{status});
export function parseLabels(value=[]) {const list=Array.isArray(value)?value:String(value).split(',');return [...new Set(list.map(v=>String(v).trim().slice(0,40)).filter(Boolean))].slice(0,15);}
export async function featuresReady(env){const row=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='campaign_options'").first();return Boolean(row);}
export async function capabilities(env){const ready=await featuresReady(env);return json({databaseReady:ready,filesReady:ready&&Boolean(env.FILES),fileLimit:25*1024*1024});}
export async function decorateCampaigns(env,campaigns){
 const stats=await env.DB.prepare(`SELECT campaign_id,
 COUNT(DISTINCT CASE WHEN event_type='private_reply' AND status='sent' THEN igsid END) entered,
 COUNT(DISTINCT CASE WHEN event_type IN ('ask_follow','deliver') AND status='sent' THEN igsid END) replied,
 COUNT(DISTINCT CASE WHEN event_type='deliver' AND status='sent' THEN igsid END) completed,
 SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed
 FROM interactions WHERE campaign_id IS NOT NULL GROUP BY campaign_id`).all();
 const byId=new Map((stats.results||[]).map(s=>[s.campaign_id,s]));
 const ready=await featuresReady(env);
 const options=ready?await env.DB.prepare('SELECT * FROM campaign_options').all():{results:[]};const byOptions=new Map(options.results.map(o=>[o.campaign_id,o]));
 return campaigns.map(c=>{const o=byOptions.get(c.id),r=byId.get(c.id);return {...c,delivery_mode:o?.delivery_mode||'link',delivery_link:o?.delivery_link??c.delivery_url,delivery_file:o?.file_json?JSON.parse(o.file_json):null,contact_tags:o?.tags_json?JSON.parse(o.tags_json):[],thumbnail_url:o?.thumbnail_url||null,publication_title:o?.publication_title||null,results:{entered:r?.entered||0,replied:r?.replied||0,delivered:r?.completed||0,failed:r?.failed||0}};});
}
export async function prepareDelivery(request,env,body){
 const mode=body.delivery_mode||'link',tags=parseLabels(body.contact_tags||[]),ready=await featuresReady(env);
 if(!['link','file','both'].includes(mode))return {error:'Forma de entrega inválida.',status:422};
 if(!ready&&(mode!=='link'||tags.length))return {error:'Aplique a migração 0004 antes de usar arquivos ou etiquetas.',status:503};
 // Older clients do not send delivery_mode; their existing stored delivery_url remains valid.
 const link=String(body.delivery_link??body.delivery_url??'').trim();
 if(mode!=='file'){try{const u=new URL(link);if(!['http:','https:'].includes(u.protocol))throw Error();}catch{return {error:'Informe um link http ou https válido.',status:422};}}
 let file=null,url=link;
 if(mode!=='link'){
   const id=String(body.delivery_file?.id||'');
   const row=await env.DB.prepare('SELECT id,name,size,type FROM uploaded_files WHERE id=?').bind(id).first();
   if(!row)return {error:'Selecione e envie o arquivo novamente.',status:422};
   if(!env.FILES)return {error:'Configure o armazenamento FILES na Cloudflare para usar arquivos.',status:503};
   file={...row,url:new URL(`/files/${row.id}`,request.url).href};
   url=mode==='both'?`${link}\n${file.url}`:file.url;
 }
 return {ready,mode,tags,file,link,url,thumbnail:String(body.thumbnail_url||'').slice(0,2048),title:String(body.publication_title||'').slice(0,300)};
}
export function optionsStatement(env,delivery,campaign,id){
 const args=[delivery.mode,delivery.link,delivery.file?JSON.stringify(delivery.file):null,JSON.stringify(delivery.tags),delivery.thumbnail||null,delivery.title||null];
 const target=id?'id=?':"keyword=? AND COALESCE(media_id,'')=?";
 return env.DB.prepare(`INSERT INTO campaign_options(campaign_id,delivery_mode,delivery_link,file_json,tags_json,thumbnail_url,publication_title)
 SELECT id,?,?,?,?,?,? FROM campaigns WHERE ${target}
 ON CONFLICT(campaign_id) DO UPDATE SET delivery_mode=excluded.delivery_mode,delivery_link=excluded.delivery_link,file_json=excluded.file_json,tags_json=excluded.tags_json,thumbnail_url=excluded.thumbnail_url,publication_title=excluded.publication_title`)
 .bind(...args,...(id?[id]:[campaign.keyword,campaign.mediaId||'']));
}
export function eventFilter(body={}){
 const clauses=['1=1'],values=[];
 for(const [key,column] of [['publication','c.media_id'],['campaign','i.campaign_id'],['type','i.event_type'],['status','i.status']])if(body[key]){clauses.push(`${column}=?`);values.push(String(body[key]));}
 const days=Number(body.days);if([1,7,30].includes(days)){clauses.push("i.created_at>=datetime('now',?)");values.push(`-${days} days`);}
 const term=String(body.search||'').trim().slice(0,120);if(term){clauses.push("(COALESCE(ct.username,'') LIKE ? ESCAPE '\\' OR COALESCE(c.name,'') LIKE ? ESCAPE '\\')");const p=`%${term.replace(/[\\%_]/g,'\\$&')}%`;values.push(p,p);}
 return {where:clauses.join(' AND '),values,page:Math.max(1,Math.floor(Number(body.page)||1))};
}
export async function events(request,env){
 const body=await request.json().catch(()=>({})),filter=eventFilter(body);
 const from='FROM interactions i LEFT JOIN campaigns c ON c.id=i.campaign_id LEFT JOIN contacts ct ON ct.igsid=i.igsid';
 const count=await env.DB.prepare(`SELECT COUNT(*) total ${from} WHERE ${filter.where}`).bind(...filter.values).first();
 const total=count?.total||0,pages=Math.max(1,Math.ceil(total/15)),page=Math.min(pages,filter.page);
 const rows=await env.DB.prepare(`SELECT i.*,ct.username,c.name campaign_name,c.media_id publication_id ${from} WHERE ${filter.where} ORDER BY i.id DESC LIMIT 15 OFFSET ?`).bind(...filter.values,(page-1)*15).all();
 return json({events:rows.results||[],total,pages,page});
}
export async function contacts(request,env){
 const url=new URL(request.url),search=url.searchParams.get('search')||'',tag=url.searchParams.get('tag')||'',page=Math.max(1,Math.floor(Number(url.searchParams.get('page'))||1));
 const ready=await featuresReady(env),clauses=['1=1'],values=[];
 if(search){clauses.push('COALESCE(ct.username,ct.igsid) LIKE ?');values.push(`%${search.slice(0,120)}%`);}
 if(tag&&ready){clauses.push('EXISTS (SELECT 1 FROM contact_labels l WHERE l.igsid=ct.igsid AND l.label=?)');values.push(tag);}
 const where=clauses.join(' AND ');
 const count=await env.DB.prepare(`SELECT COUNT(*) total FROM contacts ct WHERE ${where}`).bind(...values).first();
 const total=count?.total||0,pages=Math.max(1,Math.ceil(total/15)),current=Math.min(page,pages);
 const rows=await env.DB.prepare(`SELECT ct.igsid id,ct.username,ct.last_seen_at,c.name campaign FROM contacts ct LEFT JOIN conversations v ON v.igsid=ct.igsid LEFT JOIN campaigns c ON c.id=v.campaign_id WHERE ${where} ORDER BY ct.last_seen_at DESC,ct.igsid LIMIT 15 OFFSET ?`).bind(...values,(current-1)*15).all();
 const labels=ready?await env.DB.prepare('SELECT DISTINCT label FROM contact_labels ORDER BY label').all():{results:[]};
 const ids=rows.results.map(c=>c.id);const attached=ready&&ids.length?await env.DB.prepare(`SELECT igsid,label FROM contact_labels WHERE igsid IN (${ids.map(()=>'?').join(',')}) ORDER BY label`).bind(...ids).all():{results:[]};
 return json({contacts:rows.results.map(c=>({...c,tags:attached.results.filter(t=>t.igsid===c.id).map(t=>t.label)})),labels:labels.results.map(l=>l.label),total,page:current,pages,labelsReady:ready});
}
export async function saveLabels(request,env,id){
 if(!await featuresReady(env))return json({error:'Aplique a migração 0004 para usar etiquetas.'},503);
 if(!await env.DB.prepare('SELECT igsid FROM contacts WHERE igsid=?').bind(id).first())return json({error:'Contato não encontrado.'},404);
 const body=await request.json().catch(()=>({})),labels=parseLabels(body.tags);
 await env.DB.batch([env.DB.prepare('DELETE FROM contact_labels WHERE igsid=?').bind(id),...labels.map(label=>env.DB.prepare('INSERT INTO contact_labels(igsid,label) VALUES (?,?)').bind(id,label))]);return json({ok:true});
}
export async function uploadFile(request,env){
 if(!env.FILES)return json({error:'Para enviar arquivos, configure o binding FILES de um bucket R2 na Cloudflare.'},503);
 if(!await featuresReady(env))return json({error:'Aplique a migração 0004 para enviar arquivos.'},503);
 const max=25*1024*1024;if(Number(request.headers.get('content-length')||0)>max+1024*1024)return json({error:'O arquivo deve ter até 25 MB.'},413);
 const form=await request.formData().catch(()=>null),file=form?.get('file');
 if(!file||typeof file==='string'||!file.size)return json({error:'Selecione um arquivo com conteúdo.'},422);
 if(file.size>max)return json({error:'O arquivo deve ter até 25 MB.'},413);
 const id=crypto.randomUUID(),key=`deliveries/${id}`,name=file.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,240)||'arquivo',type=file.type||'application/octet-stream';
 await env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:type}});
 try{await env.DB.prepare('INSERT INTO uploaded_files(id,object_key,name,size,type) VALUES (?,?,?,?,?)').bind(id,key,name,file.size,type).run();}catch(error){await env.FILES.delete(key);throw error;}
 return json({file:{id,name,size:file.size,type,url:new URL(`/files/${id}`,request.url).href}},201);
}
export async function downloadFile(request,env,id){
 if(!env.FILES||!await featuresReady(env))return new Response('Arquivo indisponível',{status:404});
 const row=await env.DB.prepare('SELECT * FROM uploaded_files WHERE id=?').bind(id).first();if(!row)return new Response('Arquivo não encontrado',{status:404});
 const object=request.method==='HEAD'?await env.FILES.head(row.object_key):await env.FILES.get(row.object_key);if(!object)return new Response('Arquivo não encontrado',{status:404});
 const filename=encodeURIComponent(row.name).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
 return new Response(request.method==='HEAD'?null:object.body,{headers:{'content-type':'application/octet-stream','content-disposition':`attachment; filename*=UTF-8''${filename}`,'content-length':String(row.size),'x-content-type-options':'nosniff','content-security-policy':"sandbox; default-src 'none'",'cache-control':'private, max-age=0, no-store'}});
}
