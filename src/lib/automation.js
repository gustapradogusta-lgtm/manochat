export function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function matchesKeyword(text, keyword) {
  const haystack = normalizeText(text);
  const needle = normalizeText(keyword);
  if (!needle) return false;
  return haystack.split(/[^a-z0-9_]+/i).includes(needle) || haystack.includes(needle);
}

export function nextStep({ stage, inboundText, followsBusiness, followRequired }) {
  const text = normalizeText(inboundText);

  if (!stage || stage === 'awaiting_reply') {
    if (!text) return { action: 'ignore', stage: stage || 'awaiting_reply' };
    if (!followRequired || followsBusiness) return { action: 'deliver', stage: 'delivered' };
    return { action: 'ask_follow', stage: 'awaiting_follow' };
  }

  if (stage === 'awaiting_follow') {
    if (followsBusiness) return { action: 'deliver', stage: 'delivered' };
    return { action: 'ask_follow', stage: 'awaiting_follow' };
  }

  return { action: 'ignore', stage: 'delivered' };
}

export function eventIdFor(kind, payload) {
  const id = payload?.id || payload?.mid || payload?.comment_id || payload?.timestamp;
  return `${kind}:${id || JSON.stringify(payload).slice(0, 180)}`;
}

export function parseInstagramEvents(body) {
  const output = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === 'comments' && change.value) {
        output.push({ type: 'comment', entryId: entry.id, ...change.value });
      }
    }
    for (const item of entry.messaging || []) {
      if (item.message?.is_echo) continue;
      if (item.message) {
        output.push({
          type: 'message',
          entryId: entry.id,
          senderId: item.sender?.id,
          recipientId: item.recipient?.id,
          timestamp: item.timestamp,
          message: item.message
        });
      }
    }
  }
  return output;
}
