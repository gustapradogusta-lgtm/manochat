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


export { database,call,envFor,sendWebhook };
