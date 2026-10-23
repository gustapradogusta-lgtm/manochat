import {listStories} from '../meta.js';
export async function storiesReady(env){return Boolean(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='campaign_triggers'").first());}
export function parseStoryLink(value){
 let url;try{url=new URL(String(value||'').trim());}catch{throw Error('Cole o link completo do Story do Instagram.');}
 if(!['instagram.com','www.instagram.com'].includes(url.hostname.toLowerCase()) || !['https:','http:'].includes(url.protocol) || url.username || url.password)throw Error('Use um link de Story do Instagram.');
 const match=/^\/stories\/([a-z0-9_.]+)\/(\d+)\/?$/i.exec(url.pathname);
 if(!match || match[1].toLowerCase()==='highlights')throw Error('Abra o Story e copie o link com o nome do perfil e o número do Story. Links de destaque e links encurtados não são aceitos.');
 return {username:match[1].toLowerCase(),linkId:match[2],url:`https://www.instagram.com/stories/${match[1].toLowerCase()}/${match[2]}/`};
}
export async function resolveStory(env,input){
 const parsed=parseStoryLink(input);let after='';
 for(let page=0;page<10;page++){
  const data=await listStories(env,after);
  for(const item of data.data||[]){
   let link;try{link=parseStoryLink(item.permalink);}catch{continue;}
   if(link.linkId===parsed.linkId && link.username===parsed.username)return {trigger_type:'story',story_id:String(item.id),story_link_id:link.linkId,story_link:link.url,story_username:link.username,thumbnail_url:item.thumbnail_url||(item.media_type==='IMAGE'?item.media_url:'')||'',publication_title:`Story de @${link.username}`};
  }
  if(!data.paging?.next || !data.paging?.cursors?.after)break;
  after=data.paging.cursors.after;
 }
 throw Error('Não encontramos esse Story ativo na conta conectada. Confira o link, se ele é do seu perfil e se ainda está no ar.');
}
export async function triggerFor(env,id){
 if(!await storiesReady(env))return {trigger_type:'comment'};
 return await env.DB.prepare('SELECT * FROM campaign_triggers WHERE campaign_id=?').bind(id).first()||{trigger_type:'comment'};
}
export function triggerStatement(env,trigger,campaign,id){
 return env.DB.prepare(`INSERT INTO campaign_triggers(campaign_id,trigger_type,story_id,story_link_id,story_link,story_username)
 SELECT id,?,?,?,?,? FROM campaigns WHERE ${id?'id=?':"keyword=? AND COALESCE(media_id,'')=?"}
 ON CONFLICT(campaign_id) DO UPDATE SET trigger_type=excluded.trigger_type,story_id=excluded.story_id,story_link_id=excluded.story_link_id,story_link=excluded.story_link,story_username=excluded.story_username`)
 .bind(trigger.trigger_type,trigger.story_id||null,trigger.story_link_id||null,trigger.story_link||null,trigger.story_username||null,...(id?[id]:[campaign.keyword,campaign.mediaId||'']));
}
