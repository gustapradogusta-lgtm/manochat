import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';
import {createSession,hmac} from '../src/lib/security.js';
import {eventFilter} from '../src/lib/dashboard.js';
import {duplicateCampaign,parseTags} from '../public/campaign-tools.js';

function database(includeFeatures=true){
 const sqlite=new DatabaseSync(':memory:');for(const f of ['0001_initial.sql','0002_public_reply.sql','0003_match_all_comments.sql',...(includeFeatures?['0004_dashboard_features.sql']:[])])sqlite.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const db={sqlite,prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return {success:true,meta:sqlite.prepare(sql).run(...values)};}};},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.all());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};return db;
}
async function call(env,path,body,method='GET') {const token=await createSession(env.SESSION_SECRET);return worker.fetch(new Request('https://manochat.test'+path,{method,headers:{cookie:`manochat_session=${token}`,...(body instanceof FormData?{}:{'content-type':'application/json'})},body:method==='GET'?undefined:body instanceof FormData?body:JSON.stringify(body)}),env,{});}
function envFor(db){return {DB:db,SESSION_SECRET:'session-for-test',META_APP_SECRET:'app-for-test',META_ACCESS_TOKEN:'fake-token-for-test',META_IG_USER_ID:'business',META_VERIFY_TOKEN:'verify-for-test'};}
async function sendWebhook(env,body){const raw=JSON.stringify(body),promises=[];const signature=await hmac(raw,env.META_APP_SECRET);const response=await worker.fetch(new Request('https://manochat.test/webhooks/instagram',{method:'POST',headers:{'x-hub-signature-256':`sha256=${signature}`},body:raw}),env,{waitUntil:p=>promises.push(p)});await Promise.all(promises);return response;}

 test('integridade dos arquivos revisados e do fluxo de webhook desta atualização',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('../VERIFY_META_BASELINE.json',import.meta.url)));
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 for(const [file,hash] of Object.entries(baseline.files))assert.equal(sha(fs.readFileSync(new URL('../'+file,import.meta.url))),hash,file);
 const code=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');assert.equal(sha(code.slice(code.indexOf('async function handleComment'),code.indexOf('async function simulate'))),baseline.webhookFlow);
 });
 test('migração mantém dados e aplica etiquetas só quando registra entrega',()=>{
 const db=database(false),sql=db.sqlite;sql.exec("INSERT INTO contacts(igsid,username) VALUES('contact','perfil'); INSERT INTO conversations(igsid,campaign_id,stage,source_comment_id) VALUES('contact',1,'awaiting_reply','comment'); INSERT INTO processed_events(event_id,event_type) VALUES('old-event','comment');");
 const before=sql.prepare('SELECT * FROM campaigns').all();sql.exec(fs.readFileSync(new URL('../migrations/0004_dashboard_features.sql',import.meta.url),'utf8'));assert.deepEqual(sql.prepare('SELECT * FROM campaigns').all(),before);assert.equal(sql.prepare('SELECT COUNT(*) n FROM processed_events').get().n,1);
 sql.prepare('INSERT INTO campaign_options(campaign_id,tags_json) VALUES (?,?)').run(1,JSON.stringify(['recebeu guia']));sql.exec("UPDATE conversations SET stage='delivered' WHERE igsid='contact'");assert.equal(sql.prepare('SELECT label FROM contact_labels').get().label,'recebeu guia');
 });
 test('painel funciona sem migração e arquivos desativados não afetam campanhas por link',async()=>{
 const db=database(false),env=envFor(db);const listing=await call(env,'/api/campaigns');assert.equal(listing.status,200);assert.equal((await listing.json()).campaigns.length,1);
 const caps=await (await call(env,'/api/capabilities')).json();assert.equal(caps.filesReady,false);
 const response=await call(env,'/api/files',{},'POST');assert.equal(response.status,503);assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM campaigns').get().n,1);
 });
 test('salva campanha e opções atomicamente, e conflito não modifica a original',async()=>{
 const db=database(),env=envFor(db),body={name:'Campanha nova',keyword:'GUIA',first_message:'Olá',delivery_message:'Aqui está',delivery_url:'https://exemplo.com/guia',follow_required:false,delivery_mode:'link',contact_tags:['recebeu guia']};
 assert.equal((await call(env,'/api/campaigns',body,'POST')).status,200);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM campaign_options').get().n,1);
 assert.equal((await call(env,'/api/campaigns',{...body,name:'Outra'},'POST')).status,409);assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM campaigns').get().n,2);
 assert.equal(db.sqlite.prepare("SELECT name FROM campaigns WHERE keyword='GUIA'").get().name,'Campanha nova');
 });
 test('eventos paginados em 15 com filtros combinados e busca literal',async()=>{
 const db=database(),env=envFor(db);db.sqlite.exec("INSERT INTO contacts(igsid,username) VALUES('c','perfil_1');");for(let i=0;i<36;i++)db.sqlite.prepare('INSERT INTO interactions(igsid,campaign_id,event_type,direction,status) VALUES(?,?,?,?,?)').run('c',1,i%2?'deliver':'private_reply','outbound',i%3?'sent':'failed');
 const a=await (await call(env,'/api/events',{page:1},'POST')).json(),b=await (await call(env,'/api/events',{page:2},'POST')).json();assert.equal(a.events.length,15);assert.equal(b.events.length,15);assert.equal(a.total,36);assert.ok(!a.events.some(x=>b.events.some(y=>y.id===x.id)));
 const filtered=await (await call(env,'/api/events',{campaign:1,type:'deliver',status:'sent',search:'perfil_1'},'POST')).json();assert.ok(filtered.events.every(e=>e.event_type==='deliver'&&e.status==='sent'));assert.equal(filtered.total,12);assert.equal(eventFilter({search:'%_'}).values[0],'%\\%\\_%');
 });
 test('envio autenticado e download de arquivo com segurança de conteúdo',async()=>{
 const db=database(),env=envFor(db),objects=new Map();env.FILES={async put(k,bytes){objects.set(k,bytes);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async head(k){return objects.has(k)?{}:null;},async delete(k){objects.delete(k);}};
 const form=new FormData();form.append('file',new File(['conteúdo PDF de teste'],'guia.pdf',{type:'application/pdf'}));const upload=await call(env,'/api/files',form,'POST');assert.equal(upload.status,201);const {file}=await upload.json();
 const result=await worker.fetch(new Request(file.url),env,{});assert.equal(result.status,200);assert.equal(await result.text(),'conteúdo PDF de teste');assert.match(result.headers.get('content-disposition'),/^attachment;/);assert.equal(result.headers.get('x-content-type-options'),'nosniff');
 const body={name:'Arquivo',keyword:'PDF',first_message:'Olá',delivery_message:'Conteúdo',delivery_mode:'file',delivery_file:file};assert.equal((await call(env,'/api/campaigns',body,'POST')).status,200);
 const row=db.sqlite.prepare("SELECT delivery_url FROM campaigns WHERE keyword='PDF'").get();assert.equal(row.delivery_url,file.url);
 assert.equal((await worker.fetch(new Request('https://manochat.test/api/files',{method:'POST',body:form}),env,{})).status,401);
 });
 test('contatos paginados e etiquetas editáveis, sem registros fictícios',async()=>{
 const db=database(),env=envFor(db);db.sqlite.exec("INSERT INTO contacts(igsid,username) VALUES('c','perfil');");assert.equal((await call(env,'/api/contacts/c/tags',{tags:['cliente','cliente','guia']},'PUT')).status,200);
 const result=await (await call(env,'/api/contacts?tag=cliente')).json();assert.equal(result.total,1);assert.deepEqual(result.contacts[0].tags,['cliente','guia']);
 assert.deepEqual(parseTags(' a,a, b '),['a','b']);const copy=duplicateCampaign({id:1,name:'Original',contact_tags:['a'],status:'active'},[{id:1,name:'Original'}]);assert.equal(copy.status,'paused');copy.contact_tags.push('b');
 });
 test('fluxo Meta completo: comentário, private reply, follow, entrega e deduplicação',async()=>{
 const db=database(),env=envFor(db),calls=[],originalFetch=globalThis.fetch;let follows=false;
 globalThis.fetch=async(url,options={})=>{calls.push({url,body:options.body?JSON.parse(options.body):null});return Response.json(options.method==='POST'?{recipient_id:'contact',message_id:'message-out',id:'reply-out'}:{username:'perfil',is_user_follow_business:follows});};
 try{
 const comment={entry:[{id:'business',changes:[{field:'comments',value:{id:'comment',text:'QUERO',from:{id:'contact',username:'perfil'},media:{id:'media'}}}]}]};
 assert.equal((await sendWebhook(env,comment)).status,200);assert.equal(db.sqlite.prepare("SELECT stage FROM conversations WHERE igsid='contact'").get().stage,'awaiting_reply');
 const message=(mid)=>({entry:[{id:'business',messaging:[{sender:{id:'contact'},recipient:{id:'business'},message:{mid,text:'quero'}}]}]});
 await sendWebhook(env,message('first'));assert.equal(db.sqlite.prepare("SELECT stage FROM conversations WHERE igsid='contact'").get().stage,'awaiting_follow');follows=true;await sendWebhook(env,message('second'));assert.equal(db.sqlite.prepare("SELECT stage FROM conversations WHERE igsid='contact'").get().stage,'delivered');
 const count=calls.length;await sendWebhook(env,comment);assert.equal(calls.length,count);assert.ok(calls.some(c=>c.body?.recipient?.comment_id==='comment'));assert.ok(calls.some(c=>c.body?.message?.text?.includes('https://exemplo.com/seu-link')));
 }finally{globalThis.fetch=originalFetch;}
 });
