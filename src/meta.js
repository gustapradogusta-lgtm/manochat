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
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: typeof text === 'string' ? { text } : text })
  });
}

export function sendCommentReply(env, commentId, text) {
  return callMeta(env, `${commentId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ message: text })
  });
}

export function sendMessage(env, igsid, text, igUserId = env.META_IG_USER_ID) {
  return callMeta(env, `${igUserId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ recipient: { id: igsid }, message: typeof text === 'string' ? { text } : text })
  });
}

export function getProfile(env, igsid) {
  return callMeta(env, `${igsid}?fields=username,is_user_follow_business`);
}

export function listMedia(env, limit = 25) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 50);
  return callMeta(env, `me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${safeLimit}`);
}

// Refresh signed cover URLs independently of comment and DM processing.
export function getMedia(env, id) {
  if(!/^[a-z0-9_-]{1,80}$/i.test(id))throw Error('Publicação inválida.');
  return callMeta(env, `${encodeURIComponent(id)}?fields=id,media_type,media_url,thumbnail_url`,{signal:AbortSignal.timeout(8000)});
}

export function listStories(env, after='') {
  const account=encodeURIComponent(env.META_IG_USER_ID || 'me');
  return callMeta(env, `${account}/stories?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp&limit=50${after?'&after='+encodeURIComponent(after):''}`,{signal:AbortSignal.timeout(8000)});
}
