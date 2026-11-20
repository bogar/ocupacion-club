(() => {
'use strict';
// UI pública: exclusivamente agregados permitidos, nunca datos internos.
const el=document.getElementById('roomCards');
const note=document.getElementById('roomDataStatus');
if(!el||!note)return;
const ROOT='https://raw.githubusercontent.com/bogar/ocupacion-club/main/data/salas.json';
const LIMIT_MS=20*60*1000;
function clear(){while(el.firstChild)el.removeChild(el.firstChild);}
function explain(text){clear();const p=document.createElement('p');p.className='muted-copy room-empty';p.textContent=text;el.appendChild(p);}
function card(title,value,subtitle){
 const article=document.createElement('article');article.className='room-card';
 const name=document.createElement('div');name.className='room-name';name.textContent=title;
 const number=document.createElement('strong');number.className='room-people';number.textContent=value;
 const caption=document.createElement('span');caption.className='room-subtitle';caption.textContent=subtitle;
 article.append(name,number,caption);return article;
}
function valid(data){
 if(!data||data.version!==1||data.metric!=='reserved_places'||!Array.isArray(data.rooms))return false;
 const updated=new Date(data.timestamp);
 if(!Number.isFinite(updated.getTime())||updated.getTime()>Date.now()+300000||Date.now()-updated.getTime()>LIMIT_MS)return false;
 if(data.rooms.length>30)return false;
 return data.rooms.every(r=>r&&typeof r.label==='string'&&/^Sala [1-9][0-9]{0,2}[A-Za-z]?$/.test(r.label)&&
 Number.isSafeInteger(r.reserved)&&r.reserved>=5&&r.reserved<=1000);
}
async function refreshRooms(){
 try{
  const response=await fetch(ROOT+'?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('Sin publicación validada');
  const data=await response.json();
  if(!valid(data))throw Error('Datos no válidos o caducados');
  clear();
  if(!data.rooms.length)explain('No hay estimaciones publicables de salas en este momento.');
  else for(const room of data.rooms)el.appendChild(card(room.label,String(room.reserved),'Plazas reservadas · estimación'));
  note.textContent='Estimación basada en reservas de actividades en curso. No confirma asistencia ni presencia física. Se omiten grupos pequeños y no se muestran profesores ni detalles de las clases.';
 }catch(e){
  note.textContent='Datos de salas pendientes de validación o temporalmente no disponibles.';
  explain('Aún no hay estimaciones verificadas por sala.');
 }
}
refreshRooms();
setInterval(refreshRooms,60000);
})();
