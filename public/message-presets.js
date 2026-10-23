// Creates editable drafts only. Existing campaigns change only after an explicit save.
export function newButtonId(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const h=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export function recommendedMessages(capabilities={},mode='link') {
  const interactive=Boolean(capabilities.buttonsReady);
  const firstInteractive=interactive&&Boolean(capabilities.privateReplyButtonsEnabled);
  const button=(label,action)=>({id:newButtonId(),label,action});
  return {
    public_reply:'Te chamei no Direct com o próximo passo 🙌 Dá uma olhada por lá!',
    first_message:firstInteractive
      ?'Seu conteúdo está quase na sua mão! 🙌\nToque no botão abaixo para continuar e receber o que prometi.'
      :'Seu conteúdo está quase na sua mão! 🙌\nResponda EU QUERO aqui no Direct para continuar e receber o que prometi.',
    follow_message:interactive
      ?'Falta só um passo para liberar seu conteúdo 💚\nSiga meu perfil e depois toque em JÁ TE SEGUI para eu conferir.'
      :'Falta só um passo para liberar seu conteúdo 💚\nSiga meu perfil e depois responda PRONTO aqui no Direct para eu conferir.',
    delivery_message:interactive
      ?'Pronto! Seu conteúdo está liberado 🎉\nAcesse pelo botão abaixo e aproveite!'
      :'Pronto! Seu conteúdo está liberado 🎉\nAcesse pelo link abaixo e aproveite!',
    buttons:{
      first:firstInteractive?[button('RECEBER CONTEÚDO','continue')]:[],
      follow:interactive?[button('JÁ TE SEGUI ✅','continue')]:[],
      delivery:interactive?(mode==='both'?[button('ACESSAR CONTEÚDO','delivery_link'),button('ABRIR DOCUMENTO','delivery_file')]:[button(mode==='file'?'ABRIR DOCUMENTO':'ACESSAR CONTEÚDO',mode==='file'?'delivery_file':'delivery_link')]):[]
    }
  };
}
