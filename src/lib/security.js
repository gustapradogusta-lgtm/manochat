const encoder = new TextEncoder();

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false;
  const expected = await hmac(rawBody, appSecret);
  const actual = signatureHeader.slice(7);
  if (expected.length !== actual.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return mismatch === 0;
}

export async function createSession(secret) {
  const expires = Date.now() + 1000 * 60 * 60 * 12;
  const payload = `admin.${expires}`;
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function validSession(cookieHeader, secret) {
  const token = cookieHeader?.match(/(?:^|;\s*)manochat_session=([^;]+)/)?.[1];
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || Number(parts[1]) < Date.now()) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  return (await hmac(payload, secret)) === parts[2];
}
