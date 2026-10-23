import {deliveryButtonUrl,deliveryText} from '../../public/delivery-presentation.js';
// Button templates are opt-in. Plain-text campaigns retain their original payload.
export const emptyButtons = () => ({ first: [], follow: [], delivery: [] });
export async function buttonsReady(env) {
  return Boolean(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='campaign_buttons'").first());
}
export function privateButtonsEnabled(env) { return env.META_PRIVATE_REPLY_BUTTONS_ENABLED === 'true'; }
export function normalizeButtons(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Configuração de botões inválida.');
  const output = emptyButtons();
  for (const stage of Object.keys(output)) {
    const items = value[stage] ?? [];
    if (!Array.isArray(items) || items.length > 3) throw Error('Use no máximo 3 botões por mensagem.');
    const ids = new Set();
    output[stage] = items.map(item => {
      const label = String(item?.label || '').trim(), action = item?.action;
      if (!label || [...label].length > 20) throw Error('Cada botão precisa de um texto de até 20 caracteres.');
      if (!(stage === 'delivery' ? ['link','delivery_link','delivery_file'] : ['link','continue']).includes(action)) throw Error('Ação de botão inválida para esta mensagem.');
      const id = /^[a-f0-9-]{36}$/i.test(item.id || '') ? item.id : crypto.randomUUID();
      if (ids.has(id)) throw Error('Botões duplicados na mesma mensagem.');
      ids.add(id);
      const button = { id, label, action };
      if (action === 'link') {
        try { const u = new URL(String(item.url || '').trim()); if (!['https:','http:'].includes(u.protocol) || u.username || u.password || u.href.length > 2000) throw Error(); button.url = u.href; }
        catch { throw Error('Informe um link http ou https válido para cada botão de link.'); }
      }
      return button;
    });
  }
  return output;
}
export async function readButtons(env, id) {
  if (!await buttonsReady(env)) return emptyButtons();
  const row = await env.DB.prepare('SELECT config_json FROM campaign_buttons WHERE campaign_id=?').bind(id).first();
  return row ? JSON.parse(row.config_json) : emptyButtons();
}
export function buttonsStatement(env, config, campaign, id) {
  return env.DB.prepare(`INSERT INTO campaign_buttons(campaign_id,config_json)
    SELECT id,? FROM campaigns WHERE ${id ? 'id=?' : "keyword=? AND COALESCE(media_id,'')=?"}
    ON CONFLICT(campaign_id) DO UPDATE SET config_json=excluded.config_json`)
    .bind(JSON.stringify(config), ...(id ? [id] : [campaign.keyword, campaign.mediaId || '']));
}
export function parseButtonPayload(value) {
  const match = /^mc1:(\d+):(first|follow):([a-f0-9-]{36}):([a-f0-9]{16})$/i.exec(String(value || ''));
  return match ? { campaignId: Number(match[1]), stage: match[2], id: match[3], source: match[4] } : null;
}
export async function sourceFingerprint(id) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(id))))].slice(0,8).map(v=>v.toString(16).padStart(2,'0')).join(''); }
export async function campaignMessage(env, campaign, stage, text) {
  // Meta documents private replies as text. Enable templates there only after an account-level test.
  if (stage === 'first' && campaign.trigger_type!=='story' && !privateButtonsEnabled(env)) return text;
  const config = await readButtons(env, campaign.id || campaign.campaign_id);
  const selected = config[stage] || [];
  if (!selected.length) return text;
  let options = {};
  if (stage==='delivery' || selected.some(b => b.action.startsWith('delivery_'))) {
    options = await env.DB.prepare('SELECT delivery_link,file_json FROM campaign_options WHERE campaign_id=?').bind(campaign.id || campaign.campaign_id).first() || {};
  }
  const file=JSON.parse(options.file_json || 'null');
  if(stage==='delivery')text=deliveryText(campaign,selected,{...options,file});
  const source=await sourceFingerprint(campaign.source_comment_id);
  const buttons = selected.map(b => {
    if (b.action === 'continue') return { type:'postback', title:b.label, payload:`mc1:${campaign.id || campaign.campaign_id}:${stage}:${b.id}:${source}` };
    const url=deliveryButtonUrl(b,campaign,{...options,file});
    if (!url || !/^https?:\/\//i.test(url)) throw Error('O destino de um botão está indisponível. Revise a campanha.');
    return { type:'web_url', title:b.label, url };
  });
  if ([...text].length > 640) throw Error('Mensagens com botões devem ter até 640 caracteres, incluindo links de entrega.');
  return { attachment:{type:'template',payload:{template_type:'button',text,buttons}} };
}
