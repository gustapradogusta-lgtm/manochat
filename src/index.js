import { eventIdFor, matchesKeyword, nextStep, parseInstagramEvents } from './lib/automation.js';
import { createSession, validSession, verifyMetaSignature } from './lib/security.js';
import { getProfile, sendMessage, sendPrivateReply } from './meta.js';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
});

const safeDetail = (error) => JSON.stringify({
  message: error?.message || 'Erro desconhecido',
  status: error?.status,
  code: error?.meta?.code,
  subcode: error?.meta?.error_subcode
});

const LEGAL_PAGES = {
  '/privacy': {
    title: 'Política de Privacidade',
    intro: 'Esta política explica como o ManoChat trata os dados necessários para automatizar interações na conta profissional do Instagram conectada pelo administrador.',
    sections: [
      ['Dados tratados', 'Podemos tratar identificadores do Instagram, nome de usuário, dados públicos do perfil e informações técnicas relacionadas a comentários, mensagens e entregas processadas pela automação.'],
      ['Finalidade', 'Os dados são usados exclusivamente para identificar palavras-chave, responder às interações configuradas, entregar o conteúdo solicitado, evitar processamento duplicado e apresentar o histórico no painel.'],
      ['Armazenamento e compartilhamento', 'Os registros operacionais ficam armazenados na infraestrutura Cloudflare utilizada pelo ManoChat. Os dados somente são compartilhados com a Meta e com provedores técnicos quando isso é necessário para executar o serviço.'],
      ['Retenção e exclusão', 'Os dados são mantidos pelo período necessário à operação e à segurança da automação. Você pode solicitar acesso, correção ou exclusão pelo e-mail informado abaixo.'],
      ['Segurança', 'São utilizados controles de acesso, variáveis secretas e validação das solicitações recebidas para reduzir o risco de acesso não autorizado.']
    ]
  },
  '/terms': {
    title: 'Termos de Serviço',
    intro: 'Estes termos regulam o uso do ManoChat, uma ferramenta privada de automação da conta profissional do Instagram do administrador.',
    sections: [
      ['Uso permitido', 'O serviço deve ser usado de acordo com as regras do Instagram e da Meta, somente em contas e conteúdos para os quais o administrador tenha autorização.'],
      ['Responsabilidade', 'O administrador é responsável pelas campanhas, mensagens, links e arquivos configurados, bem como pelo cumprimento da legislação aplicável.'],
      ['Disponibilidade', 'O funcionamento depende das APIs e da infraestrutura de terceiros. Atualizações, limites ou indisponibilidades desses serviços podem afetar a automação.'],
      ['Suspensão', 'O acesso pode ser interrompido para proteger dados, corrigir falhas ou impedir uso que viole estes termos ou as políticas das plataformas integradas.']
    ]
  },
  '/data-deletion': {
    title: 'Exclusão de Dados',
    intro: 'Você pode solicitar a exclusão dos dados associados às suas interações processadas pelo ManoChat.',
    sections: [
      ['Como solicitar', 'Envie um e-mail com o assunto “Exclusão de dados — ManoChat” e informe o seu nome de usuário do Instagram. A solicitação será confirmada e processada em até 30 dias.'],
      ['Revogar o acesso', 'Você também pode remover o acesso do aplicativo nas configurações do Instagram, em Apps e sites. A revogação impede novos acessos, mas não substitui o pedido de exclusão dos registros já armazenados.'],
      ['Confirmação', 'Após a conclusão, enviaremos uma confirmação para o endereço utilizado na solicitação, salvo quando a retenção for exigida por obrigação legal.']
    ]
  }
};

