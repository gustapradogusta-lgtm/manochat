import {icon} from './interface-icons.js';
import {refreshChoices} from './ui.js';
// This module only presents existing DOM data. It never calls an API or changes campaign payloads.
const $=s=>document.querySelector(s);
function text(el,value){if(el && el.textContent!==String(value))el.textContent=String(value);}
function svg(el,name){if(el && el.dataset.visualIcon!==name){el.innerHTML=icon(name);el.dataset.visualIcon=name;}}
function button(el,label,name,after=false){
 if(!el)return;
 const signature=`${label}|${name}|${after}`;
 if(el.dataset.visualButton===signature)return;
 el.innerHTML=after?`<span>${label}</span>${icon(name)}`:`${icon(name)}${label?`<span>${label}</span>`:''}`;
 el.dataset.visualButton=signature;
}
const sentence=s=>s.charAt(0).toUpperCase()+s.slice(1).toLowerCase();
function decorate(){
 const nav={overview:'home',campaigns:'campaign',contacts:'users',events:'events',simulator:'play',connection:'link'};
 document.querySelectorAll('.nav-item').forEach(el=>{svg(el.querySelector('span'),nav[el.dataset.view]);if(el.classList.contains('active'))el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 $('#newCampaignTop')?.classList.toggle('visual-suppressed',Boolean($('#campaignsView.active')));
 document.querySelectorAll('[data-ui-icon]').forEach(el=>svg(el,el.dataset.uiIcon));
 [['#newCampaign','Criar campanha','plus'],['#newCampaignTop','Nova campanha','plus'],['#closeCampaign','','x'],['#closeResults','','x'],['#closeContact','','x'],['#closeMediaPicker','','x'],['#menuToggle','','menu'],['#closeSidebar','','x'],['#showPassword','','eye'],['#applyMessagePreset','Aplicar mensagens prontas','campaign'],['#undoMessagePreset','Desfazer','return'],['#saveCampaign','Salvar campanha','check'],['#validateStory','Conferir Story','check'],['#chooseMedia','Escolher publicação','image'],['#copyWebhook','Copiar endereço','copy'],['#viewAllEvents','Ver todos','right'],['#refreshEvents','Atualizar','refresh'],['#eventsPrevious','Anterior','left'],['#eventsNext','Próxima','right'],['#contactsPrevious','Anterior','left'],['#contactsNext','Próxima','right']].forEach(([selector,label,name])=>button($(selector),label,name));
 button($('#logout'),'Sair do painel','logout',true);
 document.querySelectorAll('[data-refresh]').forEach(el=>button(el,'Atualizar dados','refresh'));
 document.querySelectorAll('[data-theme-choice]').forEach(el=>button(el,el.dataset.themeChoice==='dark'?'Dark':'Clean',el.dataset.themeChoice==='dark'?'moon':'sun'));
 document.querySelectorAll('.add-message-button').forEach(el=>button(el,'Adicionar botão','plus'));
 document.querySelectorAll('.button-remove').forEach(el=>button(el,'Remover','x',true));
 document.querySelectorAll('.editor-next').forEach(el=>button(el,el.dataset.editorNext==='conversation'?'Configurar conversa':'Configurar entrega','right',true));
 document.querySelectorAll('.results-campaign').forEach(el=>button(el,'Ver resultados','arrow',true));
 document.querySelectorAll('.duplicate-campaign').forEach(el=>button(el,'Duplicar','copy'));
 document.querySelectorAll('.edit-campaign').forEach(el=>button(el,'Editar','edit'));
 document.querySelectorAll('.thumbnail-play').forEach(el=>svg(el,'play'));
 document.querySelectorAll('.thumbnail-placeholder').forEach(el=>{const first=el.firstChild;if(first?.nodeType===3 && first.textContent.trim()){first.remove();el.insertAdjacentHTML('afterbegin',icon('image'));}});
 document.querySelectorAll('.thumbnail-placeholder>span').forEach(el=>svg(el,'image'));
 document.querySelectorAll('.empty>span').forEach(el=>svg(el,'search'));
 document.querySelectorAll('.event-icon').forEach(el=>svg(el,el.classList.contains('failed')?'alert':'check'));
 document.querySelectorAll('.dm-preview-button>span').forEach(el=>{const s=el.textContent.trim();if(s==='↵'||s==='↗')svg(el,s==='↵'?'return':'arrow');});
 document.querySelectorAll('.eyebrow,.step-kicker').forEach(el=>{const s=el.textContent;if(s===s.toUpperCase())text(el,sentence(s).replace(/(·\s*)([a-z])/g,(_,a,b)=>a+b.toUpperCase()));});
 document.querySelectorAll('.campaign-context').forEach(el=>text(el,({'RESPOSTA A STORY':'Resposta a Story','PUBLICAÇÃO ESPECÍFICA':'Publicação específica','TODAS AS PUBLICAÇÕES':'Todas as publicações'})[el.textContent]||el.textContent));
 document.querySelectorAll('.state').forEach(el=>{if(el.textContent==='ATIVA'||el.textContent==='PAUSADA')text(el,sentence(el.textContent));});
 document.querySelectorAll('.campaign-numbers small').forEach(el=>{if(el.textContent===el.textContent.toUpperCase())text(el,sentence(el.textContent));});
 document.querySelectorAll('.campaign-card-footer>span').forEach(el=>text(el,'Perfis únicos por etapa'));
 const metricNames=['campaign','users','check'];document.querySelectorAll('.metrics .metric-icon').forEach((el,i)=>svg(el,metricNames[i]));
 svg(document.querySelector('.file-drop>span'),'upload');svg(document.querySelector('.brand-mark'),'arrow');
 const context=document.querySelector('.dm-preview-context');if(context)text(context,$('#campaignTrigger')?.value==='story'?'Você respondeu a um Story':'Você comentou em uma publicação');
 const previewBack=document.querySelector('.dm-preview-header>span:first-child');svg(previewBack,'left');
 button(document.querySelector('#simulatorForm button[type=submit]'),'Simular resposta','play');
 button(document.querySelector('#loginForm button[type=submit]'),'Entrar no painel','right',true);
 svg(document.querySelector('.phone-top>span:first-child'),'left');svg(document.querySelector('.phone-input>span'),'right');
 document.querySelectorAll('.setup-state.connected').forEach(el=>{if(!el.querySelector('.ui-icon'))el.insertAdjacentHTML('afterbegin',icon('check'));});
 const show=$('#showPassword');if(show&&!show.dataset.visualA11y){show.dataset.visualA11y='true';show.addEventListener('click',()=>show.setAttribute('aria-label',$('#password').type==='text'?'Ocultar senha':'Mostrar senha'));}
}
function filterCampaigns(){
 const list=$('#campaignList');if(!list)return;
 const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const query=normalize($('#campaignSearch')?.value||''),status=$('#campaignStatusFilter')?.value||'';
 const cards=[...list.querySelectorAll('.refined-campaign')];let shown=0;
 for(const card of cards){
  const haystack=normalize((card.querySelector('.campaign-card-head')?.textContent||'')+' '+(card.querySelector('.campaign-tags')?.textContent||''));
  const visible=(!query||haystack.includes(query))&&(!status||Boolean(card.querySelector('.state.'+status)));
  card.classList.toggle('hidden',!visible);if(visible)shown++;
 }
 text($('#campaignTotal'),cards.length);text($('#campaignActiveTotal'),cards.filter(c=>c.querySelector('.state.active')).length);text($('#campaignPausedTotal'),cards.filter(c=>c.querySelector('.state.paused')).length);
 text($('#campaignFilterCount'),query||status?`${shown} de ${cards.length} campanhas`:`${cards.length} campanha${cards.length===1?'':'s'} no seu espaço de trabalho`);
 $('#campaignFilterEmpty')?.classList.toggle('hidden',!cards.length||shown>0);
}
$('#closeSidebar')?.addEventListener('click',()=>$('#menuToggle').click());
$('#campaignSearch')?.addEventListener('input',filterCampaigns);
$('#campaignStatusFilter')?.addEventListener('change',filterCampaigns);
$('#campaignTrigger')?.addEventListener('change',decorate);
$('#clearCampaignSearch')?.addEventListener('click',()=>{$('#campaignSearch').value='';$('#campaignStatusFilter').value='';refreshChoices();filterCampaigns();$('#campaignSearch').focus();});
text($('#workspaceDate'),new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date()));
let queued=false;
const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();filterCampaigns();});});
observer.observe(document.body,{childList:true,subtree:true});
decorate();filterCampaigns();
