export function parseTags(text='') {return [...new Set(String(text).split(',').map(t=>t.trim().slice(0,40)).filter(Boolean))].slice(0,15);}
export function duplicateCampaign(source,campaigns) {
 const copy=structuredClone(source);copy.id=Math.max(0,...campaigns.map(c=>Number(c.id)||0))+1;
 let name=`${source.name} — cópia`,n=2;while(campaigns.some(c=>c.name===name))name=`${source.name} — cópia ${n++}`;
 copy.name=name;copy.status='paused';copy.leads=0;copy.delivered=0;if(source.demo_key)copy.thumbnail_key=source.demo_key;delete copy.demo_key;
 return copy;
}
export function validateDelivery(c) {
 const mode=c.delivery_mode||'link';
 if(!['link','file','both'].includes(mode))return 'Escolha uma forma de entrega válida.';
 if(mode!=='file'){try{const u=new URL(c.delivery_url);if(!['http:','https:'].includes(u.protocol))return 'Informe um link http ou https válido.';}catch{return 'Informe um link válido.';}}
 if(mode!=='link'&&!c.delivery_file?.id)return 'Selecione o arquivo que será entregue.';
 return null;
}
