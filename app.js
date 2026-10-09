import {DAYS,minutes,formatTime,initialFilters,filterEvents,groupEvents,readFilters} from './agenda-core.js';

const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const STORAGE='convencion-salud-2026-mi-agenda';
const OFFICIAL_URL=new URL('.',location.href).href.replace(/\/$/,'');
const POSTERS={
  general:{src:'assets/afiche-general.jpg',title:'III Convención Internacional en Ciencias de la Salud',alt:'Afiche general oficial de la Convención, 14–17 de octubre de 2026, Montería, Colombia'},
  ...Object.fromEntries(['enfermeria','infecciosas','farmacia','administracion','salud','auditoria'].map(id=>[id,{src:`assets/pendon-${id}.jpg`,thumbnail:`assets/pendon-${id}-mini.jpg`}]))
};
let data,filters,saved=new Set(),toastTimer,storageAvailable=true;
try{const values=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(Array.isArray(values)) saved=new Set(values.filter(v=>typeof v==='string'));}catch{storageAvailable=false;}

function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2700);}
function updateSavedCount(){ $('saved-count').textContent=saved.size; }
function openImage(id){
  const poster=POSTERS[id];if(!poster)return;
  const title=poster.title||data?.programs[id]?.name||'Pieza oficial';
  const dialog=$('image-dialog');
  $('image-title').textContent=title;
  $('expanded-image').src=poster.src;
  $('expanded-image').width=id==='general'?1080:800;
  $('expanded-image').height=id==='general'?1219:1600;
  $('expanded-image').alt=poster.alt||`Pendón oficial de ${title}`;
  $('download-image').href=poster.src;
  if(typeof dialog.showModal==='function'){dialog.showModal();document.body.classList.add('image-open');$('close-image').focus();}
  else window.open(poster.src,'_blank','noopener');
}
function saveEvent(id,button){
  const added=!saved.has(id);added?saved.add(id):saved.delete(id);
  try{localStorage.setItem(STORAGE,JSON.stringify([...saved]));}catch{storageAvailable=false;}
  updateSavedCount();
  if(filters.saved) render();
  else{button.setAttribute('aria-pressed',String(added));button.setAttribute('aria-label',`${added?'Quitar de':'Guardar en'} mi agenda: ${data.events.find(e=>e.id===id).title}`);button.title=added?'Quitar de mi agenda':'Guardar en mi agenda';}
  toast((added?'Sesión guardada en Mi agenda.':'Sesión retirada de Mi agenda.')+(!storageAvailable?' Se conservará durante esta visita.':''));
}

function syncUrl(){
  const params=new URLSearchParams();params.set('dia',filters.day);
  if(filters.program!=='all')params.set('actividad',filters.program);
  if(filters.room!=='all')params.set('sede',filters.room);
  if(filters.type!=='all')params.set('formato',filters.type);
  if(filters.query.trim())params.set('q',filters.query.trim());
  if(filters.saved)params.set('mi-agenda','1');if(filters.view==='rooms')params.set('vista','sedes');
  try{history.replaceState(null,'',`${location.pathname}?${params}${location.hash}`);}catch{}
}
function syncControls(){
  document.querySelectorAll('[data-day]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.day===String(filters.day))));
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===filters.view)));
  $('search').value=filters.query;$('program-filter').value=filters.program;$('room-filter').value=filters.room;$('type-filter').value=filters.type;
  $('saved-filter').setAttribute('aria-pressed',String(filters.saved));
}

