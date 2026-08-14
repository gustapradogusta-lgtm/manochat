import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

for (const [path, expected] of [
  ['/privacy', 'Política de Privacidade'],
  ['/terms', 'Termos de Serviço'],
  ['/data-deletion', 'Exclusão de Dados']
]) {
  test(`publica ${path}`, async () => {
    const response = await worker.fetch(new Request(`https://manochat.test${path}`), {}, {});
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), new RegExp(expected));
  });
}

test('aceita HEAD nas páginas legais', async () => {
  const response = await worker.fetch(new Request('https://manochat.test/privacy', { method: 'HEAD' }), {}, {});
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});
