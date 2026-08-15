const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { campaigns: [], overview: null };

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/login') showLogin();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a ação.');
  return data;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2600);
}

function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }
function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); loadAll(); }

function navigate(view) {
  $$('.view').forEach((el) => el.classList.toggle('active', el.id === `${view}View`));
  $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  $('#breadcrumb').textContent = ({ overview: 'VISÃO GERAL', campaigns: 'CAMPANHAS', simulator: 'SIMULADOR', connection: 'CONEXÃO META' })[view];
  $('.sidebar').classList.remove('open');
  location.hash = view;
}

function esc(value = '') {
  const div = document.createElement('div'); div.textContent = value; return div.innerHTML;
}

function renderOverview() {
  const { metrics, interactions, connection } = state.overview;
  $('#metricCampaigns').textContent = metrics.activeCampaigns;
  $('#metricContacts').textContent = metrics.contacts;
  $('#metricDelivered').textContent = metrics.delivered;
  const pill = $('#connectionPill');
  pill.className = `status-pill ${connection.metaConfigured ? 'connected' : 'waiting'}`;
  pill.innerHTML = `<i></i> ${connection.metaConfigured ? 'Meta conectada' : 'Aguardando Meta'}`;
  const list = $('#activityList');
  if (!interactions.length) return;
  const labels = { private_reply: 'Private reply', comment_reply: 'Resposta pública', ask_follow: 'Pedido de follow', deliver: 'Conteúdo entregue', profile_check: 'Verificação do perfil' };
  list.innerHTML = interactions.map((item) => `<div class="activity-row"><span>${item.status === 'sent' ? '✓' : '!'}</span><div><strong>${esc(labels[item.event_type] || item.event_type)}</strong><p>${esc(item.username ? `@${item.username}` : item.campaign_name || 'Evento do sistema')} · ${esc(item.status)}</p></div><time>${new Date(`${item.created_at}Z`).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></div>`).join('');
}

function renderCampaigns() {
  const list = $('#campaignList');
  if (!state.campaigns.length) { list.innerHTML = '<div class="panel empty"><strong>Nenhuma campanha</strong><p>Crie a primeira automação para começar.</p></div>'; return; }
  list.innerHTML = state.campaigns.map((c) => `<article class="campaign-card"><div class="campaign-title"><span>↗</span><div><h3>${esc(c.name)} <span class="keyword">${esc(c.keyword)}</span></h3><p>${c.media_id ? `Publicação ${esc(c.media_id)}` : 'Qualquer publicação'} · ${c.follow_required ? 'follow obrigatório' : 'entrega direta'}</p></div></div><div class="campaign-stats"><span><strong>${c.leads || 0}</strong><small>CONTATOS</small></span><span><strong>${c.delivered || 0}</strong><small>ENTREGAS</small></span><em class="state ${c.status}">${c.status === 'active' ? 'ATIVA' : 'PAUSADA'}</em><button class="icon-button edit-campaign" data-id="${c.id}" aria-label="Editar campanha">⋯</button></div></article>`).join('');
  $$('.edit-campaign').forEach((button) => button.addEventListener('click', () => openCampaign(state.campaigns.find((c) => c.id === Number(button.dataset.id)))));
  $('#simCampaign').innerHTML = state.campaigns.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}

async function loadAll() {
  try {
    const [overview, campaigns] = await Promise.all([api('/api/overview'), api('/api/campaigns')]);
    state.overview = overview; state.campaigns = campaigns.campaigns;
    renderOverview(); renderCampaigns();
    $('#webhookUrl').textContent = `${location.origin}/webhooks/instagram`;
  } catch (error) { toast(error.message); }
}

function openCampaign(campaign = null) {
  $('#dialogTitle').textContent = campaign ? 'Editar campanha' : 'Nova campanha';
  $('#campaignId').value = campaign?.id || '';
  $('#campaignName').value = campaign?.name || '';
  $('#campaignKeyword').value = campaign?.keyword || '';
  $('#campaignMedia').value = campaign?.media_id || '';
  $('#campaignPublicReply').value = campaign ? (campaign.public_reply ?? 'Te enviei no Direct! 😊') : 'Te enviei no Direct! 😊';
  $('#campaignFirst').value = campaign?.first_message || 'Oi! Vi seu comentário 😊 Responda QUERO aqui para eu liberar o conteúdo.';
  $('#campaignFollow').value = campaign?.follow_message || 'Falta só um passo: siga o meu perfil e responda PRONTO por aqui.';
  $('#campaignDelivery').value = campaign?.delivery_message || 'Perfeito! Aqui está o conteúdo que prometi:';
  $('#campaignUrl').value = campaign?.delivery_url || '';
  $('#campaignFollowRequired').checked = campaign ? Boolean(campaign.follow_required) : true;
  $('#campaignStatus').value = campaign?.status || 'active';
  $('#campaignError').textContent = '';
  $('#mediaPicker').classList.add('hidden');
  $('#mediaGrid').innerHTML = '';
  $('#campaignDialog').showModal();
}

