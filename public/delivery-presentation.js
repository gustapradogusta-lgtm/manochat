// A delivery button carries its URL; keep only destinations with no matching button in the text.
export function fileViewUrl(file) {
  if(!file?.url)return '';
  if(!/^[a-f0-9-]{36}$/i.test(file.id||''))return file.url;
  return new URL(`/view/${file.id}`,file.url).href;
}
const canonical=value=>{try{return new URL(value).href;}catch{return value;}};
export function deliveryButtonUrl(button,campaign,options={}) {
  if(button.action==='delivery_link')return options.delivery_link || campaign.delivery_link || campaign.delivery_url?.split('\n')[0] || '';
  if(button.action==='delivery_file')return fileViewUrl(options.file || campaign.delivery_file);
  return button.url || '';
}
export function deliveryText(campaign,buttons=[],options={}) {
  const file=options.file || campaign.delivery_file;
  const destinations=String(campaign.delivery_url || '').split('\n').map(s=>s.trim()).filter(Boolean);
  const covered=new Set(buttons.map(b=>canonical(deliveryButtonUrl(b,campaign,{...options,file}))));
  // A file's download and its document page represent the same delivery.
  if(file?.url && covered.has(canonical(fileViewUrl(file))))covered.add(canonical(file.url));
  const remaining=destinations.filter(url=>!covered.has(canonical(url)));
  return [String(campaign.delivery_message || ''),...remaining].filter(Boolean).join('\n');
}