function legalPage(path, method) {
  const page = LEGAL_PAGES[path.replace(/\/$/, '') || '/'];
  if (!page || !['GET', 'HEAD'].includes(method)) return null;
  const sections = page.sections.map(([title, text]) => `<section><h2>${title}</h2><p>${text}</p></section>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${page.title} — ManoChat</title><style>\n+    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#10231b;background:#f4f7f4}*{box-sizing:border-box}body{margin:0}header{background:#123e31;color:#fff;padding:28px 24px}header div,main,footer{max-width:900px;margin:auto}.brand{font-size:22px;font-weight:800;color:#c7ff55;text-decoration:none}main{padding:64px 24px}h1{font-size:clamp(38px,7vw,64px);letter-spacing:-.05em;line-height:1;margin:0 0 22px}.intro{font-size:20px;line-height:1.6;color:#50635b;margin-bottom:42px}section{background:#fff;border:1px solid #dce5df;border-radius:18px;padding:26px;margin:16px 0}h2{font-size:20px;margin:0 0 10px}p{line-height:1.7;margin:0;color:#50635b}footer{padding:0 24px 48px;color:#65766f}a{color:#174f3f}footer a{font-weight:700}</style></head><body><header><div><a class="brand" href="/">↗ ManoChat</a></div></header><main><h1>${page.title}</h1><p class="intro">${page.intro}</p>${sections}</main><footer>Vigente desde 14 de agosto de 2026 · Contato: <a href="mailto:gustapradogusta@gmail.com">gustapradogusta@gmail.com</a></footer></body></html>`;
  return new Response(method === 'HEAD' ? null : html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

async function readAsset(env, path) {
  if (env.ASSETS) return env.ASSETS.fetch(new Request(new URL(path, 'https://asset.local')));
  return null;
}

async function isAdmin(request, env) {
  return validSession(request.headers.get('cookie'), env.SESSION_SECRET);
}

async function requireAdmin(request, env) {
  return (await isAdmin(request, env)) ? null : json({ error: 'Sessão expirada. Entre novamente.' }, 401);
}

async function login(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: 'Secrets de administração ainda não configurados.' }, 503);
  if (body.password !== env.ADMIN_PASSWORD) return json({ error: 'Senha incorreta.' }, 401);
  const session = await createSession(env.SESSION_SECRET);
  return json({ ok: true }, 200, {
    'set-cookie': `manochat_session=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`
  });
}

async function overview(env) {
  const [campaigns, contacts, delivered, interactions] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) count FROM campaigns WHERE status = 'active'"),
    env.DB.prepare('SELECT COUNT(*) count FROM contacts'),
    env.DB.prepare("SELECT COUNT(*) count FROM conversations WHERE stage = 'delivered'"),
    env.DB.prepare(`SELECT i.id, i.event_type, i.direction, i.status, i.detail, i.created_at,
      c.name campaign_name, ct.username FROM interactions i
      LEFT JOIN campaigns c ON c.id = i.campaign_id
      LEFT JOIN contacts ct ON ct.igsid = i.igsid
      ORDER BY i.id DESC LIMIT 10`)
  ]);
  return json({
    metrics: {
      activeCampaigns: campaigns.results[0]?.count || 0,
      contacts: contacts.results[0]?.count || 0,
      delivered: delivered.results[0]?.count || 0
    },
    interactions: interactions.results || [],
    connection: {
      metaConfigured: Boolean(env.META_ACCESS_TOKEN && env.META_IG_USER_ID && env.META_APP_SECRET),
      apiVersion: env.META_API_VERSION || 'v26.0',
      environment: env.APP_ENV || 'development'
    }
  });
}

async function listCampaigns(env) {
  const result = await env.DB.prepare(`SELECT c.*,
    (SELECT COUNT(*) FROM conversations v WHERE v.campaign_id = c.id) leads,
    (SELECT COUNT(*) FROM conversations v WHERE v.campaign_id = c.id AND v.stage = 'delivered') delivered
    FROM campaigns c ORDER BY c.id DESC`).all();
  return json({ campaigns: result.results || [] });
}

function cleanCampaign(body) {
  return {
    name: String(body.name || '').trim(),
    keyword: String(body.keyword || '').trim(),
    mediaId: String(body.media_id || '').trim() || null,
    firstMessage: String(body.first_message || '').trim(),
    followMessage: String(body.follow_message || '').trim(),
    deliveryMessage: String(body.delivery_message || '').trim(),
    deliveryUrl: String(body.delivery_url || '').trim(),
    followRequired: body.follow_required ? 1 : 0,
    status: body.status === 'paused' ? 'paused' : 'active'
  };
}

function validateCampaign(campaign) {
  if (!campaign.name || !campaign.keyword || !campaign.firstMessage || !campaign.deliveryMessage || !campaign.deliveryUrl) {
    return 'Preencha nome, palavra-chave, primeira mensagem, mensagem de entrega e link.';
  }
  try { new URL(campaign.deliveryUrl); } catch { return 'Informe um link válido, começando com https://.'; }
  return null;
}

