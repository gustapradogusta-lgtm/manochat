import test from 'node:test';
import assert from 'node:assert/strict';
import { isOwnInstagramComment, matchesCommentCampaign, matchesKeyword, nextStep, parseInstagramEvents } from '../src/lib/automation.js';

test('palavra-chave ignora caixa e acentos', () => {
  assert.equal(matchesKeyword('Eu QUERO o material!', 'quero'), true);
  assert.equal(matchesKeyword('próximo', 'proximo'), true);
  assert.equal(matchesKeyword('não tenho interesse', 'quero'), false);
});

test('aceita várias palavras-chave separadas por vírgula, ponto e vírgula ou linha', () => {
  assert.equal(matchesKeyword('Pode me mandar o GUIA?', 'quero, guia, material'), true);
  assert.equal(matchesKeyword('Eu quero a planilha', 'ebook; planilha'), true);
  assert.equal(matchesKeyword('Envie o conteúdo', 'curso\nconteúdo'), true);
  assert.equal(matchesKeyword('Só estou olhando', 'quero, guia, material'), false);
});

test('modo qualquer comentário ignora o texto somente quando ativado', () => {
  assert.equal(matchesCommentCampaign('Gostei muito!', { keyword: 'quero', match_all_comments: 1 }), true);
  assert.equal(matchesCommentCampaign('Gostei muito!', { keyword: 'quero', match_all_comments: 0 }), false);
});

test('comentário do próprio Instagram conectado é identificado', () => {
  assert.equal(isOwnInstagramComment({ from: { id: 'business-1' } }, 'business-1'), true);
  assert.equal(isOwnInstagramComment({ from: { id: 'customer-1' } }, 'business-1'), false);
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

test('parser reconhece comentário enviado pelo webhook da Meta', () => {
  const events = parseInstagramEvents({
    object: 'instagram',
    entry: [{
      id: 'ig-business-id',
      changes: [{
        field: 'comments',
        value: {
          id: 'comment-id',
          text: 'QUERO',
          from: { id: 'igsid', username: 'cliente' },
          media: { id: 'media-id' }
        }
      }]
    }]
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'comment');
  assert.equal(events[0].id, 'comment-id');
  assert.equal(events[0].text, 'QUERO');
  assert.equal(events[0].media.id, 'media-id');
});
