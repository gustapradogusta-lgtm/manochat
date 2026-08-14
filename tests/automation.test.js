import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesKeyword, nextStep, parseInstagramEvents } from '../src/lib/automation.js';

test('palavra-chave ignora caixa e acentos', () => {
  assert.equal(matchesKeyword('Eu QUERO o material!', 'quero'), true);
  assert.equal(matchesKeyword('próximo', 'proximo'), true);
  assert.equal(matchesKeyword('não tenho interesse', 'quero'), false);
});

test('follow gate entrega somente após seguir', () => {
  assert.deepEqual(nextStep({ stage: 'awaiting_reply', inboundText: 'quero', followsBusiness: false, followRequired: true }), { action: 'ask_follow', stage: 'awaiting_follow' });
  assert.deepEqual(nextStep({ stage: 'awaiting_follow', inboundText: 'pronto', followsBusiness: true, followRequired: true }), { action: 'deliver', stage: 'delivered' });
});

test('campanha sem follow obrigatório entrega direto', () => {
  assert.equal(nextStep({ stage: 'awaiting_reply', inboundText: 'quero', followsBusiness: false, followRequired: false }).action, 'deliver');
});

test('parser ignora mensagens de eco', () => {
  const events = parseInstagramEvents({ entry: [{ messaging: [
    { sender: { id: '1' }, message: { mid: 'a', text: 'oi', is_echo: true } },
    { sender: { id: '2' }, message: { mid: 'b', text: 'quero' } }
  ] }] });
  assert.equal(events.length, 1);
  assert.equal(events[0].senderId, '2');
});