async function saveCampaign(request, env, id) {
  const campaign = cleanCampaign(await request.json().catch(() => ({})));
  const validation = validateCampaign(campaign);
  if (validation) return json({ error: validation }, 422);

  try {
    if (id) {
      await env.DB.prepare(`UPDATE campaigns SET name=?, keyword=?, media_id=?, first_message=?, follow_message=?,
        delivery_message=?, delivery_url=?, follow_required=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(campaign.name, campaign.keyword, campaign.mediaId, campaign.firstMessage, campaign.followMessage,
          campaign.deliveryMessage, campaign.deliveryUrl, campaign.followRequired, campaign.status, id).run();
    } else {
      await env.DB.prepare(`INSERT INTO campaigns
        (name, keyword, media_id, first_message, follow_message, delivery_message, delivery_url, follow_required, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(campaign.name, campaign.keyword, campaign.mediaId, campaign.firstMessage, campaign.followMessage,
          campaign.deliveryMessage, campaign.deliveryUrl, campaign.followRequired, campaign.status).run();
    }
    return json({ ok: true });
  } catch (error) {
    return json({ error: String(error.message).includes('UNIQUE') ? 'Já existe uma campanha com essa palavra-chave para essa publicação.' : 'Não foi possível salvar a campanha.' }, 409);
  }
}

async function logInteraction(env, data) {
  await env.DB.prepare(`INSERT INTO interactions
    (igsid, campaign_id, event_type, direction, status, external_id, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(data.igsid || null, data.campaignId || null, data.eventType, data.direction, data.status,
      data.externalId || null, data.detail || null).run();
}

async function claimEvent(env, id, type) {
  try {
    await env.DB.prepare('INSERT INTO processed_events(event_id, event_type) VALUES (?, ?)').bind(id, type).run();
    return true;
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return false;
    throw error;
  }
}

async function campaignForComment(env, event) {
  const mediaId = event.media?.id || event.media_id || null;
  const rows = await env.DB.prepare(`SELECT * FROM campaigns WHERE status='active'
    AND (media_id IS NULL OR media_id='' OR media_id=?) ORDER BY media_id IS NOT NULL DESC, id DESC`).bind(mediaId).all();
  return (rows.results || []).find((campaign) => matchesKeyword(event.text, campaign.keyword));
}

async function campaignForMessage(env, text) {
  const rows = await env.DB.prepare("SELECT * FROM campaigns WHERE status='active' ORDER BY id DESC").all();
  return (rows.results || []).find((campaign) => matchesKeyword(text, campaign.keyword)) || rows.results?.[0];
}

async function handleComment(env, event) {
  const commentId = event.id || event.comment_id;
  if (!commentId || !(await claimEvent(env, eventIdFor('comment', event), 'comment'))) return;
  const campaign = await campaignForComment(env, event);
  if (!campaign) return;

  const igsid = event.from?.id || event.user_id || null;
  try {
    const sent = await sendPrivateReply(env, commentId, campaign.first_message);
    const recipientId = sent.recipient_id || igsid;
    if (recipientId) {
      await env.DB.prepare(`INSERT INTO contacts(igsid, username) VALUES (?, ?)
        ON CONFLICT(igsid) DO UPDATE SET username=COALESCE(excluded.username, username), last_seen_at=CURRENT_TIMESTAMP`)
        .bind(recipientId, event.from?.username || event.username || null).run();
      await env.DB.prepare(`INSERT INTO conversations(igsid, campaign_id, stage, source_comment_id)
        VALUES (?, ?, 'awaiting_reply', ?)
        ON CONFLICT(igsid) DO UPDATE SET campaign_id=excluded.campaign_id, stage='awaiting_reply',
        source_comment_id=excluded.source_comment_id, updated_at=CURRENT_TIMESTAMP`)
        .bind(recipientId, campaign.id, commentId).run();
    }
    await logInteraction(env, { igsid: recipientId, campaignId: campaign.id, eventType: 'private_reply', direction: 'outbound', status: 'sent', externalId: sent.message_id });
  } catch (error) {
    await logInteraction(env, { igsid, campaignId: campaign.id, eventType: 'private_reply', direction: 'outbound', status: 'failed', externalId: commentId, detail: safeDetail(error) });
  }
}

async function handleMessage(env, event) {
  const mid = event.message?.mid;
  const igsid = event.senderId;
  const text = event.message?.text || '';
  if (!igsid || !text || !(await claimEvent(env, eventIdFor('message', { mid, timestamp: event.timestamp }), 'message'))) return;

  let conversation = await env.DB.prepare(`SELECT v.*, c.* FROM conversations v
    JOIN campaigns c ON c.id=v.campaign_id WHERE v.igsid=?`).bind(igsid).first();
  if (!conversation) {
    const campaign = await campaignForMessage(env, text);
    if (!campaign) return;
    conversation = { ...campaign, campaign_id: campaign.id, stage: 'awaiting_reply' };
  }

  let profile = {};
  try { profile = await getProfile(env, igsid); } catch (error) {
    await logInteraction(env, { igsid, campaignId: conversation.campaign_id, eventType: 'profile_check', direction: 'system', status: 'failed', detail: safeDetail(error) });
  }
  const follows = Boolean(profile.is_user_follow_business);
  const decision = nextStep({ stage: conversation.stage, inboundText: text, followsBusiness: follows, followRequired: Boolean(conversation.follow_required) });
  if (decision.action === 'ignore') return;

  const outbound = decision.action === 'deliver'
    ? `${conversation.delivery_message}\n${conversation.delivery_url}`
    : conversation.follow_message;
  try {
    const sent = await sendMessage(env, igsid, outbound);
    await env.DB.prepare(`INSERT INTO contacts(igsid, username, follows_business) VALUES (?, ?, ?)
      ON CONFLICT(igsid) DO UPDATE SET username=COALESCE(excluded.username, username),
      follows_business=excluded.follows_business, last_seen_at=CURRENT_TIMESTAMP`)
      .bind(igsid, profile.username || null, follows ? 1 : 0).run();
    await env.DB.prepare(`INSERT INTO conversations(igsid, campaign_id, stage, last_inbound_at, delivered_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CASE WHEN ?='delivered' THEN CURRENT_TIMESTAMP END)
      ON CONFLICT(igsid) DO UPDATE SET campaign_id=excluded.campaign_id, stage=excluded.stage,
      last_inbound_at=CURRENT_TIMESTAMP, delivered_at=CASE WHEN excluded.stage='delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
      updated_at=CURRENT_TIMESTAMP`)
      .bind(igsid, conversation.campaign_id, decision.stage, decision.stage).run();
    await logInteraction(env, { igsid, campaignId: conversation.campaign_id, eventType: decision.action, direction: 'outbound', status: 'sent', externalId: sent.message_id });
  } catch (error) {
    await logInteraction(env, { igsid, campaignId: conversation.campaign_id, eventType: decision.action, direction: 'outbound', status: 'failed', externalId: mid, detail: safeDetail(error) });
  }
}

async function webhook(request, env, ctx) {
  const rawBody = await request.text();
  if (!(await verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'), env.META_APP_SECRET))) {
    return new Response('Assinatura inválida', { status: 401 });
  }
  const body = JSON.parse(rawBody);
  const events = parseInstagramEvents(body);
  ctx.waitUntil(Promise.all(events.map((event) => event.type === 'comment' ? handleComment(env, event) : handleMessage(env, event))));
  return new Response('EVENT_RECEIVED');
}

async function simulate(request, env) {
  const body = await request.json().catch(() => ({}));
  const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id=?').bind(Number(body.campaignId || 1)).first();
  if (!campaign) return json({ error: 'Campanha não encontrada.' }, 404);
  const result = nextStep({ stage: body.stage || 'awaiting_reply', inboundText: body.message || 'quero', followsBusiness: Boolean(body.follows), followRequired: Boolean(campaign.follow_required) });
  const reply = result.action === 'deliver' ? `${campaign.delivery_message}\n${campaign.delivery_url}` : result.action === 'ask_follow' ? campaign.follow_message : 'Nenhuma mensagem seria enviada.';
  return json({ action: result.action, nextStage: result.stage, reply });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const publicPage = legalPage(path, request.method);
    if (publicPage) return publicPage;

    if (path === '/webhooks/instagram' && request.method === 'GET') {
      if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env.META_VERIFY_TOKEN) {
        return new Response(url.searchParams.get('hub.challenge') || '');
      }
      return new Response('Verificação recusada', { status: 403 });
    }
    if (path === '/webhooks/instagram' && request.method === 'POST') return webhook(request, env, ctx);
    if (path === '/api/login' && request.method === 'POST') return login(request, env);
    if (path === '/api/session' && request.method === 'GET') return json({ authenticated: await isAdmin(request, env) });
    if (path === '/api/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': 'manochat_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' });

    if (path.startsWith('/api/')) {
      const denied = await requireAdmin(request, env);
      if (denied) return denied;
      if (path === '/api/overview' && request.method === 'GET') return overview(env);
      if (path === '/api/campaigns' && request.method === 'GET') return listCampaigns(env);
      if (path === '/api/campaigns' && request.method === 'POST') return saveCampaign(request, env);
      const match = path.match(/^\/api\/campaigns\/(\d+)$/);
      if (match && request.method === 'PUT') return saveCampaign(request, env, Number(match[1]));
      if (path === '/api/simulate' && request.method === 'POST') return simulate(request, env);
      return json({ error: 'Rota não encontrada.' }, 404);
    }

    const asset = await readAsset(env, path === '/' ? '/index.html' : path);
    if (asset) return asset;
    return new Response('Configure o binding ASSETS para servir o painel.', { status: 503 });
  }
};
