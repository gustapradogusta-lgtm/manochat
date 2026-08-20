export function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function matchesKeyword(text, keyword) {
  const haystack = normalizeText(text);
  const needles = String(keyword || '')
    .split(/[,;\n]+/)
    .map(normalizeText)
    .filter(Boolean);
  if (!needles.length) return false;
  const words = haystack.split(/[^a-z0-9_]+/i);
  return needles.some((needle) => words.includes(needle) || haystack.includes(needle));
}

export function matchesCommentCampaign(text, campaign = {}) {
  return Boolean(campaign.match_all_comments) || matchesKeyword(text, campaign.keyword);
}

export function isOwnInstagramComment(event = {}, instagramUserId) {
  const authorId = event.from?.id || event.user_id || null;
  return Boolean(authorId && instagramUserId && String(authorId) === String(instagramUserId));
}

export function isInstagramCommentReply(event = {}) {
  return Boolean(event.parent_id || event.parent?.id || event.reply_to?.id);
}

export function isInstagramStoryMessage(event = {}) {
  const message = event.message || {};
  const referralSource = message.referral?.source || event.referral?.source || '';
  const hasStoryAttachment = (message.attachments || []).some((attachment) =>
    String(attachment.type || '').toLowerCase().includes('story'));
  return Boolean(
    message.reply_to?.story ||
    message.story ||
    String(referralSource).toLowerCase().includes('story') ||
    hasStoryAttachment
  );
}

export function canContinueCommentConversation(conversation) {
  return Boolean(
    conversation?.source_comment_id &&
    ['awaiting_reply', 'awaiting_follow'].includes(conversation.stage)
  );
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