function mediaTypeLabel(type) {
  return ({ VIDEO: 'VÍDEO', REELS: 'REELS', IMAGE: 'FOTO', CAROUSEL_ALBUM: 'CARROSSEL' })[type] || type || 'PUBLICAÇÃO';
}

function renderMedia(items) {
  const grid = $('#mediaGrid');
  if (!items.length) {
    grid.innerHTML = '<div class="media-picker-empty">Nenhuma publicação encontrada.</div>';
    return;
  }
  grid.innerHTML = items.map((item) => {
    const image = item.thumbnail_url || item.media_url || '';
    const caption = String(item.caption || 'Publicação sem legenda').trim();
    const date = item.timestamp ? new Date(item.timestamp).toLocaleDateString('pt-BR') : '';
    return `<button class="media-option" type="button" data-media-id="${esc(item.id)}">
      <span class="media-thumb">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : '<i>▧</i>'}</span>
      <span class="media-copy"><small>${esc(mediaTypeLabel(item.media_type))}${date ? ` · ${esc(date)}` : ''}</small><strong>${esc(caption)}</strong></span>
      <span class="media-select">Selecionar</span>
    </button>`;
  }).join('');
  $$('.media-option', grid).forEach((button) => button.addEventListener('click', () => {
    $('#campaignMedia').value = button.dataset.mediaId;
    $('#mediaPicker').classList.add('hidden');
    toast('Publicação selecionada.');
  }));
}

async function openMediaPicker() {
  const picker = $('#mediaPicker');
  const status = $('#mediaPickerStatus');
  picker.classList.remove('hidden');
  status.classList.remove('hidden');
  status.textContent = 'Buscando suas publicações…';
  $('#mediaGrid').innerHTML = '';
  try {
    const result = await api('/api/media');
    status.classList.add('hidden');
    renderMedia(result.media || []);
  } catch (error) {
    status.textContent = error.message;
  }
}

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#loginError').textContent = '';
  try { await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) }); showApp(); }
  catch (error) { $('#loginError').textContent = error.message; }
});
$('#showPassword').addEventListener('click', () => { $('#password').type = $('#password').type === 'password' ? 'text' : 'password'; });
$('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); showLogin(); });
$$('.nav-item').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
$('#menuToggle').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
$$('[data-refresh]').forEach((button) => button.addEventListener('click', loadAll));
$('#newCampaign').addEventListener('click', () => openCampaign());
$('#newCampaignTop').addEventListener('click', () => openCampaign());
$('#chooseMedia').addEventListener('click', openMediaPicker);
$('#closeMediaPicker').addEventListener('click', () => $('#mediaPicker').classList.add('hidden'));

$('#campaignForm').addEventListener('submit', async (event) => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const id = $('#campaignId').value;
  const body = {
    name: $('#campaignName').value, keyword: $('#campaignKeyword').value, media_id: $('#campaignMedia').value,
    public_reply: $('#campaignPublicReply').value,
    first_message: $('#campaignFirst').value, follow_message: $('#campaignFollow').value,
    delivery_message: $('#campaignDelivery').value, delivery_url: $('#campaignUrl').value,
    follow_required: $('#campaignFollowRequired').checked, status: $('#campaignStatus').value
  };
  try {
    await api(id ? `/api/campaigns/${id}` : '/api/campaigns', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    $('#campaignDialog').close(); toast('Campanha salva com sucesso.'); await loadAll(); navigate('campaigns');
  } catch (error) { $('#campaignError').textContent = error.message; }
});

$('#simulatorForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await api('/api/simulate', { method: 'POST', body: JSON.stringify({ campaignId: $('#simCampaign').value, stage: $('#simStage').value, message: $('#simMessage').value, follows: $('#simFollows').checked }) });
    $('#chatPreview').innerHTML = `<div class="bubble sent">${esc($('#simMessage').value)}</div><div class="bubble received">${esc(result.reply)}</div>`;
  } catch (error) { toast(error.message); }
});
$('#copyWebhook').addEventListener('click', async () => { await navigator.clipboard.writeText(`${location.origin}/webhooks/instagram`); toast('Endereço copiado.'); });

api('/api/session').then(({ authenticated }) => authenticated ? showApp() : showLogin()).catch(showLogin);
navigate(location.hash.slice(1) || 'overview');
