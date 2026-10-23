import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendedMessages} from '../public/message-presets.js';
import {normalizeButtons} from '../src/lib/buttons.js';
test('first CTA is an actual continue postback only when first templates are enabled',()=>{
 const draft=recommendedMessages({buttonsReady:true,privateReplyButtonsEnabled:true});
 assert.equal(draft.buttons.first[0].label,'RECEBER CONTEÚDO');assert.equal(draft.buttons.first[0].action,'continue');
 assert.match(draft.first_message,/Toque no botão/);normalizeButtons(draft.buttons);
});
test('without opt-in first draft still invites a typed reply; following steps have buttons',()=>{
 const draft=recommendedMessages({buttonsReady:true,privateReplyButtonsEnabled:false});
 assert.match(draft.first_message,/Responda EU QUERO/);assert.equal(draft.buttons.first.length,0);assert.equal(draft.buttons.follow.length,1);assert.equal(draft.buttons.delivery.length,1);
});
test('no database migration means text-only drafts with actionable instructions',()=>{
 const draft=recommendedMessages({buttonsReady:false,privateReplyButtonsEnabled:true});
 assert.match(draft.first_message,/Responda/);assert.match(draft.follow_message,/responda PRONTO/);assert.match(draft.delivery_message,/link abaixo/);assert.deepEqual(draft.buttons,{first:[],follow:[],delivery:[]});
});
test('file delivery gets the correct destination; generated drafts do not share button identities',()=>{
 const caps={buttonsReady:true,privateReplyButtonsEnabled:true},a=recommendedMessages(caps,'file'),b=recommendedMessages(caps,'both');
 assert.equal(a.buttons.delivery[0].action,'delivery_file');assert.equal(b.buttons.delivery[0].action,'delivery_link');
 assert.notEqual(a.buttons.first[0].id,b.buttons.first[0].id);assert.ok(a.first_message.length<640);assert.ok(a.follow_message.length<640);
});