function eventCard(e){
  const isSaved=saved.has(e.id);
  const programs=e.programs.map(p=>data.programs[p].short).join(' / ');
  const programNames=e.programs.map(p=>data.programs[p].name).join(' / ');
  return `<article class="session" id="${e.id}" style="--session-color:${data.programs[e.programs[0]].color}" aria-labelledby="title-${e.id}">
    <div class="session-time"><time datetime="2026-10-${e.day}T${e.start}:00-05:00">${escapeHtml(formatTime(e.start))}</time><time class="end-time" datetime="2026-10-${e.day}T${e.end}:00-05:00">a ${escapeHtml(formatTime(e.end))}</time><span class="duration">${minutes(e.end)-minutes(e.start)} min</span></div>
    <div class="session-content"><div class="session-tags"><span class="program-tag">${escapeHtml(programs)}</span><span class="type-tag">${escapeHtml(e.type)}</span></div>
    <h4 id="title-${e.id}">${escapeHtml(e.title)}</h4>${e.speaker?`<p class="session-speaker">${escapeHtml(e.speaker)}</p>`:''}
    <p class="session-location">${icon('pin')}${escapeHtml(data.rooms[e.room])}</p>
    <details class="session-details"><summary>${e.profile?'Perfil y detalles':'Detalles de la sesión'}</summary><p><strong>${escapeHtml(programNames)}</strong><br>${DAYS[e.day]} ${e.day} de octubre de 2026 · ${escapeHtml(data.rooms[e.room])}</p>${e.profile?`<p>${escapeHtml(e.profile)}</p>`:''}${e.description?`<p>${escapeHtml(e.description)}</p>`:''}<a class="source-link" href="assets/agenda-definitiva.pdf?v=20261009-revision2#page=${e.page}" target="_blank" rel="noopener">Consultar página ${e.page} de la agenda definitiva ↗</a></details></div>
    <button class="save-session" data-save="${e.id}" type="button" aria-pressed="${isSaved}" aria-label="${isSaved?'Quitar de':'Guardar en'} mi agenda: ${escapeHtml(e.title)}" title="${isSaved?'Quitar de mi agenda':'Guardar en mi agenda'}">${icon('bookmark')}</button></article>`;
}

function render(){
  const openDetails=new Set([...$('results').querySelectorAll('details[open]')].map(d=>`${d.closest('article').id}|${d.className}`));
  syncControls();syncUrl();
  const events=filterEvents(data,filters,saved);
  $('result-title').textContent=filters.saved?'Mi agenda':filters.day==='all'?'14–17 de octubre de 2026':`${DAYS[filters.day]} ${filters.day} de octubre`;
  $('result-count').textContent=`${events.length} ${events.length===1?'sesión':'sesiones'}${filters.program!=='all'?' · '+data.programs[filters.program].short:''}`;
  if(!events.length){
    const heading=filters.saved?'Su recorrido empieza aquí':'No encontramos sesiones con estos filtros';
    const message=filters.saved?'Guarde sesiones con el marcador que aparece junto a cada actividad. Si ya guardó alguna, pruebe a ampliar sus filtros.':'Puede ampliar la búsqueda a todos los días o restablecer los filtros.';
    $('results').innerHTML=`<div class="empty-state">${icon(filters.saved?'bookmark':'search')}<h4>${heading}</h4><p>${message}</p>${filters.day!=='all'?'<button data-all-days type="button">Buscar en todos los días</button> ':''}<button data-clear type="button">Ver toda la programación</button></div>`;
  }else{
    const groups=groupEvents(events,filters.view);
    $('results').innerHTML=groups.map(g=>{
      const countLabel=`${g.events.length} ${g.events.length===1?'sesión':'sesiones'}`;
      const heading=filters.view==='rooms'?`${icon('pin')}${escapeHtml(data.rooms[g.room])} <small>${DAYS[g.day]} ${g.day} · ${countLabel}</small>`:`${DAYS[g.day]} ${g.day} de octubre <small>${countLabel}</small>`;
      return `${filters.view==='rooms'||filters.day==='all'?`<h4 class="group-title">${heading}</h4>`:''}${g.events.map(eventCard).join('')}`;
    }).join('');
    $('results').querySelectorAll('details').forEach(d=>{if(openDetails.has(`${d.closest('article').id}|${d.className}`))d.open=true;});
  }
  $('results').setAttribute('aria-busy','false');
}
function clearFilters(){filters={...initialFilters(),day:'all',view:filters.view};render();}
function selectProgram(program){filters={...initialFilters(),day:'all',program};render();$('programacion').scrollIntoView({behavior:'smooth'});}
function selectRoom(room){filters={...initialFilters(),day:'all',room,view:'rooms'};render();$('programacion').scrollIntoView({behavior:'smooth'});}

