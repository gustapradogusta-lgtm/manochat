// Progressive enhancement: real selects keep their values, validation and change events.
const widgets=new Map(); let opened=null;
export function closeChoices(){if(opened){opened.list.remove();opened.button.setAttribute('aria-expanded','false');opened=null;}}
export function refreshChoices(){for(const [select,w] of widgets){w.button.textContent=select.selectedOptions[0]?.textContent||'Selecione';w.button.disabled=select.disabled;}}
export function installChoices(root=document){
  for(const [select,w] of widgets)if(!select.isConnected){if(opened===w)closeChoices();widgets.delete(select);}
  for(const select of root.querySelectorAll('select')){
    if(widgets.has(select))continue;
    const button=document.createElement('button');button.type='button';button.className='choice-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
    const label=select.closest('label');button.setAttribute('aria-label', select.getAttribute('aria-label') || label?.childNodes[0]?.textContent?.trim() || select.id);
    select.classList.add('choice-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');select.after(button);
    const w={select,button,list:null};widgets.set(select,w);
    function open(){
      if(select.disabled)return;closeChoices();
      const list=document.createElement('div');list.className='choice-list';list.id=`choices-${select.id}`;list.setAttribute('role','listbox');list.setAttribute('aria-label',button.getAttribute('aria-label'));w.list=list;
      let active=Math.max(0,select.selectedIndex);const items=[];
      function focus(i){active=i;items.forEach((el,n)=>el.classList.toggle('choice-focused',n===i));button.setAttribute('aria-activedescendant',items[i]?.id||'');items[i]?.scrollIntoView({block:'nearest'});}
      function choose(i){if(select.options[i]?.disabled)return;select.selectedIndex=i;select.dispatchEvent(new Event('change',{bubbles:true}));closeChoices();button.focus();}
      [...select.options].forEach((o,i)=>{const row=document.createElement('div');row.id=`${list.id}-${i}`;row.setAttribute('role','option');row.setAttribute('aria-selected',String(i===select.selectedIndex));row.setAttribute('aria-disabled',String(o.disabled));row.textContent=o.textContent;row.addEventListener('pointermove',()=>focus(i));row.addEventListener('click',()=>choose(i));list.append(row);items.push(row);});
      (select.closest('dialog')||document.body).append(list);opened=w;button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',list.id);
      const r=button.getBoundingClientRect(),below=innerHeight-r.bottom-12,above=r.top-12,height=Math.min(288,Math.max(below,above));list.style.width=`${Math.min(r.width,innerWidth-24)}px`;list.style.left=`${Math.min(Math.max(12,r.left),innerWidth-r.width-12)}px`;list.style.maxHeight=`${height}px`;
      if(below<160&&above>below)list.style.bottom=`${innerHeight-r.top+6}px`;else list.style.top=`${r.bottom+6}px`;
      w.key=e=>{if(['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape','Tab'].includes(e.key)){
        if(e.key==='Escape'||e.key==='Tab'){closeChoices();if(e.key==='Escape')e.preventDefault();return;}
        e.preventDefault();if(e.key==='Enter'||e.key===' '){choose(active);return;}
        let next=e.key==='Home'?0:e.key==='End'?items.length-1:Math.min(items.length-1,Math.max(0,active+(e.key==='ArrowDown'?1:-1)));
        for(let n=0;n<items.length&&select.options[next]?.disabled;n++)next=(next+1)%items.length;focus(next);
      }else if(e.key.length===1){const index=[...select.options].findIndex(o=>!o.disabled&&o.textContent.toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase()));if(index>=0)focus(index);}};
      focus(active);
    }
    button.addEventListener('click',e=>{e.preventDefault();opened===w?closeChoices():open();});
    button.addEventListener('keydown',e=>{if(opened===w)w.key(e);else if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();open();}});
    select.addEventListener('change',refreshChoices);select.addEventListener('invalid',()=>button.focus());new MutationObserver(()=>{if(opened===w)closeChoices();refreshChoices();}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected']});
  }
  refreshChoices();
}
document.addEventListener('pointerdown',e=>{if(opened&&!opened.button.contains(e.target)&&!opened.list.contains(e.target))closeChoices();});
window.addEventListener('resize',closeChoices);document.addEventListener('scroll',e=>{if(opened&&!opened.list.contains(e.target))closeChoices();},true);
document.addEventListener('close',closeChoices,true);
