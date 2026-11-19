(() => {
'use strict';

const $ = id => document.getElementById(id);
const zone = 'Europe/Madrid';
const DAY_MS = 86400000;
const names = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const number = n => new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(n);
const average = values => values.reduce((sum,value)=>sum+value,0)/values.length;
const timeFormat = new Intl.DateTimeFormat('es-ES',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const shortDate = new Intl.DateTimeFormat('es-ES',{timeZone:zone,day:'2-digit',month:'short'});
const hourFormat = new Intl.DateTimeFormat('es-ES',{timeZone:zone,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const localParts = new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'});
const monthLabelFormat = new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',month:'long',year:'numeric'});

function info(date){
 const parts=Object.fromEntries(localParts.formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
 return {
  day:parts.year+'-'+parts.month+'-'+parts.day,
  month:parts.year+'-'+parts.month,
  hour:Number(parts.hour),
  weekday:([6,0,1,2,3,4,5][['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday)])
 };
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
let data=[], lastCsv=null, selectedMonth=null, period=1;
let monthLoading=false,monthError=null,trendChart=null,profileChart=null;

function status(text,state){$('statusText').textContent=text;$('status').dataset.state=state;}
function liveMetrics(){
 $('totalReadings').textContent=number(data.length);
 $('totalNote').textContent=data.length
  ? new Set(data.map(row=>info(row.time).day)).size+' días con lecturas recientes'
  : 'Sin datos';
 if(!data.length){
  status('Sin datos','warning');
  $('currentCount').textContent='—';$('lastUpdate').textContent='Esperando primeras lecturas';
  $('ageHint').textContent='No hay una lectura disponible.';
  for(const id of ['avg7','maxToday','minToday'])$(id).textContent='—';
  return;
 }
 const now=new Date(),latest=data.at(-1),minutes=Math.max(0,Math.floor((now-latest.time)/60000));
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
 if(selectedMonth)return monthLabel(selectedMonth);
 return period===1?'Hoy':'Últimos '+period+' días';
}
function selectionRows(){
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
function trend(){
 destroyChart(trendChart);trendChart=null;
 const rows=selectionRows();
 renderPeriodMetrics(rows);
 $('chartCount').textContent=number(rows.length)+' lecturas';
 if(monthLoading){emptyChart('trendChart','chartEmpty','Cargando histórico mensual…');return;}
 if(monthError){emptyChart('trendChart','chartEmpty',monthError);return;}
 if(!rows.length){emptyChart('trendChart','chartEmpty','Todavía no hay lecturas para este periodo.');return;}
 if(typeof Chart==='undefined'){emptyChart('trendChart','chartEmpty','No se pudo cargar el gráfico.');return;}
 const granularity=selectedMonth||period===30?'day':period===7?'hour':'raw';
 const summary=summarize(rows,granularity);
 const aggregate=granularity!=='raw';
 $('chartCaption').textContent=granularity==='raw'
  ? 'Cada punto es una lectura real · Horario peninsular'
  : granularity==='hour'
  ? 'Media y máximo observados de cada hora · Horario peninsular'
  : 'Media y máximo observados de cada día · Horario peninsular';
 $('chartCount').textContent=number(rows.length)+' lecturas · '+number(summary.length)+(granularity==='hour'?' horas':granularity==='day'?' días':' puntos');
 const series=[{
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
 $('trendChart').hidden=false;$('chartEmpty').hidden=true;
 trendChart=new Chart($('trendChart'),{
  type:'line',data:{datasets:series},
  options:{
   responsive:true,maintainAspectRatio:false,animation:false,normalized:true,
   interaction:{mode:'index',intersect:false},
   plugins:{
    legend:{display:aggregate,position:'bottom',labels:{usePointStyle:true,boxWidth:7,padding:18,color:'#7588a2',font:{size:11}}},
    tooltip:{callbacks:{
     title:items=>items[0]?.raw?.label||'',
     label:item=>item.dataset.label+': '+number(item.parsed.y)+' personas',
     footer:items=>aggregate?(items[0].raw.count+' lecturas en el intervalo'):''
    }}
   },
   scales:{
    x:{type:'linear',grid:{display:false},ticks:{
     maxTicksLimit:7,color:'#8b98ab',font:{size:10},
     callback:value=>new Intl.DateTimeFormat('es-ES',{timeZone:zone,...(granularity==='raw'?{hour:'2-digit',minute:'2-digit'}:granularity==='hour'?{day:'2-digit',month:'2-digit',hour:'2-digit'}:{day:'2-digit',month:'2-digit'})}).format(new Date(value))
    }},
    y:{beginAtZero:true,grid:{color:'#eaf0f7'},ticks:{precision:0,color:'#8b98ab',font:{size:10}}}
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
function makeProfile(grid){
 const series=[];
 const uniqueWeekdays=new Set(),uniqueWeekend=new Set();
 const rows=patternRows();
 for(const row of rows){
  const k=info(row.time);
  if(k.weekday<=4)uniqueWeekdays.add(k.day);else uniqueWeekend.add(k.day);
 }
 const sections=[{name:'Laborables',first:0,last:4,days:uniqueWeekdays.size,color:'#356ebe'},
                 {name:'Fin de semana',first:5,last:6,days:uniqueWeekend.size,color:'#d59155'}];
 for(const section of sections){
  if(section.days<3)continue;
  const points=[];
  for(let hour=6;hour<=23;hour++){
   const daily=[];
   for(let day=section.first;day<=section.last;day++){
    // Un valor por fecha y hora, independientemente del número de lecturas.
    const entries=grid[day][hour-6];
    if(entries.mean!==null){
     // Estas medias se han calculado sobre días distintos de cada día de semana.
     // Cada calendario aparece en un único weekday dentro del conjunto.
     // Para el perfil completo necesitamos las medias de cada jornada.
    }
   }
   // Se calculan desde las lecturas agrupadas por fecha real, no desde un único
   // promedio por día de la semana.
   const dateSlots=new Map();
   for(const row of rows){
    const k=info(row.time);
    if(k.weekday<section.first||k.weekday>section.last||k.hour!==hour)continue;
    let sum=dateSlots.get(k.day);
    if(!sum){sum={total:0,n:0};dateSlots.set(k.day,sum);}
    sum.total+=row.people;sum.n++;
   }
   for(const item of dateSlots.values())daily.push(item.total/item.n);
   points.push(daily.length>=2?{x:String(hour).padStart(2,'0')+':00',y:Math.round(average(daily)),days:daily.length}:{x:String(hour).padStart(2,'0')+':00',y:null,days:daily.length});
  }
  series.push({label:section.name,data:points,color:section.color,days:section.days});
 }
 return {series,weekdayDays:uniqueWeekdays.size,weekendDays:uniqueWeekend.size};
}
function profile(grid){
 destroyChart(profileChart);profileChart=null;
 $('profileScope').textContent=selectedMonth?monthLabel(selectedMonth):'Últimos 30 días';
 if(monthLoading){emptyChart('profileChart','profileEmpty','Cargando histórico mensual…');return;}
 if(monthError){emptyChart('profileChart','profileEmpty','No se ha podido cargar este periodo.');return;}
 const comparison=makeProfile(grid);
 $('profileCoverage').textContent=comparison.weekdayDays+' días laborables · '+comparison.weekendDays+' días de fin de semana';
 if(!comparison.series.length){
  emptyChart('profileChart','profileEmpty','Se necesitan al menos 3 jornadas por tipo de día para mostrar patrones fiables.');
  return;
 }
 if(typeof Chart==='undefined'){emptyChart('profileChart','profileEmpty','No se pudo cargar el gráfico.');return;}
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
     label:item=>item.dataset.label+': '+number(item.parsed.y)+' personas',
     afterLabel:item=>item.raw.days+' jornadas con datos a esa hora'
    }}
   },
   scales:{
    x:{type:'category',grid:{display:false},ticks:{maxTicksLimit:10,color:'#8b98ab',font:{size:10}}},
    y:{beginAtZero:true,grid:{color:'#eaf0f7'},ticks:{precision:0,color:'#8b98ab',font:{size:10}}}
   }
  }
 });
}
function heat(grid){
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
 for(let d=0;d<7;d++){
  cell(names[d].slice(0,3),'heat-day');
  for(let h=0;h<18;h++){
   const slot=grid[d][h];
   const level=slot.mean===null?0:low===high?3:Math.min(5,1+Math.floor((slot.mean-low)/(high-low)*4.999));
   const detail=slot.mean===null?'Sin lecturas':number(Math.round(slot.mean))+' personas de media, '+slot.days+' días';
   cell(slot.mean===null?'·':number(Math.round(slot.mean)),'heat-cell heat-'+level,
    names[d]+' '+String(h+6).padStart(2,'0')+':00 · '+detail);
  }
 }
 $('heatmapCaption').textContent=values.length
  ? (selectedMonth?'Medias del mes '+monthLabel(selectedMonth):'Patrón calculado con los últimos 30 días')+'. Colores relativos a este periodo.'
  : 'Sin datos suficientes para este periodo.';
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
 const grid=hourlyBuckets(pattern);
 profile(grid);
 heat(grid);
 recommendations(grid);
}
function updateMonthOptions(){
 const list=new Set([...archiveMonths,...data.map(row=>info(row.time).month)]);
 const months=[...list].sort().reverse();
 const select=$('monthSelect');
 select.replaceChildren(new Option('Elegir mes',''));
 for(const month of months)select.add(new Option(monthLabel(month),month));
 select.value=selectedMonth||'';
}
async function loadArchiveIndex(){
 try{
  const response=await fetch('data/archivo/index.json?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)return;
  const index=await response.json();
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
  const active=!selectedMonth&&Number(button.dataset.days)===period;
  button.classList.toggle('selected',active);
  button.setAttribute('aria-pressed',String(active));
 }
}
async function selectMonth(month){
 selectedMonth=month||null;
 monthLoading=false;monthError=null;
 updatePeriodButtons();updateMonthOptions();
 if(!selectedMonth){renderAnalytics();return;}
 if(!archiveMonths.has(month)||archiveData.has(month)){renderAnalytics();return;}
 monthLoading=true;renderAnalytics();
 try{
  const response=await fetch('data/archivo/'+encodeURIComponent(month)+'.csv?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('No se pudo recuperar el archivo mensual.');
  const parsed=parse(await response.text());
  if(selectedMonth!==month)return;
  archiveData.set(month,parsed);
 }catch(error){
  if(selectedMonth===month)monthError='No se pudo consultar este mes. Prueba de nuevo más tarde.';
 }finally{
  if(selectedMonth===month){monthLoading=false;renderAnalytics();}
 }
}
document.querySelectorAll('[data-days]').forEach(button=>button.addEventListener('click',()=>{
 period=Number(button.dataset.days);
 selectedMonth=null;monthLoading=false;monthError=null;
 updatePeriodButtons();updateMonthOptions();renderAnalytics();
}));
$('monthSelect').addEventListener('change',event=>{
 if(!event.target.value)period=1;
 selectMonth(event.target.value);
});

async function refresh(){
 try{
  const response=await fetch('data/ocupacion.csv?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('No se pudieron cargar los datos.');
  const csv=await response.text();
  if(csv!==lastCsv){
   data=parse(csv);lastCsv=csv;
   updateMonthOptions();
   liveMetrics();renderAnalytics();
  }else liveMetrics();
 }catch(error){
  if(lastCsv===null){
   emptyChart('trendChart','chartEmpty',error.message);
   emptyChart('profileChart','profileEmpty','Datos no disponibles.');
   $('lastUpdate').textContent='No se pudieron cargar los datos.';
  }
  status('Error al consultar datos','error');
  $('ageHint').textContent='No se pudo comprobar si hay una actualización.';
 }
}
refresh();
loadArchiveIndex();
setInterval(refresh,60000);
setInterval(loadArchiveIndex,300000);
})();
