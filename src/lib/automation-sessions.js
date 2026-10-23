export async function sessionsReady(env){return Boolean(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='automation_sessions'").first());}
export function eventTime(value){if(!value)return 0;const n=Number(value);const ms=Number.isFinite(n)?(n<100000000000?n*1000:n):Date.parse(value);return Number.isFinite(ms)&&ms>0?ms:0;}
export async function openSession(env,igsid,type,source,event){
 if(!await sessionsReady(env))return;
 const now=Date.now();await env.DB.prepare(`INSERT INTO automation_sessions(igsid,source_type,source_id,state,source_event_at,started_at,expires_at) VALUES(?,?,?,'active',?,?,?)
 ON CONFLICT(igsid) DO UPDATE SET source_type=excluded.source_type,source_id=excluded.source_id,state='active',source_event_at=excluded.source_event_at,started_at=excluded.started_at,expires_at=excluded.expires_at`)
 .bind(igsid,type,source,eventTime(event.timestamp),now,now+86400000).run();
}
export async function activeSession(env,igsid,conversation,event){
 if(!await sessionsReady(env))return true;
 const s=await env.DB.prepare('SELECT * FROM automation_sessions WHERE igsid=?').bind(igsid).first();
 if(!s || s.state!=='active' || s.source_id!==conversation.source_comment_id || s.expires_at<Date.now())return false;
 const timestamp=eventTime(event.timestamp);
 return !(s.source_event_at && timestamp && timestamp<s.source_event_at);
}
export async function claimDelivery(env,igsid,source){
 if(!await sessionsReady(env))return true;
 return Boolean(await env.DB.prepare("UPDATE automation_sessions SET state='sending' WHERE igsid=? AND source_id=? AND state='active' RETURNING igsid").bind(igsid,source).first());
}
export async function closeDelivery(env,igsid,source,state='delivered'){
 if(await sessionsReady(env))await env.DB.prepare("UPDATE automation_sessions SET state=? WHERE igsid=? AND source_id=? AND state='sending'").bind(state,igsid,source).run();
}
