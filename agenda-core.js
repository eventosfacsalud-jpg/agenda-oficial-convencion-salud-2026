export const DAYS = {14:'Miércoles',15:'Jueves',16:'Viernes',17:'Sábado'};
export const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const minutes = (time) => { const [h,m]=time.split(':').map(Number); return h*60+m; };
export const formatTime = (time) => { const [h,m]=time.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h===12&&m===0?'m.':h<12?'a. m.':'p. m.'}`; };
export const initialFilters = () => ({day:'14',program:'all',room:'all',type:'all',query:'',saved:false,view:'list'});

export function filterEvents(data,filters,saved=new Set()) {
  const words=normalize(filters.query).trim().split(/\s+/).filter(Boolean);
  return data.events.filter(e => {
    if(filters.day!=='all' && String(e.day)!==String(filters.day)) return false;
    if(filters.program!=='all' && !e.programs.includes(filters.program)) return false;
    if(filters.room!=='all' && e.room!==filters.room) return false;
    if(filters.type!=='all' && e.type!==filters.type) return false;
    if(filters.saved && !saved.has(e.id)) return false;
    const haystack=normalize([e.title,e.speaker,e.profile,e.description,e.type,data.rooms[e.room],...e.programs.map(p=>data.programs[p].name)].join(' '));
    return words.every(word=>haystack.includes(word));
  }).sort((a,b)=>a.day-b.day || minutes(a.start)-minutes(b.start) || a.room.localeCompare(b.room) || a.id.localeCompare(b.id));
}

export function groupEvents(events,view) {
  const groups=new Map();
  for(const e of events) {
    const key=view==='rooms'?`${e.day}|${e.room}`:String(e.day);
    if(!groups.has(key)) groups.set(key,{day:e.day,room:view==='rooms'?e.room:null,events:[]});
    groups.get(key).events.push(e);
  }
  return [...groups.values()].sort((a,b)=>a.day-b.day || (a.room||'').localeCompare(b.room||''));
}

export function readFilters(params,data) {
  const f=initialFilters();
  const day=params.get('dia');if(['14','15','16','17','all'].includes(day)) f.day=day;
  const program=params.get('actividad');if(program&&data.programs[program]) f.program=program;
  const room=params.get('sede');if(room&&data.rooms[room]) f.room=room;
  const type=params.get('formato');if(type&&data.events.some(e=>e.type===type)) f.type=type;
  f.query=params.get('q')||'';f.saved=params.get('mi-agenda')==='1';
  f.view=params.get('vista')==='sedes'?'rooms':'list';return f;
}
