import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {database,call,envFor,sendWebhook} from './helpers.js';
import {parseStoryLink,resolveStory} from '../src/lib/story-campaigns.js';
const uuid='ee3d08f0-6ddf-4b21-8135-4d2339288b10';
const config={first:[{id:uuid,label:'RECEBER CONTEÚDO',action:'continue'}],follow:[{id:uuid,label:'JÁ TE SEGUI',action:'continue'}],delivery:[{id:uuid,label:'ACESSAR CONTEÚDO',action:'delivery_link'}]};
const storyLink='https://www.instagram.com/stories/meuperfil/33333333333333333/';
const story={id:'17999999999999999',permalink:storyLink,media_type:'IMAGE',media_url:'https://scontent.cdninstagram.com/story.jpg'};
const body={name:'Story Guia',keyword:'GUIA',trigger_type:'story',story_link:storyLink,first_message:'Toque em receber',follow_message:'Siga e confirme',delivery_message:'Aqui está!',delivery_mode:'link',delivery_link:'https://example.com/guia',follow_required:true,buttons:config};
function setup(){const db=database();for(const name of ['0005_campaign_buttons.sql','0006_stories_sessions.sql'])db.sqlite.exec(fs.readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));return envFor(db);}
function mock(t){let follows=false,failDelivery=false;const calls=[],original=globalThis.fetch;globalThis.fetch=async(url,options={})=>{
 const payload=options.body?JSON.parse(options.body):null;calls.push({url:String(url),payload});
 if(String(url).includes('/stories?'))return Response.json({data:[story]});
 if(options.method==='POST'){if(failDelivery&&payload.message?.attachment?.payload?.buttons?.some(b=>b.title==='ACESSAR CONTEÚDO'))return Response.json({error:{message:'Delivery uncertain'}},{status:500});return Response.json({recipient_id:'contact',message_id:'out',id:'reply'});}
 return Response.json({username:'contact',is_user_follow_business:follows});
 };t.after(()=>globalThis.fetch=original);return {calls,follow:()=>{follows=true;},fail:()=>{failDelivery=true;},out:()=>calls.filter(c=>c.payload?.recipient)};
}
const messaging=(message,timestamp=Date.now())=>({entry:[{id:'business',messaging:[{sender:{id:'contact'},recipient:{id:'business'},timestamp,message}]}]});
const reply=(mid='story-1',id=story.id,text='GUIA',timestamp=Date.now())=>messaging({mid,text,reply_to:{story:{id,url:'https://lookaside.fbsbx.com/story'}}},timestamp);
const message=(mid='dm-1',text='QUERO',timestamp=Date.now())=>messaging({mid,text},timestamp);
const click=(payload,mid='click-1',timestamp=Date.now())=>({entry:[{id:'business',messaging:[{sender:{id:'contact'},recipient:{id:'business'},timestamp,postback:{mid,payload}}]}]});
const comment=(id='comment-1',timestamp=Date.now())=>({entry:[{id:'business',changes:[{field:'comments',value:{id,timestamp,text:'QUERO',from:{id:'contact'},media:{id:'post'}}}]}]});
const template=c=>c?.payload?.message?.attachment?.payload;
async function createStory(env){const response=await call(env,'/api/campaigns',body,'POST');assert.equal(response.status,200,await response.text());}
test('migration 0006 is repeatable, preserves records and backfills delivered conversations as terminal',()=>{
 const env=envFor(database());env.DB.sqlite.exec("INSERT INTO contacts(igsid) VALUES('contact'); INSERT INTO conversations(igsid,campaign_id,stage,source_comment_id) VALUES('contact',1,'delivered','comment');");
 const before=env.DB.sqlite.prepare('SELECT * FROM campaigns').all(),sql=fs.readFileSync(new URL('../migrations/0006_stories_sessions.sql',import.meta.url),'utf8');env.DB.sqlite.exec(sql);env.DB.sqlite.exec(sql);assert.deepEqual(env.DB.sqlite.prepare('SELECT * FROM campaigns').all(),before);assert.equal(env.DB.sqlite.prepare('SELECT state FROM automation_sessions').get().state,'delivered');
});
test('Story links normalize tracking parameters and reject external hosts, highlights and short links',()=>{
 assert.equal(parseStoryLink('https://instagram.com/stories/MeuPerfil/123/?igsh=tracking').url,'https://www.instagram.com/stories/meuperfil/123/');
 for(const link of ['https://example.com/stories/me/123/','https://instagram.com/stories/highlights/123/','https://instagram.com/s/abcd','https://instagram.com@evil.test/stories/me/123/'])assert.throws(()=>parseStoryLink(link));
});
test('link resolution matches owned active Story permalinks across pages, keeping API ID and link ID separate',async t=>{
 const original=globalThis.fetch;let n=0;globalThis.fetch=async()=>Response.json(++n===1?{data:[],paging:{next:'unused',cursors:{after:'cursor'}}}:{data:[story]});t.after(()=>globalThis.fetch=original);
 const result=await resolveStory(setup(),storyLink);assert.equal(n,2);assert.equal(result.story_id,story.id);assert.equal(result.story_link_id,'33333333333333333');
 await assert.rejects(resolveStory(setup(),'https://instagram.com/stories/outro/33333333333333333/'),/Não encontramos/);
});
test('Story campaign saves with verified link, lists its trigger and preserves configuration for old clients',async t=>{
 const env=setup();mock(t);await createStory(env);const rows=(await (await call(env,'/api/campaigns')).json()).campaigns;const c=rows.find(c=>c.trigger_type==='story');assert.equal(c.media_id,'story:33333333333333333');assert.equal(c.story_id,story.id);assert.equal(c.public_reply,'');
 const {trigger_type,story_link,...oldClient}=body;assert.equal((await call(env,`/api/campaigns/${c.id}`,{...oldClient,name:'Rename',media_id:c.media_id},'PUT')).status,200);assert.equal(env.DB.sqlite.prepare('SELECT trigger_type FROM campaign_triggers WHERE campaign_id=?').get(c.id).trigger_type,'story');
});
test('missing migration or an unverified link rejects Story campaigns without changing existing campaigns',async t=>{
 const env=envFor(database());mock(t);assert.equal((await call(env,'/api/campaigns',body,'POST')).status,503);
 const ready=setup();assert.equal((await call(ready,'/api/campaigns',{...body,story_link:'https://instagram.com/stories/another/999/'},'POST')).status,422);assert.equal(ready.DB.sqlite.prepare('SELECT COUNT(*) n FROM campaigns').get().n,1);
});
test('a reply to the selected Story starts a DM with buttons; delivery closes it and only a fresh Story reply can restart',async t=>{
 const env=setup(),m=mock(t);await createStory(env);await sendWebhook(env,reply());const first=m.out().at(-1);assert.equal(first.payload.recipient.id,'contact');assert.equal(first.payload.recipient.comment_id,undefined);const firstPayload=template(first).buttons[0].payload;
 await sendWebhook(env,click(firstPayload));const followPayload=template(m.out().at(-1)).buttons[0].payload;m.follow();await sendWebhook(env,click(followPayload,'follow'));assert.equal(template(m.out().at(-1)).text,'Aqui está!');assert.equal(env.DB.sqlite.prepare('SELECT state FROM automation_sessions').get().state,'delivered');
 const count=m.calls.length;await sendWebhook(env,message('thanks','obrigado'));await sendWebhook(env,click(followPayload,'old-click'));await sendWebhook(env,reply());assert.equal(m.calls.length,count);
 await sendWebhook(env,reply('story-2'));assert.equal(m.out().length,4);const now=m.calls.length;await sendWebhook(env,click(firstPayload,'stale-first'));assert.equal(m.calls.length,now);
});
test('ordinary DMs, mentions, referrals, unrelated Story IDs and nonmatching words never start a campaign',async t=>{
 const env=setup(),m=mock(t);await createStory(env);const count=m.calls.length;
 for(const event of [message(),reply('wrong-story','999'),reply('wrong-word',story.id,'Olá'),messaging({mid:'mention',text:'GUIA',attachments:[{type:'story_mention'}]}),messaging({mid:'referral',text:'GUIA',referral:{source:'STORY'}})])await sendWebhook(env,event);
 assert.equal(m.calls.length,count);assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM conversations').get().n,0);
});
test('comment delivery also closes permanently for DMs; a new comment is required to reopen',async t=>{
 const env=setup(),m=mock(t);m.follow();await sendWebhook(env,comment());await sendWebhook(env,message());assert.equal(env.DB.sqlite.prepare('SELECT state FROM automation_sessions').get().state,'delivered');const count=m.calls.length;
 await sendWebhook(env,message('extra','QUERO'));await sendWebhook(env,message('thanks','obrigado'));assert.equal(m.calls.length,count);
 // Even a secondary write failure or old stage cannot bypass the independent terminal guard.
 env.DB.sqlite.exec("UPDATE conversations SET stage='awaiting_reply'");await sendWebhook(env,message('stage-stale'));assert.equal(m.calls.length,count);
 await sendWebhook(env,comment('new-comment'));assert.ok(m.calls.length>count);assert.equal(env.DB.sqlite.prepare('SELECT state FROM automation_sessions').get().state,'active');
});
test('paused campaigns, expired sessions and events older than the trigger cannot continue',async t=>{
 const env=setup(),m=mock(t);m.follow();const now=Date.now();await sendWebhook(env,comment('c',now));const count=m.calls.length;
 env.DB.sqlite.exec("UPDATE campaigns SET status='paused'");await sendWebhook(env,message('paused'));assert.equal(m.calls.length,count);env.DB.sqlite.exec("UPDATE campaigns SET status='active'");
 await sendWebhook(env,message('old','QUERO',now-5000));assert.equal(m.calls.length,count);await sendWebhook(env,comment('old-comment',now-5000));assert.equal(m.calls.length,count);
 env.DB.sqlite.exec('UPDATE automation_sessions SET expires_at=1');await sendWebhook(env,message('expired'));assert.equal(m.calls.length,count);
});
test('ambiguous delivery errors are terminal instead of sending again after another DM',async t=>{
 const env=setup(),m=mock(t);await createStory(env);await sendWebhook(env,reply());m.follow();m.fail();await sendWebhook(env,click(template(m.out().at(-1)).buttons[0].payload));assert.equal(env.DB.sqlite.prepare('SELECT state FROM automation_sessions').get().state,'failed');const n=m.calls.length;await sendWebhook(env,message('retry','QUERO'));assert.equal(m.calls.length,n);
});
test('same webhook batch processes Story entry before its following message without duplicate delivery',async t=>{
 const env=setup(),m=mock(t);await createStory(env);m.follow();const batch=reply();batch.entry[0].messaging.push(message('batch-next').entry[0].messaging[0]);await sendWebhook(env,batch);assert.equal(env.DB.sqlite.prepare('SELECT state FROM automation_sessions').get().state,'delivered');assert.equal(m.out().length,2);
});
test('a successful external delivery stays terminal even if the following contact update fails',async t=>{
 const env=setup(),m=mock(t);await createStory(env);await sendWebhook(env,reply());m.follow();
 const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=sql=>{const statement=prepare(sql);if(sql.includes('INSERT INTO contacts(igsid, username, follows_business)'))statement.run=async()=>{throw Error('Simulated secondary write failure');};return statement;};
 await sendWebhook(env,click(template(m.out().at(-1)).buttons[0].payload));assert.equal(env.DB.sqlite.prepare('SELECT state FROM automation_sessions').get().state,'delivered');assert.equal(env.DB.sqlite.prepare('SELECT stage FROM conversations').get().stage,'awaiting_reply');const count=m.calls.length;
 await sendWebhook(env,message('after-db-failure','QUERO'));assert.equal(m.calls.length,count);
});
test('the Story link ID is accepted as an alias, and a matching post comment never triggers the Story campaign',async t=>{
 const env=setup(),m=mock(t);await createStory(env);const before=m.calls.length;const postComment=comment();postComment.entry[0].changes[0].value.text='GUIA';await sendWebhook(env,postComment);assert.equal(m.calls.length,before);
 await sendWebhook(env,reply('link-id','33333333333333333'));assert.equal(m.out().length,1);assert.equal(env.DB.sqlite.prepare('SELECT source_type FROM automation_sessions').get().source_type,'story');
});
