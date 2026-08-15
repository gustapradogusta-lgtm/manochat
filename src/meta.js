function metaUrl(env, path) {
  return `https://graph.instagram.com/${env.META_API_VERSION || 'v26.0'}/${path}`;
}

async function callMeta(env, path, options = {}) {
  const response = await fetch(metaUrl(env, path), {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Meta API: HTTP ${response.status}`);
    error.meta = data?.error || data;
    error.status = response.status;
    throw error;
  }
  return data;
}

export function sendPrivateReply(env, commentId, text, igUserId = env.META_IG_USER_ID) {
  return callMeta(env, `${igUserId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } })
  });
}

export function sendMessage(env, igsid, text, igUserId = env.META_IG_USER_ID) {
  return callMeta(env, `${igUserId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ recipient: { id: igsid }, message: { text } })
  });
}

export function getProfile(env, igsid) {
  return callMeta(env, `${igsid}?fields=username,is_user_follow_business`);
}