function populate(){
  const options=(entries)=>entries.map(([value,label])=>`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
  $('program-filter').insertAdjacentHTML('beforeend',options(Object.entries(data.programs).map(([id,p])=>[id,p.name])));
  $('room-filter').insertAdjacentHTML('beforeend',options(Object.entries(data.rooms)));
  $('type-filter').insertAdjacentHTML('beforeend',options([...new Set(data.events.map(e=>e.type))].sort().map(t=>[t,t])));
  $('program-cards').innerHTML=Object.entries(data.programs).filter(([id])=>id!=='apertura').map(([id,p],i)=>{
    const events=data.events.filter(e=>e.programs.includes(id));const days=[...new Set(events.map(e=>e.day))].sort();
    const poster=POSTERS[id];
    return `<article class="program-card" style="--session-color:${p.color}"><button type="button" class="program-poster poster-zoom" data-image="${id}" aria-label="Ampliar la pieza oficial de ${escapeHtml(p.name)}"><img src="${poster.thumbnail}" srcset="${poster.thumbnail} 360w, ${poster.src} 800w" sizes="(max-width:540px) calc(100vw - 32px), (max-width:1050px) calc((100vw - 62px)/2), 390px" width="800" height="1600" loading="lazy" decoding="async" alt="Pendón oficial de ${escapeHtml(p.name)}"><span>Ampliar pieza ${icon('search')}</span></button><div class="program-card-copy"><p class="program-top"><span class="program-dot"></span>ENCUENTRO ${String(i+1).padStart(2,'0')}</p><h3>${escapeHtml(p.name)}</h3><p class="program-foot">${events.length} sesiones · ${days.join(' y ')} OCT</p><button type="button" class="program-schedule" data-program="${id}">Ver programación ${icon('arrow')}</button></div></article>`;
  }).join('');
  $('venue-list').innerHTML=['cultural','biblioteca','aspu'].map((id,i)=>{
    const events=data.events.filter(e=>e.room===id);const days=[...new Set(events.map(e=>e.day))].sort();
    return `<button type="button" class="venue-card" data-room="${id}"><span class="venue-number">0${i+1}</span><div><h3>${escapeHtml(data.rooms[id])}</h3><p>Programación de los días ${days.join(', ')} de octubre<br>Ver las sesiones de este auditorio</p></div>${icon('arrow')}</button>`;
  }).join('');
}

function bind(){
  document.querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click',()=>{filters.day=b.dataset.day;render();}));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{filters.view=b.dataset.view;render();}));
  $('search').addEventListener('input',()=>{filters.query=$('search').value;render();});
  for(const [id,key] of [['program-filter','program'],['room-filter','room'],['type-filter','type']]) $(id).addEventListener('change',()=>{filters[key]=$(id).value;render();});
  $('saved-filter').addEventListener('click',()=>{filters.saved=!filters.saved;render();});
  $('reset').addEventListener('click',clearFilters);
  $('my-nav').addEventListener('click',()=>{filters={...initialFilters(),day:'all',saved:true};render();$('programacion').scrollIntoView({behavior:'smooth'});});
  $('results').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.save)saveEvent(button.dataset.save,button);
    if(button.hasAttribute('data-clear'))clearFilters();
    if(button.hasAttribute('data-all-days')){filters.day='all';render();}
  });
  $('program-cards').addEventListener('click',e=>{const b=e.target.closest('[data-program]');if(b)selectProgram(b.dataset.program);});
  $('intro-programs').addEventListener('click',e=>{const link=e.target.closest('[data-program]');if(link){e.preventDefault();selectProgram(link.dataset.program);}});
  $('venue-list').addEventListener('click',e=>{const b=e.target.closest('[data-room]');if(b)selectRoom(b.dataset.room);});
}

document.addEventListener('click',event=>{const button=event.target.closest('[data-image]');if(button)openImage(button.dataset.image);});
$('copy-agenda-link').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(OFFICIAL_URL);toast('Enlace oficial copiado. Puede pegarlo en redes sociales, estados o correo.');}
  catch{window.prompt('Copie el enlace oficial de la agenda:',OFFICIAL_URL);}
});
$('close-image').addEventListener('click',()=>$('image-dialog').close());
$('image-dialog').addEventListener('close',()=>document.body.classList.remove('image-open'));
$('image-dialog').addEventListener('click',event=>{if(event.target!==$('image-dialog'))return;const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();});

async function start(){
  try{
    const response=await fetch('agenda.json',{cache:'no-cache'});if(!response.ok)throw new Error('Agenda no disponible');data=await response.json();
    saved=new Set([...saved].filter(id=>data.events.some(e=>e.id===id)));
    filters=readFilters(new URLSearchParams(location.search),data);
    populate();bind();updateSavedCount();render();
  }catch(error){$('results').innerHTML='<p class="load-error">La programación interactiva no pudo cargarse. <a href="assets/agenda-definitiva.pdf">Consulte la agenda definitiva en PDF</a> o recargue la página.</p>';$('results').setAttribute('aria-busy','false');$('result-count').textContent='Agenda disponible en PDF';console.error(error);}
}
start();
