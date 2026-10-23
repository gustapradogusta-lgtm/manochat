import {installChoices,refreshChoices,closeChoices} from './ui.js';
import {buttonConfig,loadButtonEditor,initButtonEditor,setButtonCapabilities,selectPreview} from './button-editor.js';
import { duplicateCampaign, parseTags, validateDelivery } from './campaign-tools.js';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { campaigns: [], overview: null };

let capabilitiesState={databaseReady:false,filesReady:false};
async function api(path,options={}) {
 const response=await fetch(path,{...options,headers:{...(options.body instanceof FormData?{}:{'content-type':'application/json'}),...options.headers}});
 const data=await response.json().catch(()=>({}));
 if(response.status===401 && path!=='/api/login')showLogin();
 if(!response.ok)throw new Error(data.error||'Não foi possível concluir a ação.');
 return data;
}
function campaignResults(c){return c.results||{entered:c.leads||0,replied:0,delivered:c.delivered||0,failed:0};}
function campaignRate(c){const r=campaignResults(c);return r.entered?Math.round(r.delivered/r.entered*100):0;}
function formatFileSize(bytes=0){return bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.ceil(bytes/1024)} KB`;}

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
  $('#breadcrumb').textContent = ({ overview: 'VISÃO GERAL', campaigns: 'CAMPANHAS', simulator: 'SIMULADOR', connection: 'CONEXÃO META', events: 'EVENTOS', contacts:'CONTATOS' })[view];
  setMenu(false);
  location.hash = view;
  if (view === 'events') loadEvents();
  if (view === 'contacts') renderContacts();
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function renderOverview() {
  const { metrics, interactions, connection } = state.overview;
  $('#metricCampaigns').textContent = metrics.activeCampaigns;
  $('#metricContacts').textContent = metrics.contacts;
  $('#metricDelivered').textContent = metrics.delivered;
  const pill = $('#connectionPill');
  pill.className = `status-pill ${connection.metaConfigured ? 'connected' : 'waiting'}`;
  pill.innerHTML = `<i></i> ${connection.metaConfigured ? 'Meta conectada' : 'Aguardando Meta'}`;
  const connectionStates = [
    ['#metaAppState', 'Meta conectada'],
    ['#secretsState', 'Configurados'],
    ['#webhookState', 'Ativo']
  ];
  connectionStates.forEach(([selector, activeLabel]) => {
    const element = $(selector);
    if (!element) return;
    element.textContent = connection.metaConfigured ? activeLabel : 'Pendente';
    element.classList.toggle('connected', connection.metaConfigured);
  });
  $('#activityList').innerHTML = interactions.slice(0,15).map(eventRow).join('') || '<div class="empty"><strong>Nenhum evento ainda</strong></div>';
}

function renderCampaigns() {
  const list=$('#campaignList');
  if(!state.campaigns.length){list.innerHTML='<div class="panel empty"><strong>Nenhuma campanha</strong><p>Crie a primeira automação para começar.</p></div>';$('#simCampaign').innerHTML='';return;}
  list.innerHTML=state.campaigns.map(c=>{
    const r=campaignResults(c);
    const image=/^https?:\/\//i.test(c.thumbnail_url||'')?c.thumbnail_url:null;
    const thumbnail=image?`<img src="${esc(image)}" alt="Miniatura da publicação" loading="lazy"><span class="thumbnail-play">▶</span>`:'<div class="thumbnail-placeholder">↗<small>SEM CAPA</small></div>';
    return `<article class="campaign-card refined-campaign"><div class="campaign-cover">${thumbnail}</div><div class="campaign-body"><div class="campaign-card-head"><div><span class="campaign-context">${c.media_id?'PUBLICAÇÃO ESPECÍFICA':'TODAS AS PUBLICAÇÕES'}</span><h3>${esc(c.name)}</h3><p>${esc(c.publication_title||(c.media_id?`Publicação ${c.media_id}`:'Automação para qualquer publicação'))}</p></div><em class="state ${c.status}">${c.status==='active'?'ATIVA':'PAUSADA'}</em></div><div class="campaign-tags"><span class="keyword">${c.match_all_comments?'QUALQUER COMENTÁRIO':esc(c.keyword)}</span><span>${c.follow_required?'Exige seguir o perfil':'Sem exigência de follow'}</span></div><div class="campaign-numbers"><div><strong>${r.entered}</strong><small>ENTRADAS</small></div><div><strong>${r.replied}</strong><small>RESPOSTAS</small></div><div><strong>${r.delivered}</strong><small>ENTREGAS</small></div><div><strong>${campaignRate(c)}<i>%</i></strong><small>CONCLUSÃO</small></div></div><div class="campaign-card-footer"><span>Resultados acumulados · perfis únicos</span><div><button class="secondary compact results-campaign" data-id="${c.id}" type="button">Ver resultados ↗</button><button class="secondary compact duplicate-campaign" data-id="${c.id}" type="button">Duplicar</button><button class="secondary compact edit-campaign" data-id="${c.id}" type="button">Editar</button></div></div></div></article>`;
  }).join('');
  $$('.edit-campaign').forEach(button=>button.addEventListener('click',()=>openCampaign(state.campaigns.find(c=>c.id===Number(button.dataset.id)))));
  $$('.duplicate-campaign').forEach(button=>button.addEventListener('click',()=>{const original=state.campaigns.find(c=>c.id===Number(button.dataset.id));const copy=duplicateCampaign(original,state.campaigns);openCampaign({...copy,id:null});toast('Cópia preparada e pausada. Escolha outra publicação ou palavra-chave e salve.')}));
  $$('.results-campaign').forEach(button=>button.addEventListener('click',()=>openResults(state.campaigns.find(c=>c.id===Number(button.dataset.id)))));
  $('#simCampaign').innerHTML=state.campaigns.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
}
function openResults(c) {
  const r=campaignResults(c);
  $('#resultsTitle').textContent=c.name;
  $('#resultsSummary').textContent='Resultados acumulados a partir dos eventos registrados. Cada perfil é contado uma vez por etapa.';
  $('#resultsConversion').textContent=`${campaignRate(c)}%`;
  $('#resultsFailures').textContent=r.failed;
  $('#resultsFunnel').innerHTML=[['Entraram na automação',r.entered],['Responderam à primeira DM',r.replied],['Receberam o conteúdo',r.delivered]].map(([label,value])=>`<div class="funnel-row"><div><span>${label}</span><strong>${value}</strong></div><div class="funnel-track"><i style="width:${r.entered?value/r.entered*100:0}%"></i></div></div>`).join('');
  $('#resultsDialog').showModal();
}
$('#closeResults').addEventListener('click',()=>$('#resultsDialog').close());

async function loadAll() {
  try {
    const [overview, campaigns] = await Promise.all([api('/api/overview'), api('/api/campaigns')]);
    state.overview = overview; state.campaigns = campaigns.campaigns;
    renderOverview(); renderCampaigns();syncEventFilterOptions();
    api('/api/capabilities').then(result=>{capabilitiesState=result;if($('#campaignDialog').open){syncDeliveryFields();setButtonCapabilities(result);}}).catch(()=>{});
    $('#webhookUrl').textContent = `${location.origin}/webhooks/instagram`;
  } catch (error) { toast(error.message); }
}

function openCampaign(campaign = null) {
  $('#dialogTitle').textContent = campaign?.id ? 'Editar campanha' : 'Nova campanha';
  $('#campaignId').value = campaign?.id || '';
  $('#campaignName').value = campaign?.name || '';
  $('#campaignKeyword').value = campaign?.keyword || '';
  $('#campaignMatchAll').checked = campaign ? Boolean(campaign.match_all_comments) : false;
  syncCommentTriggerFields();
  $('#campaignMedia').value = campaign?.media_id || '';
  $('#campaignPublicReply').value = campaign ? (campaign.public_reply ?? 'Te enviei no Direct! 😊') : 'Te enviei no Direct! 😊';
  $('#campaignFirst').value = campaign?.first_message || 'Oi! Vi seu comentário 😊 Responda QUERO aqui para eu liberar o conteúdo.';
  $('#campaignFollow').value = campaign?.follow_message || 'Falta só um passo: siga o meu perfil e responda PRONTO por aqui.';
  $('#campaignDelivery').value = campaign?.delivery_message || 'Perfeito! Aqui está o conteúdo que prometi:';
  $('#campaignUrl').value = campaign?.delivery_link ?? campaign?.delivery_url ?? '';
  selectedMedia={thumbnail_url:campaign?.thumbnail_url||'',caption:campaign?.publication_title||''};
  $('#deliveryMode').value=campaign?.delivery_mode||'link';
  currentFileRef=campaign?.delivery_file||null; pendingFile=null; $('#deliveryFile').value='';
  $('#campaignTags').value=(campaign?.contact_tags||[]).join(', ');syncDeliveryFields();renderFileSelection();
  $('#campaignFollowRequired').checked = campaign ? Boolean(campaign.follow_required) : true;
  $('#campaignStatus').value = campaign?.status || 'active';
  $('#campaignError').textContent = '';
  $('#deleteCampaign').classList.toggle('hidden', !campaign?.id);
  $('#mediaPicker').classList.add('hidden');
  $('#mediaGrid').innerHTML = '';
  loadButtonEditor(campaign?.buttons,capabilitiesState);
  showEditorTab('trigger');refreshChoices();
  $('#campaignDialog').showModal();
}

function syncCommentTriggerFields() {
  const matchAll = $('#campaignMatchAll').checked;
  $('#campaignKeyword').required = !matchAll;
  $('#campaignKeyword').disabled = matchAll;
  $('#campaignKeywordHint').textContent = matchAll ? 'Ignoradas neste modo' : 'Separe por vírgulas: QUERO, GUIA, MATERIAL';
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
    const media=items.find(item=>String(item.id)===button.dataset.mediaId);
    selectedMedia=media?{thumbnail_url:media.thumbnail_url||(/IMAGE|CAROUSEL/.test(media.media_type)?media.media_url:''),caption:media.caption||''}:{};
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

let pendingFile=null,currentFileRef=null,selectedMedia={};
function syncDeliveryFields(){const mode=$('#deliveryMode').value;$('#deliveryUrlField').classList.toggle('hidden',mode==='file');$('#campaignUrl').required=mode!=='file';$('#campaignUrl').disabled=mode==='file';$('#deliveryFileField').classList.toggle('hidden',mode==='link');$('#deliveryFile').disabled=!capabilitiesState.filesReady;$('#campaignTags').disabled=!capabilitiesState.databaseReady;$('#deliveryFileField .local-file-note').textContent=capabilitiesState.filesReady?'O arquivo será hospedado no seu armazenamento e entregue por link na DM. Quem tiver o link poderá baixá-lo.':!capabilitiesState.databaseReady?'Aplique a migração 0004 na Cloudflare para ativar arquivos e etiquetas.':'Configure o armazenamento FILES na Cloudflare para enviar arquivos. Campanhas por link continuam funcionando.';}
function renderFileSelection(){const file=pendingFile||currentFileRef;$('#fileSelection').classList.toggle('hidden',!file);$('#fileName').textContent=file?.name||'';$('#fileSize').textContent=file?`${formatFileSize(file.size)} · ${pendingFile?'Pronto para enviar':'Hospedado'}`:'';}
$('#deliveryMode').addEventListener('change',syncDeliveryFields);
$('#deliveryFile').addEventListener('change',()=>{const file=$('#deliveryFile').files?.[0];if(!file)return;if(!file.size||file.size>25*1024*1024){toast('Selecione um arquivo com conteúdo, de até 25 MB.');$('#deliveryFile').value='';return;}pendingFile=file;renderFileSelection();});
$('#removeDeliveryFile').addEventListener('click',()=>{pendingFile=null;currentFileRef=null;$('#deliveryFile').value='';renderFileSelection();});
function addFileDownload(ref){if(!/^https?:\/\//i.test(ref.url||''))return;const holder=document.createElement('div');holder.className='bubble received file-bubble';const name=document.createElement('strong');name.textContent=ref.name;holder.appendChild(name);const a=document.createElement('a');a.href=ref.url;a.textContent='↓ Baixar arquivo';a.target='_blank';a.rel='noopener';holder.appendChild(a);$('#chatPreview').appendChild(holder);}
let currentContacts=[],contactPage=1,contactPages=1,contactRequest=0,contactSearchTimer;
async function renderContacts(){const request=++contactRequest;try{const params=new URLSearchParams({search:$('#contactSearch').value,tag:$('#contactTagFilter').value,page:String(contactPage)});const result=await api('/api/contacts?'+params);if(request!==contactRequest)return;currentContacts=result.contacts;contactPage=result.page;contactPages=result.pages;
 const filter=$('#contactTagFilter'),selected=filter.value;filter.innerHTML='<option value="">Todas as etiquetas</option>'+result.labels.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');filter.value=selected;
 $('#contactCount').textContent=`${result.total} contato${result.total===1?'':'s'}${result.labelsReady?'':' · aplique a migração 0004 para editar etiquetas'}`;
 $('#contactPageLabel').textContent=`Página ${contactPage} de ${contactPages}`;$('#contactsPrevious').disabled=contactPage<=1;$('#contactsNext').disabled=contactPage>=contactPages;
 $('#contactList').innerHTML=currentContacts.map(c=>`<article class="contact-row"><span class="contact-avatar">${esc((c.username||c.id).slice(0,2).toUpperCase())}</span><div class="contact-main"><strong>${esc(c.username?'@'+c.username:c.id)}</strong><p>${esc(c.campaign||'Sem campanha atual')}</p><div class="contact-tags">${c.tags.length?c.tags.map(t=>`<span>${esc(t)}</span>`).join(''):'<small>Sem etiquetas</small>'}</div></div><button class="secondary compact edit-contact" data-id="${esc(c.id)}" type="button" ${result.labelsReady?'':'disabled'}>Editar etiquetas</button></article>`).join('')||'<div class="empty"><strong>Nenhum contato encontrado</strong><p>Os contatos aparecerão quando a automação registrar interações.</p></div>';
 $$('.edit-contact').forEach(button=>button.addEventListener('click',()=>{const c=currentContacts.find(c=>c.id===button.dataset.id);$('#contactId').value=c.id;$('#contactTitle').textContent=c.username?'@'+c.username:c.id;$('#contactTags').value=c.tags.join(', ');$('#contactDialog').showModal();}));
}catch(error){toast(error.message);}}
$('#contactSearch').addEventListener('input',()=>{clearTimeout(contactSearchTimer);contactSearchTimer=setTimeout(()=>{contactPage=1;renderContacts()},200)});
$('#contactTagFilter').addEventListener('change',()=>{contactPage=1;renderContacts()});
$('#contactsPrevious').addEventListener('click',()=>{contactPage--;renderContacts()});$('#contactsNext').addEventListener('click',()=>{contactPage++;renderContacts()});
$('#closeContact').addEventListener('click',()=>$('#contactDialog').close());
$('#contactTagForm').addEventListener('submit',async event=>{event.preventDefault();try{await api(`/api/contacts/${encodeURIComponent($('#contactId').value)}/tags`,{method:'PUT',body:JSON.stringify({tags:parseTags($('#contactTags').value)})});$('#contactDialog').close();await renderContacts();toast('Etiquetas salvas.');}catch(error){toast(error.message);}});

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#loginError').textContent = '';
  try { await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) }); showApp(); }
  catch (error) { $('#loginError').textContent = error.message; }
});
$('#showPassword').addEventListener('click', () => { $('#password').type = $('#password').type === 'password' ? 'text' : 'password'; });
$('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); showLogin(); });
$$('.nav-item').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
$('#menuToggle').addEventListener('click', () => setMenu(!$('.sidebar').classList.contains('open')));
$('#navBackdrop').addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
$$('[data-refresh]').forEach((button) => button.addEventListener('click', loadAll));
$('#newCampaign').addEventListener('click', () => openCampaign());
$('#newCampaignTop').addEventListener('click', () => openCampaign());
$('#campaignMatchAll').addEventListener('change', syncCommentTriggerFields);
$('#chooseMedia').addEventListener('click', openMediaPicker);
$('#campaignMedia').addEventListener('input',()=>{selectedMedia={};});
$('#closeMediaPicker').addEventListener('click', () => $('#mediaPicker').classList.add('hidden'));
$('#closeCampaign').addEventListener('click', () => $('#campaignDialog').close());
$('#cancelCampaign').addEventListener('click', () => $('#campaignDialog').close());
$('#deleteCampaign').addEventListener('click', async () => {
  const id = $('#campaignId').value;
  if (!id) return;
  const password = window.prompt('Digite a senha de exclusão da campanha:');
  if (password === null) return;
  try {
    await api(`/api/campaigns/${id}`, { method: 'DELETE', body: JSON.stringify({ password }) });
    $('#campaignDialog').close();
    toast('Campanha excluída.');
    await loadAll();
    navigate('campaigns');
  } catch (error) {
    $('#campaignError').textContent = error.message;
  }
});

$('#campaignForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#campaignId').value;
  const body = {
    name: $('#campaignName').value, keyword: $('#campaignKeyword').value, media_id: $('#campaignMedia').value,
    buttons:buttonConfig(),
    match_all_comments: $('#campaignMatchAll').checked,
    public_reply: $('#campaignPublicReply').value,
    first_message: $('#campaignFirst').value, follow_message: $('#campaignFollow').value,
    delivery_message: $('#campaignDelivery').value, delivery_url: $('#campaignUrl').value,
    follow_required: $('#campaignFollowRequired').checked, status: $('#campaignStatus').value,
    delivery_mode:$('#deliveryMode').value,delivery_link:$('#campaignUrl').value,delivery_file:currentFileRef,contact_tags:parseTags($('#campaignTags').value),thumbnail_url:selectedMedia.thumbnail_url||'',publication_title:selectedMedia.caption||''
  };
  try {
    $('#saveCampaign').disabled=true;
    if(body.delivery_mode!=='link' && pendingFile){const form=new FormData();form.append('file',pendingFile);const upload=await api('/api/files',{method:'POST',body:form});currentFileRef=upload.file;body.delivery_file=currentFileRef;pendingFile=null;renderFileSelection();}
    if(body.delivery_mode==='link')body.delivery_file=null;
    await api(id ? `/api/campaigns/${id}` : '/api/campaigns', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    $('#campaignDialog').close(); toast('Campanha salva com sucesso.'); await loadAll(); navigate('campaigns');
  } catch (error) { $('#campaignError').textContent = error.message; }
  finally { $('#saveCampaign').disabled=false; }
});

$('#simulatorForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await api('/api/simulate', { method: 'POST', body: JSON.stringify({ campaignId: $('#simCampaign').value, stage: $('#simStage').value, message: $('#simMessage').value, follows: $('#simFollows').checked }) });
    $('#chatPreview').innerHTML = `<div class="bubble sent">${esc($('#simMessage').value)}</div><div class="bubble received">${esc(result.reply)}</div>`;
    if(result.action==='deliver'){const c=state.campaigns.find(c=>c.id===Number($('#simCampaign').value));if(c?.delivery_file && c.delivery_mode!=='link')addFileDownload(c.delivery_file);}
  } catch (error) { toast(error.message); }
});
$('#copyWebhook').addEventListener('click', async () => { await navigator.clipboard.writeText(`${location.origin}/webhooks/instagram`); toast('Endereço copiado.'); });

const eventLabels={private_reply:'Primeira mensagem na DM',comment_reply:'Resposta pública',ask_follow:'Pedido para seguir',deliver:'Conteúdo entregue',profile_check:'Verificação do perfil'};
const statusLabels={sent:'Enviado',failed:'Falha',checked:'Verificado'};
function eventRow(item) {
  return `<div class="activity-row event-row"><span class="event-icon ${esc(item.status)}">${item.status==='failed'?'!':item.status==='checked'?'◎':'✓'}</span><div class="event-copy"><strong>${esc(eventLabels[item.event_type]||item.event_type)}</strong><p>@${esc(item.username||'perfil')} · ${esc(item.campaign_name||'Evento do sistema')}</p><small>${esc(item.publication_id?`Publicação ${item.publication_id}`:'Todas as publicações')}</small></div><div class="event-result"><span class="result-badge ${esc(item.status)}">${esc(statusLabels[item.status]||item.status)}</span><time datetime="${esc(item.created_at)}">${new Date(item.created_at.endsWith('Z')?item.created_at:item.created_at+'Z').toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time></div></div>`;
}
function syncEventFilterOptions(){
 const campaign=$('#eventCampaign'),publication=$('#eventPublication'),oldCampaign=campaign.value,oldPublication=publication.value;
 campaign.innerHTML='<option value="">Todas as campanhas</option>'+state.campaigns.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
 const posts=new Map(state.campaigns.filter(c=>c.media_id).map(c=>[c.media_id,c.publication_title||`Publicação ${c.media_id}`]));
 publication.innerHTML='<option value="">Todas as publicações</option>'+[...posts].map(([id,title])=>`<option value="${esc(id)}">${esc(title.slice(0,80))}</option>`).join('');
 campaign.value=oldCampaign;publication.value=oldPublication;
}
let eventPage=1, eventRequest=0, searchTimer;
function readEventFilters() {return {page:eventPage,publication:$('#eventPublication').value,campaign:$('#eventCampaign').value,type:$('#eventType').value,status:$('#eventStatus').value,days:$('#eventPeriod').value,search:$('#eventSearch').value};}
async function loadEvents() {
  const request=++eventRequest;
  try {
    const result=await api('/api/events',{method:'POST',body:JSON.stringify(readEventFilters())});
    if(request!==eventRequest) return;
    eventPage=result.page;
    $('#eventHistory').innerHTML=result.events.map(eventRow).join('')||'<div class="empty"><span>⌕</span><strong>Nenhum evento encontrado</strong><p>Tente outro período ou limpe os filtros.</p></div>';
    $('#eventResultCount').textContent=result.total?`${(result.page-1)*15+1}–${(result.page-1)*15+result.events.length} de ${result.total} eventos`:'0 eventos';
    $('#eventPageLabel').textContent=`Página ${result.page} de ${result.pages}`;
    $('#eventsPrevious').disabled=result.page<=1;
    $('#eventsNext').disabled=result.page>=result.pages;
  }catch(error){toast(error.message);}
}
function setTheme(theme) {
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#080a09':'#f4f7f5';
  $$('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme)));
  try{localStorage.setItem('manochat-theme',theme)}catch{}
}
$$('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>setTheme(button.dataset.themeChoice)));
setTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');
$('#viewAllEvents').addEventListener('click',()=>{eventPage=1;navigate('events')});
$('#eventFilters').addEventListener('submit',event=>event.preventDefault());
$('#eventFilters').addEventListener('change',()=>{eventPage=1;loadEvents()});
$('#eventSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{eventPage=1;loadEvents()},200)});
$('#clearEventFilters').addEventListener('click',()=>{clearTimeout(searchTimer);$('#eventFilters').reset();eventPage=1;loadEvents()});
$('#refreshEvents').addEventListener('click',loadEvents);
$('#eventsPrevious').addEventListener('click',()=>{eventPage--;loadEvents()});
$('#eventsNext').addEventListener('click',()=>{eventPage++;loadEvents()});

api('/api/session').then(({ authenticated }) => authenticated ? showApp() : showLogin()).catch(showLogin);
navigate(location.hash.slice(1) || 'overview');

function setMenu(open){const wasOpen=$('.sidebar').classList.contains('open');$('.sidebar').inert=!open&&matchMedia('(max-width:720px)').matches;$('.sidebar').classList.toggle('open',open);$('#navBackdrop').classList.toggle('hidden',!open);$('#menuToggle').setAttribute('aria-expanded',String(open));document.body.classList.toggle('menu-is-open',open);$('#menuToggle').setAttribute('aria-label',open?'Fechar menu':'Abrir menu');if(open)$('.sidebar .nav-item.active')?.focus();else if(wasOpen)$('#menuToggle').focus();}
window.addEventListener('resize',()=>setMenu(false));
function showEditorTab(tab){closeChoices();$$('[data-editor-tab]').forEach(b=>{const active=b.dataset.editorTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$$('[data-editor-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.editorPanel!==tab));if(tab!=='trigger')selectPreview(tab==='delivery'?'delivery':'first');$('.editor-layout').scrollTop=0;}
$$('[data-editor-tab]').forEach(b=>b.addEventListener('click',()=>showEditorTab(b.dataset.editorTab)));
$$('[data-editor-next]').forEach(b=>b.addEventListener('click',()=>{showEditorTab(b.dataset.editorNext);$(`[data-editor-tab="${b.dataset.editorNext}"]`).focus();}));
$('#campaignForm').addEventListener('invalid',e=>{const panel=e.target.closest('[data-editor-panel]');if(panel)showEditorTab(panel.dataset.editorPanel);},true);
installChoices();initButtonEditor();
