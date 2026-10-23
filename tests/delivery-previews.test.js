import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';
import {database,call,envFor} from './helpers.js';
import {deliveryText,fileViewUrl} from '../public/delivery-presentation.js';
import {campaignMessage} from '../src/lib/buttons.js';
import {viewFile} from '../src/lib/file-viewer.js';
import {mediaPreview} from '../src/lib/media-previews.js';
const id='11111111-1111-4111-8111-111111111111';
const file={id,url:`https://manochat.test/files/${id}`};
test('delivery hides only URLs covered by buttons; text-only and uncovered materials remain accessible',()=>{
 const c={delivery_message:'Seu conteúdo está aqui!',delivery_url:'https://example.com/guia\n'+file.url,delivery_link:'https://example.com/guia',delivery_file:file};
 assert.equal(deliveryText(c,[{action:'delivery_link'},{action:'delivery_file'}]),c.delivery_message);
 assert.equal(deliveryText(c,[{action:'delivery_link'}]),c.delivery_message+'\n'+file.url);
 assert.equal(deliveryText(c,[]),c.delivery_message+'\n'+c.delivery_url);
 assert.equal(fileViewUrl(file),`https://manochat.test/view/${id}`);
});
test('real message builder sends clean delivery text and document viewer button without changing first or follow payloads',async()=>{
 const db=database();db.sqlite.exec(fs.readFileSync(new URL('../migrations/0005_campaign_buttons.sql',import.meta.url),'utf8'));
 db.sqlite.prepare('INSERT INTO campaign_options(campaign_id,delivery_link,file_json) VALUES(1,?,?)').run('https://example.com/guia',JSON.stringify(file));
 db.sqlite.prepare('INSERT INTO campaign_buttons VALUES(1,?)').run(JSON.stringify({first:[],follow:[],delivery:[{action:'delivery_link',label:'ACESSAR CONTEÚDO'},{action:'delivery_file',label:'ABRIR DOCUMENTO'}]}));
 const env=envFor(db),c={id:1,source_comment_id:'comment',delivery_message:'Aqui está!',delivery_url:'https://example.com/guia\n'+file.url};
 const result=await campaignMessage(env,c,'delivery','Texto antigo com URL');
 assert.equal(result.attachment.payload.text,'Aqui está!');assert.equal(result.attachment.payload.buttons[1].url,fileViewUrl(file));
 assert.equal(await campaignMessage(env,c,'first','Oi!'),'Oi!');assert.equal(await campaignMessage(env,c,'follow','Siga o perfil'),'Siga o perfil');
});
function fileEnv(name='Guia.pdf',type='application/pdf',bytes='%PDF-1.7\nfixture'){
 const db=database();db.sqlite.prepare('INSERT INTO uploaded_files(id,object_key,name,size,type) VALUES(?,?,?,?,?)').run(id,'fixture',name,bytes.length,type);
 return {...envFor(db),FILES:{head:async()=>({size:bytes.length}),get:async(key,options)=>({body:options?.range?bytes.slice(0,5):bytes})}};
}
test('document page escapes filenames, PDF preview is inline and original download URL remains independent',async()=>{
 const env=fileEnv('Guia <img>.pdf');const r=await viewFile(new Request('https://test/view/'+id),env,id);const html=await r.text();assert.match(html,/Guia &lt;img&gt;.pdf/);assert.match(html,new RegExp('/preview/'+id));assert.match(html,new RegExp('/files/'+id));assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 const preview=await viewFile(new Request('https://test/preview/'+id),env,id,true);assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'application/pdf');assert.match(preview.headers.get('content-disposition'),/^inline/);assert.match(await preview.text(),/^%PDF-/);
});
test('non-PDF and disguised HTML cannot be rendered inline, missing storage is a graceful 404',async()=>{
 assert.equal((await viewFile(new Request('https://test'),fileEnv('File.html','text/html','<script>'),id,true)).status,415);
 assert.equal((await viewFile(new Request('https://test'),fileEnv('File.pdf','application/pdf','<html>fake'),id,true)).status,415);
 assert.equal((await viewFile(new Request('https://test'),envFor(database()),id)).status,404);
});
test('thumbnail route requires admin authentication',async()=>{
 const response=await worker.fetch(new Request('https://manochat.test/api/media/123/thumbnail'),envFor(database()),{});assert.equal(response.status,401);
});
test('thumbnail refreshes one media cover, sends token only to Meta and returns image bytes',async()=>{
 const original=globalThis.fetch;const requests=[];
 globalThis.fetch=async(url,options={})=>{requests.push([String(url),options]);return String(url).startsWith('https://graph.instagram.com/')?Response.json({id:'123',media_type:'VIDEO',thumbnail_url:'https://scontent.cdninstagram.com/new.jpg'}):new Response('image-fixture',{headers:{'content-type':'image/jpeg'}});};
 try{const r=await call(envFor(database()),'/api/media/123/thumbnail');assert.equal(r.status,200);assert.equal(await r.text(),'image-fixture');assert.match(requests[0][0],/\/123\?fields=/);assert.equal(requests[0][1].headers.authorization,'Bearer fake-token-for-test');assert.equal(requests[1][1].headers,undefined);}finally{globalThis.fetch=original;}
});
test('thumbnail proxy rejects external hosts and redirects, HTML content and video URLs without thumbnails',async()=>{
 const original=globalThis.fetch;
 try{
  for(const mode of ['host','redirect','html','video']){
   let calls=0;globalThis.fetch=async(url)=>{calls++;if(String(url).startsWith('https://graph.instagram.com/'))return Response.json({media_type:'VIDEO',media_url:'https://scontent.cdninstagram.com/video.mp4',...(mode==='video'?{}:{thumbnail_url:mode==='host'?'https://example.com/private':'https://scontent.cdninstagram.com/image.jpg'})});if(mode==='redirect')return new Response(null,{status:302,headers:{location:'https://example.com/private'}});return new Response('<html>',{headers:{'content-type':'text/html'}});};
   assert.notEqual((await mediaPreview(envFor(database()),'123')).status,200,mode);assert.equal(calls,mode==='host'||mode==='video'?1:2,mode);
  }
 }finally{globalThis.fetch=original;}
});
