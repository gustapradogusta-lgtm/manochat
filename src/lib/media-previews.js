import {getMedia} from '../meta.js';
function trusted(url){return url.protocol==='https:' && !url.username && !url.password && ['cdninstagram.com','fbcdn.net','instagram.com'].some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain));}
export async function mediaPreview(env,id){
  try{
    const media=await getMedia(env,id);
    const source=media.thumbnail_url || (['IMAGE','CAROUSEL_ALBUM'].includes(media.media_type)?media.media_url:'');
    if(!source)return new Response('Prévia indisponível',{status:404});
    let url=new URL(source),response;
    for(let redirects=0;redirects<4;redirects++){
      if(!trusted(url))throw Error('Unsupported image host');
      response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000)});
      if(response.status>=300&&response.status<400){url=new URL(response.headers.get('location'),url);continue;}
      break;
    }
    if(!response?.ok || !/^image\/(jpeg|png|webp|gif|avif)(;|$)/i.test(response.headers.get('content-type')||''))throw Error('Invalid preview');
    const limit=8*1024*1024;
    if(Number(response.headers.get('content-length'))>limit)throw Error('Large preview');
    const reader=response.body.getReader(),chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Large preview');}chunks.push(value);}
    return new Response(new Blob(chunks),{headers:{'content-type':response.headers.get('content-type'),'cache-control':'private, max-age=900','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
  }catch{return new Response('Prévia indisponível',{status:502,headers:{'cache-control':'no-store'}});}
}
