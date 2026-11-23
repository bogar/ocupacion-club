(() => {
'use strict';

const $ = id => document.getElementById(id);
const zone = 'Europe/Madrid';
const DAY_MS = 86400000;
const DATA_ROOT = 'https://raw.githubusercontent.com/bogar/ocupacion-club/main/';
// GitHub Pages stays static. Public, anonymous readings are fetched directly
// from the repository without requiring a Pages deploy every five minutes.
async function dataFetch(path,kind='text'){
 // No recurrimos a una copia antigua de Pages para el dato actual.
 const live=['data/latest.json','data/live.csv','data/reading-status.json','data/desglose.json','data/prevision.json','data/desglose-reciente.json'].includes(path);
 const candidates=live?[DATA_ROOT+path+'?t='+Date.now()]:
  [DATA_ROOT+path+'?t='+Date.now(),path+'?t='+Date.now()];
 let lastError;
 for(const url of candidates){
  try{
   const response=await fetch(url,{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   return kind==='json'?await response.json():await response.text();
  }catch(error){lastError=error;}
 }
 throw lastError||Error('No se pudieron cargar los datos.');
}
function mergeReadings(recent,live){
 const unique=new Map();
 for(const reading of [...recent,...live])unique.set(reading.time.getTime(),reading);
 return [...unique.values()].sort((a,b)=>a.time-b.time);
}
const names = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const number = n => new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(n);
const average = values => values.reduce((sum,value)=>sum+value,0)/values.length;
const timeFormat = new Intl.DateTimeFormat('es-ES',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const shortDate = new Intl.DateTimeFormat('es-ES',{timeZone:zone,day:'2-digit',month:'short'});
const hourFormat = new Intl.DateTimeFormat('es-ES',{timeZone:zone,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const localParts = new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'});
const monthLabelFormat = new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',month:'long',year:'numeric'});
const heatmapShortDate = new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',day:'numeric',month:'short'});
const heatmapFullDate = new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'});

const infoCache=new WeakMap();
function info(date){
 const cached=infoCache.get(date);
 if(cached)return cached;
 const parts=Object.fromEntries(localParts.formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
 const value={
  day:parts.year+'-'+parts.month+'-'+parts.day,
  month:parts.year+'-'+parts.month,
  hour:Number(parts.hour),
  weekday:([6,0,1,2,3,4,5][['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday)])
 };
 infoCache.set(date,value);
 return value;
}
function monthLabel(value){
 const label=monthLabelFormat.format(new Date(value+'-15T12:00:00Z'));
 return label.charAt(0).toUpperCase()+label.slice(1);
}
function parse(csv){
 const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines[0]!=='timestamp,people')throw Error('El archivo de datos tiene un formato inesperado.');
 const unique=new Set();
 return lines.slice(1).map(line=>{
  const match=/^([^,]+),(\d+)$/.exec(line);
  if(!match)return null;
  const time=new Date(match[1]),people=Number(match[2]);
  if(!Number.isFinite(time.getTime())||!Number.isSafeInteger(people)||unique.has(time.getTime()))return null;
  unique.add(time.getTime());
  return {time,people};
 }).filter(Boolean).sort((a,b)=>a.time-b.time);
}
const archiveMonths=new Set(), archiveData=new Map();
let data=[], latestSnapshot=null, readingStatus=null, selectedMonth=null, selectedDay=null, period=1;
let heatmapPeriod='habitual';
let recentRows=[],liveRows=[],recentSignature=null,liveSignature=null;
let historyLoaded=false,historyInFlight=null,liveInFlight=null;
let quickMode=false,initializing=true;
let chartsPromise=null;
function ensureCharts(){
 if(quickMode||typeof Chart!=='undefined')return Promise.resolve();
 if(chartsPromise)return chartsPromise;
 chartsPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';
  script.async=true;
  script.onload=()=>{
   if(!quickMode)renderAnalytics();
   window.dispatchEvent(new Event('ocupacion:charts-ready'));
   resolve();
  };
  script.onerror=()=>{
   if(!quickMode){
    const empty=$('chartEmpty');
    if(!empty.hidden)empty.textContent='No se pudo cargar la biblioteca de gráficos.';
    const profileEmpty=$('profileEmpty');
    if(!profileEmpty.hidden)profileEmpty.textContent='No se pudo cargar la biblioteca de gráficos.';
   }
   reject(Error('No se pudo cargar Chart.js'));
  };
  document.head.appendChild(script);
 }).catch(error=>{
  chartsPromise=null;
  console.warn(error.message);
 });
 return chartsPromise;
}

let monthLoading=false,monthError=null,dayLoading=false,dayError=null,dayRequest=0,trendChart=null,profileChart=null;

let breakdownEnabled=false,breakdownPoints=[],breakdownLoaded=false,breakdownLoading=false;
let breakdownCheckedAt=null,breakdownFailed=false;
const breakdownArchiveMonths=new Set(),breakdownArchiveData=new Map();
const breakdownArchiveLoading=new Set(),breakdownArchiveFailed=new Set();
let breakdownArchiveIndexAt=0,breakdownArchiveIndexPromise=null;
function selectedBreakdownMonth(){
 return selectedMonth||(selectedDay?selectedDay.slice(0,7):null);
}
async function loadBreakdownArchive(){
 const month=selectedBreakdownMonth();
 if(!breakdownEnabled||!month||!window.OcupacionDesgloseArchivo)return;
 // El índice es opcional hasta que se active el archivado.
 if(Date.now()-breakdownArchiveIndexAt>300000){
  if(!breakdownArchiveIndexPromise){
   breakdownArchiveIndexPromise=(async()=>{
    const doc=await dataFetch('data/desglose-archivo/index.json','json');
    const months=window.OcupacionDesgloseArchivo.parseIndex(doc);
    if(!months)throw Error('Índice de desglose inválido');
    breakdownArchiveMonths.clear();
    for(const item of months)breakdownArchiveMonths.add(item);
   })().catch(()=>{}).finally(()=>{
    breakdownArchiveIndexAt=Date.now();
    breakdownArchiveIndexPromise=null;
   });
  }
  await breakdownArchiveIndexPromise;
 }
 if(!breakdownArchiveMonths.has(month)||breakdownArchiveData.has(month)||
    breakdownArchiveLoading.has(month))return;
 breakdownArchiveLoading.add(month);
 try{
  const doc=await dataFetch('data/desglose-archivo/'+month+'.json','json');
  const points=window.OcupacionDesgloseArchivo.parseMonth(
   doc,month,window.OcupacionDesglose);
  if(!points)throw Error('Mes de desglose inválido');
  breakdownArchiveData.set(month,points);
  breakdownArchiveFailed.delete(month);
 }catch{
  breakdownArchiveFailed.add(month);
 }finally{
  breakdownArchiveLoading.delete(month);
  if(selectedBreakdownMonth()===month&&!quickMode)renderAnalytics();
 }
}
function breakdownInfo(message){
 if(breakdownFailed)return message+' · No se pudo comprobar si hay nuevos datos.';
 return message+(breakdownCheckedAt?
  ' · Datos consultados a las '+new Intl.DateTimeFormat('es-ES',{
   timeZone:zone,hour:'2-digit',minute:'2-digit'
  }).format(breakdownCheckedAt):'');
}
async function loadBreakdown(){
 // Reconsultar al volver a activar el modo apilado: una fuente que estaba
 // vacía puede haberse publicado mientras la página seguía abierta.
 if(breakdownLoading)return;
 breakdownLoading=true;
 const note=$('breakdownInfo');
 if(note)note.textContent='Comprobando desglose anónimo…';
 try{
  const json=await dataFetch('data/desglose.json','json');
  const points=window.OcupacionDesglose?.parse(json);
  if(!points)throw Error('Desglose no validado.');
  breakdownPoints=points;
  breakdownLoaded=true;
  breakdownCheckedAt=new Date();
  breakdownFailed=false;
  if(note&&breakdownEnabled)note.textContent=points.length?
   'Reservas y uso deportivo estimados; total de personas medido.':
   'Aún no hay estimaciones por categoría publicadas y validadas.';
 }catch{
  breakdownFailed=true;
  // Una consulta fallida no invalida el último conjunto verificado.
  if(!breakdownLoaded)breakdownPoints=[];
  if(note&&breakdownEnabled)note.textContent=breakdownInfo(
   breakdownLoaded?'Se conserva el último desglose válido.':
   'Desglose pendiente de validación. Solo mostramos personas medidas.');
 }finally{
  breakdownLoading=false;
  if(!quickMode)renderAnalytics();
 }
}

let breakdownRecentPoints=[],breakdownRecentExpiry=0,breakdownRecentLoading=false;
async function loadBreakdownRecent(){
 if(breakdownRecentLoading)return;
 breakdownRecentLoading=true;
 try{
  const json=await dataFetch('data/desglose-reciente.json','json');
  const doc=window.OcupacionDesglose?.parseRecent(json);
  if(!doc)throw Error('Desglose reciente caducado o inválido.');
  breakdownRecentPoints=doc.points;
  breakdownRecentExpiry=doc.until;
 }catch{
  // La última previsión válida solo se usa hasta su caducidad.
  if(Date.now()>=breakdownRecentExpiry)breakdownRecentPoints=[];
 }finally{
  breakdownRecentLoading=false;
  if(!quickMode)renderAnalytics();
 }
}
function effectiveBreakdown(){
 const month=selectedBreakdownMonth();
 if(month&&breakdownArchiveMonths.has(month)){
  // Nunca inferir un mes completo a partir del solapamiento reciente.
  if(!breakdownArchiveData.has(month))return [];
  return window.OcupacionDesgloseArchivo.combine(
   breakdownPoints,breakdownArchiveData.get(month));
 }
 if(selectedDay||selectedMonth||period!==1||
    !breakdownRecentPoints.length||Date.now()>breakdownRecentExpiry)
  return breakdownPoints;
 // Las franjas recientes y consolidadas usan el mismo modelo de 15 min.
 const byTime=new Map(breakdownPoints.map(p=>[p.ms,p]));
 for(const point of breakdownRecentPoints)byTime.set(point.ms,point);
 return [...byTime.values()].sort((a,b)=>a.ms-b.ms);
}
let forecastDoc=null,forecastLoading=false,forecastFailed=false;
async function loadForecast(){
 if(forecastLoading)return;
 forecastLoading=true;
 try{
  const json=await dataFetch('data/prevision.json','json');
  const doc=window.OcupacionPrevision?.parse(json);
  if(!doc)throw Error('Previsión no validada.');
  forecastDoc=doc;
  forecastFailed=false;
 }catch{
  // La previsión es opcional: nunca bloquea ni sustituye al histórico.
  forecastFailed=true;
 }finally{
  forecastLoading=false;
  if(!quickMode)renderAnalytics();
 }
}
const breakdownButton=$('breakdownToggle');
if(breakdownButton)breakdownButton.addEventListener('click',()=>{
 breakdownEnabled=!breakdownEnabled;
 breakdownButton.setAttribute('aria-pressed',String(breakdownEnabled));
 breakdownButton.textContent=breakdownEnabled?'Ver solo ocupación real':'Ver desglose apilado';
 if(breakdownEnabled){
  // La primera pulsación renderiza inmediatamente la serie real.
  // Pulsaciones posteriores también permiten usar el caché mientras
  // se comprueba si hay una versión más reciente.
  if(!quickMode)renderAnalytics();
  loadBreakdown();
  loadBreakdownRecent();
  loadForecast();
  loadBreakdownArchive();
 }else {
  $('breakdownInfo').textContent='Solo ocupación real, sin estimaciones.';
  renderAnalytics();
 }
});


function status(text,state){$('statusText').textContent=text;$('status').dataset.state=state;}
// La cifra actual se obtiene del JSON mínimo cuando existe, o del CSV
// reciente como respaldo. Nunca sustituimos un dato nuevo por otro antiguo.
function currentReading(){
 const lastCsvReading=data.at(-1)||null;
 if(!latestSnapshot)return lastCsvReading;
 if(!lastCsvReading||latestSnapshot.time.getTime()>=lastCsvReading.time.getTime())return latestSnapshot;
 return lastCsvReading;
}
function parseLatest(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('latest.json no válido');
 if(Object.keys(value).length!==2||
    !Object.prototype.hasOwnProperty.call(value,'people')||
    !Object.prototype.hasOwnProperty.call(value,'timestamp'))throw Error('Campos inesperados en latest.json');
 if(!Number.isSafeInteger(value.people)||value.people<0||
    typeof value.timestamp!=='string')throw Error('Lectura no válida en latest.json');
 const time=new Date(value.timestamp);
 if(!Number.isFinite(time.getTime())||time.toISOString()!==value.timestamp||
    time.getTime()>Date.now()+300000)throw Error('Fecha no válida en latest.json');
 return {time,people:value.people};
}
const madridClock=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function withinClosure(date=new Date()){
 const parts=Object.fromEntries(madridClock.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const minute=Number(parts.hour)*60+Number(parts.minute);
 return minute>=23*60||minute<=5*60+30;
}
function parseReadingStatus(value){
 if(!value||typeof value!=='object'||!['measured','estimated_closed','estimated_missing','unverified'].includes(value.mode))
  throw Error('Tipo de lectura inválido');
 if(value.timestamp!==null&&(typeof value.timestamp!=='string'||!Number.isFinite(Date.parse(value.timestamp))))
  throw Error('Fecha del tipo de lectura inválida');
 return value;
}
function estimatedReading(latest){
 return !!latest&&['estimated_closed','estimated_missing'].includes(readingStatus?.mode)&&
  readingStatus.timestamp===latest.time.toISOString();
}
// Cambios absolutos comparados con una lectura cercana a cada intervalo.
// Los márgenes permiten el ligero desfase de las consultas de 5 minutos,
// pero nunca se utiliza una lectura de un intervalo sustancialmente distinto.
const trendWindows=[
 {minutes:15,tolerance:5},
 {minutes:30,tolerance:6},
 {minutes:60,tolerance:7}
];
function trendForWindow(latest,rows,minutes,tolerance){
 if(!latest)return null;
 const target=latest.time.getTime()-minutes*60000;
 let best=null,bestDistance=Infinity;
 for(const row of rows){
  const time=row.time.getTime();
  if(time>=latest.time.getTime())continue;
  const distance=Math.abs(time-target);
  if(distance<=tolerance*60000 && distance<bestDistance){
   best=row;bestDistance=distance;
  }
 }
 if(!best)return null;
 const difference=latest.people-best.people;
 return {
  difference,
  elapsed:Math.round((latest.time-best.time)/60000),
  direction:difference>0?'up':difference<0?'down':'flat'
 };
}
function updateOccupancyTrend(latest){
 for(const {minutes,tolerance} of trendWindows){
  const panel=$('trend'+minutes);
  const pill=$('trendValue'+minutes);
  const caption=$('trendContext'+minutes);
  const comparison=trendForWindow(latest,data,minutes,tolerance);
  if(!comparison){
   panel.dataset.direction='pending';
   pill.textContent='Sin datos';
   caption.textContent='Sin referencia comparable';
   continue;
  }
  panel.dataset.direction=comparison.direction;
  pill.textContent=comparison.difference>0?'↑ +'+number(comparison.difference)+' personas':
   comparison.difference<0?'↓ '+number(Math.abs(comparison.difference))+' personas':
   '→ Sin cambios';
  caption.textContent='hace '+comparison.elapsed+' min';
 }
}
function liveMetrics(){
 $('totalReadings').textContent=number(data.length);
 $('totalNote').textContent=data.length
  ? new Set(data.map(row=>info(row.time).day)).size+' días con lecturas recientes'
  : 'Sin datos';
 const latest=currentReading();
 const estimated=estimatedReading(latest);
 updateOccupancyTrend(estimated?null:latest);
 if(estimated){
  const now=new Date(),minutes=Math.max(0,Math.floor((now-latest.time)/60000));
  const unavailable=readingStatus.mode==='estimated_missing';
  const valid=minutes<20&&(unavailable||withinClosure(now));
  $('currentCount').textContent=valid?'0':'—';
  $('lastUpdate').textContent='Última estimación: '+timeFormat.format(latest.time);
  $('ageHint').textContent=valid?(unavailable?
   'La ficha no publica ocupación: 0 asumido, no medido.':
   'Cierre nocturno: 0 personas asumidas, no medidas.'):
   'Estimación desactualizada. Esperando una nueva consulta.';
  $('footerStamp').textContent='Ocupación estimada: '+timeFormat.format(latest.time);
  status(valid?(unavailable?'Sin dato publicado · 0 estimado':'Cierre nocturno · estimado'):
   'Esperando nuevos datos','warning');
  // El resto de estadísticas sigue utilizando exclusivamente lecturas reales.
  return;
 }
 if(!latest){
  status('Sin datos','warning');
  $('currentCount').textContent='—';$('lastUpdate').textContent='Esperando primeras lecturas';
  $('ageHint').textContent='No hay una lectura disponible.';
  $('footerStamp').textContent='';
  for(const id of ['avg7','maxToday','minToday'])$(id).textContent='—';
  $('avg7Note').textContent='Sin datos suficientes';
  $('maxTodayNote').textContent='Sin lecturas de hoy';$('minTodayNote').textContent='Sin lecturas de hoy';
  return;
 }
 const now=new Date(),minutes=Math.max(0,Math.floor((now-latest.time)/60000));
 $('currentCount').textContent=number(latest.people);
 $('lastUpdate').textContent='Última lectura: '+timeFormat.format(latest.time);
 $('ageHint').textContent=minutes<60?'Hace '+minutes+' min':'Hace '+Math.floor(minutes/60)+' h '+minutes%60+' min';
 $('footerStamp').textContent='Datos: '+timeFormat.format(latest.time);
 status(minutes<20?'Datos recientes':'Datos desactualizados',minutes<20?'ok':'warning');
 const seven=data.filter(row=>row.time>=new Date(now.getTime()-7*DAY_MS));
 $('avg7').textContent=seven.length?number(Math.round(average(seven.map(row=>row.people)))):'—';
 $('avg7Note').textContent=seven.length?'Personas por lectura':'Sin datos suficientes';
 const today=info(now).day,rows=data.filter(row=>info(row.time).day===today);
 if(rows.length){
  const hi=rows.reduce((a,b)=>a.people>=b.people?a:b);
  const lo=rows.reduce((a,b)=>a.people<=b.people?a:b);
  $('maxToday').textContent=number(hi.people);
  $('minToday').textContent=number(lo.people);
  $('maxTodayNote').textContent=hourFormat.format(hi.time);
  $('minTodayNote').textContent=hourFormat.format(lo.time);
 }else{
  $('maxToday').textContent='—';$('minToday').textContent='—';
  $('maxTodayNote').textContent='Sin lecturas de hoy';$('minTodayNote').textContent='Sin lecturas de hoy';
 }
}
function periodName(){
 if(selectedDay)return window.OcupacionFecha.label(selectedDay);
 if(selectedMonth)return monthLabel(selectedMonth);
 return period===1?'Hoy':'Últimos '+period+' días';
}
function selectionRows(){
 if(selectedDay){
  if(dayLoading||dayError)return [];
  const source=archiveData.get(selectedDay.slice(0,7))||data;
  return source.filter(row=>info(row.time).day===selectedDay);
 }
 if(selectedMonth){
  if(monthLoading||monthError)return [];
  const source=archiveData.get(selectedMonth)||data;
  return source.filter(row=>info(row.time).month===selectedMonth);
 }
 const now=Date.now(),today=info(new Date()).day;
 return data.filter(row=>period===1?info(row.time).day===today:row.time.getTime()>=now-period*DAY_MS);
}
function patternRows(){
 if(selectedMonth)return selectionRows();
 const since=Date.now()-30*DAY_MS;
 return data.filter(row=>row.time.getTime()>=since);
}
function renderPeriodMetrics(rows){
 $('periodName').textContent=periodName();
 if(!rows.length){
  for(const id of ['periodMean','periodHigh','periodLow','periodDays'])$(id).textContent='—';
  return;
 }
 $('periodMean').textContent=number(Math.round(average(rows.map(row=>row.people))));
 $('periodHigh').textContent=number(Math.max(...rows.map(row=>row.people)));
 $('periodLow').textContent=number(Math.min(...rows.map(row=>row.people)));
 $('periodDays').textContent=number(new Set(rows.map(row=>info(row.time).day)).size);
}
function summarize(rows,granularity){
 if(granularity==='raw')return rows.map(row=>({x:row.time.getTime(),mean:row.people,max:row.people,count:1,label:timeFormat.format(row.time)}));
 const groups=new Map();
 for(const row of rows){
  const parts=info(row.time);
  const key=granularity==='hour'?parts.day+'-'+String(parts.hour).padStart(2,'0'):parts.day;
  let entry=groups.get(key);
  if(!entry){
   entry={x:row.time.getTime(),count:0,total:0,max:row.people,label:granularity==='hour'?hourFormat.format(row.time):shortDate.format(row.time)};
   groups.set(key,entry);
  }
  entry.count++;
  entry.total+=row.people;
  entry.max=Math.max(entry.max,row.people);
  entry.x=Math.min(entry.x,row.time.getTime());
 }
 return [...groups.values()].sort((a,b)=>a.x-b.x).map(entry=>({
  x:entry.x,mean:Math.round(entry.total/entry.count),max:entry.max,
  count:entry.count,label:entry.label
 }));
}
function emptyChart(canvasId,emptyId,message){
 $(canvasId).hidden=true;
 $(emptyId).hidden=false;
 $(emptyId).textContent=message;
}
function destroyChart(chart){if(chart)chart.destroy();}
// Vista de detalle a escala propia: no comprime 60 reservas bajo los 500
// asistentes reales y no rellena intervalos de 15 min desconocidos.
function renderForecastTimeline(enabled,doc,now,styles){
 const panel=$('forecastTimeline');
 if(!panel)return;
 panel.hidden=!enabled;
 if(!enabled)return;
 const tracks=$('forecastTimelineRows'),axis=$('forecastTimelineAxis');
 const note=$('forecastTimelineNote');
 tracks.replaceChildren();
 axis.replaceChildren();
 const limit=now+120*60000;
 const fmt=new Intl.DateTimeFormat('es-ES',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
 for(let offset=0;offset<=120;offset+=30){
  const tick=document.createElement('span');
  tick.className='forecast-timeline-tick'+(offset===0?' first':offset===120?' last':'');
  tick.style.left=(offset/120*100)+'%';
  tick.textContent=offset===0?'Ahora · '+fmt.format(new Date(now)):
   fmt.format(new Date(now+offset*60000));
  axis.appendChild(tick);
 }
 const spans=window.OcupacionPrevision?.intervals(doc,now)||{};
 let shown=0,knownCurrent=0;
 for(const [key,label,color] of styles){
  const row=document.createElement('div');
  row.className='forecast-timeline-row';
  const name=document.createElement('span');
  name.className='forecast-timeline-name';name.textContent=label;
  const track=document.createElement('div');
  track.className='forecast-timeline-track';
  track.setAttribute('aria-label',label+' · próximas dos horas');
  const intervals=spans[key]||[];
  for(const part of intervals){
   const left=Math.max(now,part.start),right=Math.min(limit,part.end);
   if(left>=right)continue;
   shown++;
   if(part.phase==='current')knownCurrent++;
   const band=document.createElement('span');
   band.className='forecast-timeline-band'+
    (part.phase==='current'?' is-current':'')+
    (part.value===0?' is-zero':'');
   band.style.left=((left-now)/(limit-now)*100)+'%';
   band.style.width=((right-left)/(limit-now)*100)+'%';
   band.style.setProperty('--band-color',color);
   const descriptor=part.value===0?'0 verificado':part.value+' personas equivalentes';
   const timing=fmt.format(new Date(left))+' a '+fmt.format(new Date(right));
   band.title=label+': '+descriptor+' · '+timing;
   band.setAttribute('aria-label',band.title);
   if(part.value>0&&(right-left)>=14*60000)band.textContent=String(part.value);
   track.appendChild(band);
  }
  if(!intervals.length){
   const empty=document.createElement('span');
   empty.className='forecast-timeline-unknown';
   empty.textContent='Sin datos verificables';
   track.appendChild(empty);
  }
  row.append(name,track);tracks.appendChild(row);
 }
 note.textContent=shown?
  'Franjas de 15 min verificadas, agrupadas cuando son contiguas. Vacío significa desconocido, no cero.':
  forecastLoading?'Comprobando reservas próximas…':
  'Sin franjas verificables para este momento.';
}
function trend(){
 $('forecastTimeline').hidden=true;
 destroyChart(trendChart);trendChart=null;
 const rows=selectionRows();
 renderPeriodMetrics(rows);
 $('chartCount').textContent=number(rows.length)+' lecturas';
 if(dayLoading){emptyChart('trendChart','chartEmpty','Cargando lecturas del día seleccionado…');return;}
 if(dayError){emptyChart('trendChart','chartEmpty',dayError);return;}
 if(monthLoading){emptyChart('trendChart','chartEmpty','Cargando histórico mensual…');return;}
 if(monthError){emptyChart('trendChart','chartEmpty',monthError);return;}
 if(!rows.length){emptyChart('trendChart','chartEmpty','Todavía no hay lecturas para este periodo.');return;}
 if(typeof Chart==='undefined'){emptyChart('trendChart','chartEmpty','Preparando gráfico…');return;}
 const granularity=selectedDay?'raw':selectedMonth||period===30?'day':period===7?'hour':'raw';
 const summary=summarize(rows,granularity);
 const aggregate=granularity!=='raw';
 $('chartCaption').textContent=granularity==='raw'
  ? 'Cada punto es una lectura real · Horario peninsular'
  : granularity==='hour'
  ? 'Media y máximo observados de cada hora · Horario peninsular'
  : 'Media y máximo observados de cada día · Horario peninsular';
 $('chartCount').textContent=number(rows.length)+' lecturas · '+number(summary.length)+(granularity==='hour'?' horas':granularity==='day'?' días':' puntos');
 let stacked=false;
 let series=[{
  label:aggregate?'Media':'Personas',
  data:summary.map(row=>({x:row.x,y:row.mean,label:row.label,count:row.count})),
  parsing:false,borderColor:'#316ab9',backgroundColor:'rgba(49,106,185,.09)',
  borderWidth:2,pointRadius:summary.length>80?0:summary.length>30?1:2,
  pointHoverRadius:5,fill:true,tension:.17,spanGaps:false
 }];
 if(aggregate)series.push({
  label:'Máximo',data:summary.map(row=>({x:row.x,y:row.max,label:row.label,count:row.count})),
  parsing:false,borderColor:'#d99051',backgroundColor:'transparent',
  borderDash:[4,4],borderWidth:1.5,pointRadius:0,pointHoverRadius:4,fill:false,tension:.12
 });
 const effectivePoints=breakdownEnabled?effectiveBreakdown():[];
 if(breakdownEnabled&&window.OcupacionDesglose&&effectivePoints.length){
  const layered=window.OcupacionDesglose.build(summary,rows,granularity,effectivePoints,info);
  if(layered.available){
   stacked=true;
   const categories=[
    ['directed','Actividades dirigidas','#317ac2','rgba(49,122,194,.28)'],
    ['tennis','Tenis','#c88b39','rgba(200,139,57,.29)'],
    ['squash','Esquaix','#8f63ba','rgba(143,99,186,.26)'],
    ['fronton','Frontón','#299786','rgba(41,151,134,.27)'],
    ['unattributed','Sin atribuir (residual estimado)','#a4b0c2','rgba(164,176,194,.25)']
   ];
   series=[];
   for(const [key,label,border,background] of categories){
    const points=layered.series[key];
    if(!points.some(p=>p.y!==null))continue;
    series.push({
     label,data:points,parsing:false,stack:'componentes',
     borderColor:border,backgroundColor:background,borderWidth:1.8,
     pointRadius:0,pointHoverRadius:3,
     fill:series.length?'-1':'origin',tension:.07,spanGaps:false
    });
   }
   series.push({
    label:'Total en el club (medido)',stack:'total',parsing:false,
    data:summary.map(row=>({x:row.x,y:row.mean,label:row.label,count:row.count})),
    borderColor:'#1d3557',backgroundColor:'transparent',
    borderWidth:2.8,pointRadius:0,pointHoverRadius:5,fill:false,tension:.12,spanGaps:false
   });
   const sportsShown=effectivePoints[0]?.quarter&&
    ['tennis','squash','fronton'].some(key=>layered.series[key].some(point=>point.y!==null));
   $('chartCaption').textContent='Total real (línea oscura) · Componentes estimados (áreas) · Sin atribuir es un residual teórico.'+
    (sportsShown?' El modelo asigna a cada pista no reservable 3 personas en tenis, 2 en esquaix y 4 en frontón.':'');
   $('breakdownInfo').textContent=breakdownInfo(
    number(layered.coverage)+' de '+number(layered.total)+
    ' puntos con estimaciones comparables.'+
     (period===1&&!selectedDay&&!selectedMonth&&
      Date.now()<breakdownRecentExpiry&&breakdownRecentPoints.length?
      ' · Últimas 3 h actualizadas con capturas recientes.':''));
  }else $('breakdownInfo').textContent=breakdownInfo('No hay estimaciones coincidentes con este periodo. Se muestra el total real.');
 }else if(breakdownEnabled){
  $('breakdownInfo').textContent=breakdownLoading?'Comprobando desglose anónimo…':
    breakdownInfo(selectedBreakdownMonth()&&
     breakdownArchiveMonths.has(selectedBreakdownMonth())&&
     !breakdownArchiveData.has(selectedBreakdownMonth())?
     (breakdownArchiveFailed.has(selectedBreakdownMonth())?
       'No se pudo consultar el desglose mensual. Se muestra el total real.':
       'Consultando desglose mensual. Se muestra el total real.'):
     'Desglose sin estimaciones validadas. Se muestra el total real.');
 }
 // El futuro se superpone, nunca apila ni prolonga el total medido.
 const futureEnabled=breakdownEnabled&&!selectedDay&&!selectedMonth&&period===1;
 const nowMs=Date.now();
 const ongoing=(futureEnabled&&window.OcupacionPrevision)?
  window.OcupacionPrevision.ongoing(forecastDoc,nowMs):null;
 const futureStyles=[
  ['directed','Actividades dirigidas','#317ac2'],
  ['tennis','Tenis','#c88b39'],
  ['squash','Esquaix','#8f63ba'],
  ['fronton','Frontón','#299786']
 ];
 // Franja actual: estimación basada en reservas anteriores al comienzo,
 // línea continua sin puntos, separada del total real y de la previsión.
 let ongoingShown=0;
 if(ongoing){
  for(const [key,label,color] of futureStyles){
   const value=ongoing.values[key];
   if(value===null)continue;
   ongoingShown++;
   series.push({
    label:label+' (franja actual)',parsing:false,
    data:[{x:ongoing.start,y:value,ongoing:true},
          {x:ongoing.now,y:value,ongoing:true}],
    stack:'franja-actual-'+key,ongoing:true,
    borderColor:color,backgroundColor:'transparent',
    borderWidth:2.4,pointRadius:0,pointHoverRadius:0,pointHitRadius:8,
    fill:false,tension:0,spanGaps:false
   });
  }
 }
 let futureShown=0;
 const intervals=(futureEnabled&&window.OcupacionPrevision)?
  window.OcupacionPrevision.intervals(forecastDoc,nowMs):null;
 if(intervals){
  for(const [key,label,color] of futureStyles){
   const spans=(intervals[key]||[]).filter(part=>part.phase==='future');
   if(!spans.length)continue;
   futureShown++;
   // Segmentos horizontales representan el intervalo COMPLETO conocido;
   // tramos desconocidos no quedan unidos por una línea imaginaria.
   for(const segment of spans){
    series.push({
     label:label+' (previsión)',
     data:[{x:segment.start,y:segment.value,forecast:true},
           {x:segment.end,y:segment.value,forecast:true}],
     parsing:false,stack:'prevision-'+key,forecast:true,
     borderColor:color,backgroundColor:'transparent',
     borderDash:[5,5],borderWidth:2.8,
     pointRadius:0,pointHoverRadius:5,fill:false,tension:0,spanGaps:false
    });
   }
  }
 }
 renderForecastTimeline(futureEnabled,forecastDoc,nowMs,futureStyles);
 const futureInfo=$('forecastInfo');
 if(futureInfo){
  futureInfo.hidden=!futureEnabled;
  if(futureEnabled)futureInfo.textContent=(futureShown||ongoingShown)?
   (ongoingShown?'Franja en curso: línea continua sin puntos (estimación de reservas). ':'')+
   (futureShown?'Próximas 2 h: franjas horizontales discontinuas. ':'')+
   'Las pistas representan disponibilidad no reservable, no asistencia confirmada.':
   forecastLoading?'Comprobando previsión de las próximas 2 h…':
   forecastFailed?'Previsión no disponible; el histórico se mantiene sin cambios.':
   'Sin estimaciones futuras suficientemente recientes y verificadas.';
 }
 const nowLine={
  id:'futureNowLine',
  afterDraw(chart){
   if(!futureShown&&!ongoingShown)return;
   const x=chart.scales.x.getPixelForValue(nowMs);
   const {ctx,chartArea}=chart;
   if(!Number.isFinite(x)||x<chartArea.left||x>chartArea.right)return;
   ctx.save();
   ctx.strokeStyle='#66758d';ctx.lineWidth=1;ctx.setLineDash([3,4]);
   ctx.beginPath();ctx.moveTo(x,chartArea.top);ctx.lineTo(x,chartArea.bottom);ctx.stroke();
   ctx.setLineDash([]);ctx.fillStyle='#556783';
   ctx.font='11px sans-serif';ctx.textAlign='left';
   ctx.fillText('Ahora',Math.min(x+5,chartArea.right-34),chartArea.top+12);
   ctx.restore();
  }
 };
 $('trendChart').hidden=false;$('chartEmpty').hidden=true;
 trendChart=new Chart($('trendChart'),{
  type:'line',data:{datasets:series},plugins:[nowLine],
  options:{
   responsive:true,maintainAspectRatio:false,animation:false,normalized:true,
   interaction:(futureShown||ongoingShown)?{mode:'nearest',axis:'x',intersect:false}:
    {mode:'index',intersect:false},
   plugins:{
    legend:{display:aggregate||stacked||futureShown>0||ongoingShown>0,position:'bottom',labels:{
     usePointStyle:true,boxWidth:7,padding:18,color:'#7588a2',font:{size:11},
     // En móvil evitar cuatro entradas duplicadas: color heredado + trazo discontinuo.
     filter:item=>!stacked||(
      !item.text.endsWith(' (previsión)')&&
      !item.text.endsWith(' (franja actual)'))
    }},
    tooltip:{callbacks:{
     title:items=>items[0]?.raw?.label||
      (items[0]?.raw?.forecast||items[0]?.raw?.ongoing?
       timeFormat.format(new Date(items[0].raw.x)):''),

     label:item=>item.dataset.label+': '+number(item.parsed.y)+
       (item.dataset.ongoing?' personas equivalentes en esta franja (reservas, no asistencia)':
        item.dataset.forecast?' personas equivalentes previstas (reservas, no asistencia)':
        stacked&&item.dataset.stack==='componentes'?' personas equivalentes estimadas':' personas medidas'),
     footer:items=>aggregate?(items[0].raw.count+' lecturas en el intervalo'):''
    }}
   },
   scales:{
    x:{type:'linear',...(futureShown?{max:nowMs+120*60000}:{}),grid:{display:false},ticks:{
     maxTicksLimit:7,color:'#8b98ab',font:{size:10},
     callback:value=>new Intl.DateTimeFormat('es-ES',{timeZone:zone,...(granularity==='raw'?{hour:'2-digit',minute:'2-digit'}:granularity==='hour'?{day:'2-digit',month:'2-digit',hour:'2-digit'}:{day:'2-digit',month:'2-digit'})}).format(new Date(value))
    }},
    y:{beginAtZero:true,stacked,grid:{color:'#eaf0f7'},ticks:{precision:0,color:'#8b98ab',font:{size:10}}}
   }
  }
 });
}
// Agrupamos primero las lecturas por día y hora. Así, aunque falten muestras,
// cada día contribuye con el mismo peso a las medias horarias.
function hourlyBuckets(rows){
 const buckets=Array.from({length:7},()=>Array.from({length:18},()=>new Map()));
 for(const row of rows){
  const v=info(row.time);
  if(v.hour<6||v.hour>23)continue;
  const slot=buckets[v.weekday][v.hour-6];
  const previous=slot.get(v.day)||{sum:0,count:0};
  previous.sum+=row.people;previous.count++;
  slot.set(v.day,previous);
 }
 return buckets.map(day=>day.map(slot=>{
  const daily=[...slot.values()].map(entry=>entry.sum/entry.count);
  return {days:daily.length,mean:daily.length?average(daily):null};
 }));
}
function makeProfile(rows){
 const sections=[
  {name:'Laborables',first:0,last:4,color:'#356ebe',days:new Set(),hourly:Array.from({length:18},()=>new Map())},
  {name:'Fin de semana',first:5,last:6,color:'#d59155',days:new Set(),hourly:Array.from({length:18},()=>new Map())}
 ];
 for(const row of rows){
  const k=info(row.time);
  if(k.hour<6||k.hour>23)continue;
  const section=sections[k.weekday<=4?0:1];
  section.days.add(k.day);
  const slot=section.hourly[k.hour-6];
  const sums=slot.get(k.day)||{total:0,count:0};
  sums.total+=row.people;sums.count++;
  slot.set(k.day,sums);
 }
 const series=[];
 for(const section of sections){
  if(section.days.size<3)continue;
  const points=section.hourly.map((slot,index)=>{
   const values=[...slot.values()].map(row=>row.total/row.count);
   return {x:index+6,y:values.length>=2?Math.round(average(values)):null,days:values.length};
  });
  series.push({label:section.name,data:points,color:section.color,days:section.days.size});
 }
 return {series,weekdayDays:sections[0].days.size,weekendDays:sections[1].days.size};
}
function profile(rows){
 destroyChart(profileChart);profileChart=null;
 $('profileScope').textContent=selectedMonth?monthLabel(selectedMonth):'Últimos 30 días';
 if(monthLoading){emptyChart('profileChart','profileEmpty','Cargando histórico mensual…');return;}
 if(monthError){emptyChart('profileChart','profileEmpty','No se ha podido cargar este periodo.');return;}
 const comparison=makeProfile(rows);
 $('profileCoverage').textContent=comparison.weekdayDays+' días laborables · '+comparison.weekendDays+' días de fin de semana';
 if(!comparison.series.length){
  emptyChart('profileChart','profileEmpty','Se necesitan al menos 3 jornadas por tipo de día para mostrar patrones fiables.');
  return;
 }
 if(typeof Chart==='undefined'){emptyChart('profileChart','profileEmpty','Preparando gráfico…');return;}
 $('profileChart').hidden=false;$('profileEmpty').hidden=true;
 profileChart=new Chart($('profileChart'),{
  type:'line',
  data:{datasets:comparison.series.map(s=>({
   label:s.label,
   data:s.data,parsing:false,borderColor:s.color,backgroundColor:s.color,
   pointRadius:2,pointHoverRadius:5,borderWidth:2.5,tension:.3,spanGaps:false
  }))},
  options:{
   responsive:true,maintainAspectRatio:false,animation:false,
   interaction:{mode:'index',intersect:false},
   plugins:{
    legend:{display:true,position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:18,color:'#71839a',font:{size:11}}},
    tooltip:{callbacks:{
     title:items=>String(items[0].parsed.x).padStart(2,'0')+':00',
     label:item=>item.dataset.label+': '+number(item.parsed.y)+' personas',
     afterLabel:item=>item.raw.days+' jornadas con datos a esa hora'
    }}
   },
   scales:{
    x:{type:'linear',min:6,max:23,grid:{display:false},ticks:{maxTicksLimit:10,stepSize:2,color:'#8b98ab',font:{size:10},callback:value=>String(value).padStart(2,'0')+':00'}},
    y:{beginAtZero:true,grid:{color:'#eaf0f7'},ticks:{precision:0,color:'#8b98ab',font:{size:10}}}
   }
  }
 });
}
function heat(grid,labels,caption){
 const values=grid.flat().filter(slot=>slot.mean!==null).map(slot=>slot.mean);
 const low=values.length?Math.min(...values):0,high=values.length?Math.max(...values):0;
 const target=$('heatmap');target.replaceChildren();
 function cell(text,cls,title){
  const el=document.createElement('div');el.className=cls;el.textContent=text;
  if(title){el.title=title;el.setAttribute('aria-label',title);}
  target.append(el);
 }
 cell('Día','heat-header heat-day');
 for(let hour=6;hour<=23;hour++)cell(String(hour).padStart(2,'0'),'heat-header');
 for(let d=0;d<labels.length;d++){
  cell(labels[d].short,'heat-day',labels[d].full);
  for(let h=0;h<18;h++){
   const slot=grid[d][h];
   const level=slot.mean===null?0:low===high?3:Math.min(5,1+Math.floor((slot.mean-low)/(high-low)*4.999));
   const daysLabel=slot.days===1?'1 día':slot.days+' días';
   const detail=slot.mean===null?'Sin lecturas':number(Math.round(slot.mean))+' personas de media, '+daysLabel;
   cell(slot.mean===null?'·':number(Math.round(slot.mean)),'heat-cell heat-'+level,
    labels[d].full+' '+String(h+6).padStart(2,'0')+':00 · '+detail);
  }
 }
 $('heatmapCaption').textContent=values.length
  ? caption+'. '+values.length+' de '+(grid.length*18)+' franjas con lecturas. Colores relativos a esta vista.'
  : caption+'. No hay lecturas para estas franjas.';
}
function renderHeatmap(){
 const today=info(new Date()),key=today.day,mode=heatmapPeriod;
 const plural=['lunes','martes','miércoles','jueves','viernes','sábados','domingos'];
 $('heatmapOtherDay').textContent='Otros '+plural[today.weekday];
 document.querySelectorAll('[data-heatmap-period]').forEach(button=>{
  const active=button.dataset.heatmapPeriod===mode;
  button.classList.toggle('selected',active);
  button.setAttribute('aria-pressed',String(active));
 });
 const single=mode==='hoy'||mode==='ayer'||mode==='semanas';
 $('heatmapTitle').textContent=single?'Mapa de calor por horas':'Mapa de calor semanal';
 let grid,labels,caption,subtitle;
 if(mode==='habitual'){
  grid=hourlyBuckets(patternRows());
  labels=names.map(name=>({short:name.slice(0,3),full:name}));
  subtitle='Media por día de la semana y hora. Los huecos representan ausencia de lecturas.';
  caption=selectedMonth?'Medias del mes '+monthLabel(selectedMonth):
   'Patrón calculado con los últimos 30 días';
 }else if(mode==='semanas'){
  const comparable=window.OcupacionHeatmap.comparableRows(data,today,info);
  grid=[hourlyBuckets(comparable)[today.weekday]];
  labels=[{short:names[today.weekday].slice(0,3),full:names[today.weekday]+' de otras semanas'}];
  subtitle='Mismo día de la semana en las últimas 8 semanas, sin contar hoy.';
  caption='Media de otros '+plural[today.weekday]+' durante las últimas 8 semanas';
 }else{
  const keys=window.OcupacionHeatmap.dates(mode,key);
  grid=window.OcupacionHeatmap.dailyBuckets(data,keys,info);
  labels=keys.map(day=>{
   const date=new Date(day+'T12:00:00Z');
   return {short:names[window.OcupacionHeatmap.weekday(day)].slice(0,3)+' '+date.getUTCDate(),
    full:heatmapFullDate.format(date)};
  });
  if(mode==='siete'){
   subtitle='Últimos 7 días naturales, del más antiguo a hoy. Hoy puede estar incompleto.';
   caption='Lecturas del '+heatmapShortDate.format(new Date(keys[0]+'T12:00:00Z'))+
    ' al '+heatmapShortDate.format(new Date(keys[6]+'T12:00:00Z'));
  }else{
   subtitle=mode==='hoy'?'Lecturas de hoy, hora a hora. El día aún puede estar incompleto.':
    'Lecturas de ayer, hora a hora.';
   caption='Lecturas de '+heatmapFullDate.format(new Date(keys[0]+'T12:00:00Z'));
  }
 }
 $('heatmapSubtitle').textContent=subtitle;
 $('heatmap').setAttribute('aria-label',subtitle);
 heat(grid,labels,caption);
}
function recommendations(grid){
 $('recommendationsScope').textContent=selectedMonth?monthLabel(selectedMonth):'Últimos 30 días';
 const target=$('recommendations');target.replaceChildren();
 const candidates=grid.flatMap((day,d)=>day.map((slot,h)=>({...slot,day:d,hour:h+6})))
  .filter(slot=>slot.days>=3).sort((a,b)=>a.mean-b.mean);
 const picked=[],seenDays=new Set();
 for(const slot of candidates){
  if(seenDays.has(slot.day))continue;
  seenDays.add(slot.day);picked.push(slot);
  if(picked.length===3)break;
 }
 if(!picked.length){
  const p=document.createElement('p');p.className='muted-copy';
  p.textContent='Se necesitan lecturas en al menos tres jornadas distintas de la misma franja para identificar horarios tranquilos.';
  target.append(p);
  $('insightText').textContent='A medida que acumulemos registros, aparecerán aquí los horarios que suelen estar más tranquilos.';
  return;
 }
 for(const [index,slot] of picked.entries()){
  const e=document.createElement('article');e.className='recommendation';
  for(const [tag,text,cls] of [
   ['div','OPCIÓN '+(index+1),'rec-rank'],
   ['strong',names[slot.day]+' · '+String(slot.hour).padStart(2,'0')+':00',''],
   ['span',number(Math.round(slot.mean))+' personas de media',''],
   ['small',slot.days+' jornadas comparadas','']
  ]){
   const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;e.append(n);
  }
  target.append(e);
 }
 const best=picked[0];
 $('insightText').textContent='Según el histórico disponible, '+names[best.day].toLowerCase()+' sobre las '+String(best.hour).padStart(2,'0')+':00 es una de las franjas con menos ocupación observada.';
}
function renderAnalytics(){
 const rows=selectionRows();
 trend();
 const pattern=patternRows();
 profile(pattern);
 renderHeatmap();
 recommendations(hourlyBuckets(pattern));
}
function updateDayControls(){
 const input=$('daySelect');
 input.value=selectedDay||'';
 input.max=window.OcupacionFecha.key(new Date());
 input.dataset.selected=String(!!selectedDay);
 $('clearDay').hidden=!selectedDay;
}
function updateMonthOptions(){
 const list=new Set([...archiveMonths,...data.map(row=>info(row.time).month)]);
 const months=[...list].sort().reverse();
 const select=$('monthSelect');
 select.replaceChildren(new Option('Elegir mes',''));
 for(const month of months)select.add(new Option(monthLabel(month),month));
 select.value=selectedMonth||'';
 const input=$('daySelect');
 input.min=months.length?months.at(-1)+'-01':'';
 updateDayControls();
}
async function loadArchiveIndex(){
 try{
  const index=await dataFetch('data/archivo/index.json','json');
  if(!Array.isArray(index.months))return;
  archiveMonths.clear();
  for(const month of index.months){
   if(/^\d{4}-(0[1-9]|1[0-2])$/.test(month))archiveMonths.add(month);
  }
  updateMonthOptions();
 }catch(error){/* El panel reciente funciona aunque no se pueda cargar el índice. */}
}
function updatePeriodButtons(){
 for(const button of document.querySelectorAll('[data-days]')){
  const active=!selectedMonth&&!selectedDay&&Number(button.dataset.days)===period;
  button.classList.toggle('selected',active);
  button.setAttribute('aria-pressed',String(active));
 }
}
async function selectDay(day){
 if(day&&!window.OcupacionFecha.valid(day)){
  updateDayControls();
  return;
 }
 const request=++dayRequest;
 selectedDay=day||null;
 selectedMonth=null;
 monthLoading=false;monthError=null;dayError=null;
 dayLoading=!!selectedDay;
 updatePeriodButtons();updateMonthOptions();renderAnalytics();
 if(breakdownEnabled)loadBreakdownArchive();
 if(!selectedDay)return;
 const chosen=selectedDay;
 const month=chosen.slice(0,7);
 try {
  // El CSV reciente puede no haberse cargado todavía.
  await ensureHistory();
  if(request!==dayRequest||selectedDay!==chosen)return;
  const present=data.some(row=>info(row.time).day===chosen);
  // Archivos cerrados, solo si el día no está en el CSV reciente.
  if(!present&&!archiveData.has(month)&&month<info(new Date()).month){
   const parsed=parse(await dataFetch('data/archivo/'+encodeURIComponent(month)+'.csv'));
   archiveData.set(month,parsed);
  }
 }catch{
  if(request===dayRequest&&selectedDay===chosen)
   dayError='No se pudo cargar el histórico de la fecha elegida.';
 }finally{
  if(request===dayRequest&&selectedDay===chosen){
   dayLoading=false;renderAnalytics();
  }
 }
}
async function selectMonth(month){
 // La selección mensual histórica sigue teniendo prioridad sobre filtros puntuales.
 heatmapPeriod='habitual';
 ++dayRequest;
 selectedDay=null;dayLoading=false;dayError=null;
 selectedMonth=month||null;
 monthLoading=false;monthError=null;
 updatePeriodButtons();updateMonthOptions();
 if(breakdownEnabled)loadBreakdownArchive();
 if(!selectedMonth){renderAnalytics();return;}
 if(!archiveMonths.has(month)||archiveData.has(month)){renderAnalytics();return;}
 monthLoading=true;renderAnalytics();
 try{
  const parsed=parse(await dataFetch('data/archivo/'+encodeURIComponent(month)+'.csv'));
  if(selectedMonth!==month)return;
  archiveData.set(month,parsed);
 }catch(error){
  if(selectedMonth===month)monthError='No se pudo consultar este mes. Prueba de nuevo más tarde.';
 }finally{
  if(selectedMonth===month){monthLoading=false;renderAnalytics();}
 }
}
document.querySelectorAll('[data-heatmap-period]').forEach(button=>button.addEventListener('click',()=>{
 heatmapPeriod=button.dataset.heatmapPeriod;
 renderHeatmap();
}));
document.querySelectorAll('[data-days]').forEach(button=>button.addEventListener('click',()=>{
 ++dayRequest;
 period=Number(button.dataset.days);
 selectedDay=null;dayLoading=false;dayError=null;
 selectedMonth=null;monthLoading=false;monthError=null;
 updatePeriodButtons();updateMonthOptions();renderAnalytics();
}));
$('monthSelect').addEventListener('change',event=>{
 if(!event.target.value)period=1;
 selectMonth(event.target.value);
});
$('daySelect').addEventListener('change',event=>{
 if(!event.target.value)period=1;
 selectDay(event.target.value);
});
$('clearDay').addEventListener('click',()=>{
 period=1;
 selectDay(null);
});

function notifyInsights(){
 if(typeof window==='undefined')return;
 const current=currentReading();
 window.OCUPACION_STATE={
  rows:data,
  latest:current&&!estimatedReading(current)?{time:new Date(current.time),people:current.people}:null,
  estimated:estimatedReading(current)
 };
 window.dispatchEvent(new Event('ocupacion:data'));
}
function rebuildReadings(){
 data=mergeReadings(recentRows,liveRows);
 updateMonthOptions();
 if(!quickMode)renderAnalytics();
 liveMetrics();
 notifyInsights();
}
function setQuickMode(enabled){
 quickMode=!!enabled;
 document.body.classList.toggle('quick-mode',quickMode);
 const button=$('viewToggle');
 button.textContent=quickMode?'Vista completa':'Vista rápida';
 button.setAttribute('aria-pressed',String(quickMode));
 button.title=quickMode?'Mostrar estadísticas e histórico':'Mostrar únicamente ocupación y tendencias';
 try{localStorage.setItem('ocupacion:quick',quickMode?'1':'0');}catch(e){}
 window.OCUPACION_VIEW_QUICK=quickMode;
 window.dispatchEvent(new Event('ocupacion:view'));
 if(!quickMode&&!initializing){
  ensureCharts();
  if(!historyLoaded)ensureHistory();
  else renderAnalytics();
  loadArchiveIndex();
 }
}
let savedQuick=false;
try{savedQuick=localStorage.getItem('ocupacion:quick')==='1';}catch(e){}
$('viewToggle').addEventListener('click',()=>setQuickMode(!quickMode));
setQuickMode(savedQuick);
updateDayControls();
initializing=false;
async function ensureHistory(force=false){
 if(quickMode)return;
 if(historyInFlight)return historyInFlight;
 if(historyLoaded&&!force)return;
 historyInFlight=(async()=>{
  try{
   const csv=await dataFetch('data/ocupacion.csv');
   if(csv!==recentSignature){
    recentRows=parse(csv);
    recentSignature=csv;
    rebuildReadings();
   }
   historyLoaded=true;
  }catch(e){
   if(!historyLoaded)$('chartCaption').textContent='Histórico temporalmente no disponible.';
  }
 })().finally(()=>{historyInFlight=null;});
 return historyInFlight;
}
function acceptLatest(row){
 if(!latestSnapshot||row.time>latestSnapshot.time||
    (row.time.getTime()===latestSnapshot.time.getTime()&&row.people!==latestSnapshot.people))
  latestSnapshot=row;
 liveMetrics();notifyInsights();
}
// 1: latest.json. 2: ventana de 26h. 3: histórico bajo demanda.
async function refresh(){
 if(liveInFlight)return liveInFlight;
 liveInFlight=(async()=>{
  const results=await Promise.allSettled([
   dataFetch('data/latest.json','json').then(parseLatest).then(acceptLatest),
   dataFetch('data/reading-status.json','json').then(parseReadingStatus).then(next=>{
    // Nunca retroceder desde un estado más reciente.
    if(!readingStatus||!readingStatus.timestamp||next.timestamp&&next.timestamp>=readingStatus.timestamp){
     readingStatus=next;
     liveMetrics();notifyInsights();
    }
   }),
   dataFetch('data/live.csv').then(csv=>{
    if(csv!==liveSignature){
     liveRows=parse(csv);
     liveSignature=csv;
     rebuildReadings();
    }
   })
  ]);
  const allFailed=results[0].status==='rejected'&&results[2].status==='rejected';
  if(allFailed){
   status('Sin conexión con los datos','error');
   $('ageHint').textContent='No se pudo verificar una nueva lectura; consulta la hora indicada.';
  }else{
   liveMetrics();
   notifyInsights();
  }
  if(!quickMode){
   ensureCharts();
   if(!historyLoaded&&!historyInFlight)
    setTimeout(()=>ensureHistory(),150);
  }
 })().finally(()=>{liveInFlight=null;});
 return liveInFlight;
}

refresh();
setInterval(refresh,60000);
setInterval(()=>{if(!quickMode)ensureHistory(true);},3600000);
setInterval(()=>{if(!quickMode)loadArchiveIndex();},300000);
// Reconsultar solo mientras se visualiza el desglose, sin refrescar la página.
setInterval(()=>{
 if(!quickMode&&breakdownEnabled&&document.visibilityState==='visible'){
  loadBreakdown();loadBreakdownRecent();loadForecast();loadBreakdownArchive();
 }
},120000);
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&breakdownEnabled&&!quickMode){
  loadBreakdown();loadForecast();loadBreakdownArchive();
 }
});
})();
