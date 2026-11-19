(() => {
'use strict';
const $=id=>document.getElementById(id);
const ZONE='Europe/Madrid';
const WEEK=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const num=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(n);
const locale=new Intl.DateTimeFormat('en-GB',{
 timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'
});
const monthFormatter=new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',month:'short',year:'2-digit'});
let monthlyChart=null,summarySignature='',latestState=null;
function info(date){
 const p=Object.fromEntries(locale.formatToParts(date).filter(v=>v.type!=='literal').map(v=>[v.type,v.value]));
 return {day:p.year+'-'+p.month+'-'+p.day,weekday:WEEK.indexOf(p.weekday),hour:Number(p.hour)};
}
function el(tag,cls,text){
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;
 return node;
}
function mean(arr){return arr.reduce((a,b)=>a+b,0)/arr.length;}
function hourlyHistory(rows,now){
 const current=info(now),groups=new Map();
 for(const row of rows){
  const k=info(row.time);
  if(k.day===current.day||row.time>=now)continue;
  const key=k.weekday+'-'+k.hour+'-'+k.day;
  let g=groups.get(key);
  if(!g){g={weekday:k.weekday,hour:k.hour,day:k.day,sum:0,count:0};groups.set(key,g);}
  g.sum+=row.people;g.count++;
 }
 const byHour=new Map();
 for(const g of groups.values()){
  const key=g.weekday+'-'+g.hour;
  if(!byHour.has(key))byHour.set(key,[]);
  byHour.get(key).push(g.sum/g.count);
 }
 return byHour;
}
function usual(current,history,now){
 const root=$('usualResult'),foot=$('usualCoverage');
 root.replaceChildren();
 if(!current){root.append(el('strong','','Sin lecturas recientes'));return;}
 const currentKey=info(current.time);
 const refs=history.get(currentKey.weekday+'-'+currentKey.hour)||[];
 if(refs.length<3){
  root.dataset.state='pending';
  root.append(el('strong','','Todavía sin referencias suficientes'));
  root.append(el('span','','Tenemos '+refs.length+' de las 3 jornadas equivalentes necesarias.'));
  foot.textContent='Se compara la misma hora y día de la semana de hasta 60 días anteriores.';
  return;
 }
 const historical=mean(refs),delta=current.people-historical;
 const percentage=historical?100*delta/historical:0;
 const direction=Math.abs(percentage)<5?'flat':delta<0?'down':'up';
 root.dataset.state=direction;
 const headline=direction==='flat'?'En línea con lo habitual':
  Math.abs(Math.round(percentage))+' % '+(delta<0?'menos':'más')+' de lo habitual';
 root.append(el('strong','usual-value',headline));
 root.append(el('span','usual-subtitle',num(current.people)+' ahora · '+num(Math.round(historical))+' de media en horarios equivalentes'));
 foot.textContent='Comparación basada en '+refs.length+' jornadas anteriores de la misma hora y día de la semana.';
}
function forecast(history,now){
 const root=$('forecastList');root.replaceChildren();
 const candidates=[];
 // Hasta seis horas futuras dentro de las franjas que muestra el histórico (06-23).
 for(let n=1;n<=6;n++){
  const future=new Date(now.getTime()+n*3600000),key=info(future);
  if(key.hour<6||key.hour>23)continue;
  const refs=history.get(key.weekday+'-'+key.hour)||[];
  if(refs.length<3)continue;
  const label=String(key.hour).padStart(2,'0')+':00';
  candidates.push({label,mean:Math.round(mean(refs)),samples:refs.length});
  if(candidates.length===4)break;
 }
 if(!candidates.length){
  root.append(el('p','muted-copy','Aún no hay suficientes días equivalentes para estimar las próximas horas.'));
  $('forecastNote').textContent='Se necesitan al menos tres jornadas comparables por franja.';
  return;
 }
 const lowest=Math.min(...candidates.map(x=>x.mean));
 for(const slot of candidates){
  const row=el('div','forecast-row');
  const left=el('div','forecast-left');
  left.append(el('strong','',slot.label),el('small','',slot.samples+' días comparados'));
  const right=el('div','forecast-right');
  right.append(el('strong','',num(slot.mean)+' personas'));
  if(slot.mean===lowest&&candidates.length>1)right.append(el('span','forecast-best','Más tranquila'));
  row.append(left,right);root.append(row);
 }
 $('forecastNote').textContent='Medias observadas en jornadas equivalentes. No son una predicción garantizada.';
}
function sparkline(current,rows){
 const svg=$('sparkline'),hint=$('sparklineHint');
 svg.replaceChildren();
 if(!current){
  hint.textContent='Sin lecturas';
  return;
 }
 const end=current.time.getTime(),start=end-2*3600000;
 const points=rows.filter(r=>r.time.getTime()>=start&&r.time.getTime()<=end);
 if(!points.some(r=>r.time.getTime()===end))points.push(current);
 points.sort((a,b)=>a.time-b.time);
 if(points.length<2){hint.textContent='Esperando más muestras';return;}
 const vals=points.map(x=>x.people),min=Math.min(...vals),max=Math.max(...vals);
 const span=Math.max(max-min,10);
 const xy=points.map(r=>[
  4+392*(r.time.getTime()-start)/(end-start),
  54-43*(r.people-min+span*.15)/(span*1.3)
 ]);
 // Break the line across gaps longer than 20 minutes, instead of suggesting
 // continuous observation through a missing period.
 const segments=[],currentSegment=[];
 for(let i=0;i<xy.length;i++){
  if(i>0&&points[i].time-points[i-1].time>20*60000){
   if(currentSegment.length>1)segments.push(currentSegment.splice(0));
   else currentSegment.length=0;
  }
  currentSegment.push(xy[i]);
 }
 if(currentSegment.length>1)segments.push(currentSegment);
 const ns='http://www.w3.org/2000/svg';
 const add=(tag,attrs)=>{
  const node=document.createElementNS(ns,tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  svg.append(node);return node;
 };
 add('line',{x1:4,y1:61,x2:396,y2:61,stroke:'#e5ecf6','stroke-width':1});
 for(const segment of segments){
  const coordinates=segment.map(p=>p.map(x=>x.toFixed(2)).join(',')).join(' ');
  add('polyline',{points:coordinates,fill:'none',stroke:'#3576be','stroke-width':2.6,
   'stroke-linejoin':'round','stroke-linecap':'round'});
 }
 const last=xy.at(-1);
 add('circle',{cx:last[0].toFixed(2),cy:last[1].toFixed(2),r:3.7,fill:'#2e79c2'});
 hint.textContent=num(min)+' – '+num(max)+' personas';
}
function render(){
 const state=window.OCUPACION_STATE;
 if(!state)return;
 latestState=state;
 const now=new Date(),history=hourlyHistory(state.rows,now);
 usual(state.latest,history,now);
 forecast(history,now);
 sparkline(state.latest,state.rows);
}
function archiveLabel(value){
 const t=monthFormatter.format(new Date(value+'-15T12:00:00.000Z'));
 return t.charAt(0).toUpperCase()+t.slice(1);
}
async function dataJson(path){
 const urls=['https://raw.githubusercontent.com/bogar/ocupacion-club/main/'+path+'?t='+Date.now(),path+'?t='+Date.now()];
 for(const url of urls){
  try{
   const response=await fetch(url,{cache:'no-store'});
   if(response.ok)return response.json();
  }catch(e){}
 }
 throw Error('No disponible');
}
async function monthly(){
 try{
  const summary=await dataJson('data/archivo/resumen.json');
  if(!Array.isArray(summary.months))throw Error('Resumen no válido');
  const months=summary.months.filter(m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m.month)&&
   Number.isFinite(m.mean)&&Number.isFinite(m.max)&&Number.isInteger(m.days)&&m.days>0)
   .sort((a,b)=>a.month.localeCompare(b.month)).slice(-12);
  const signature=JSON.stringify(months);
  if(signature===summarySignature)return;
  summarySignature=signature;
  if(monthlyChart){monthlyChart.destroy();monthlyChart=null;}
  if(!months.length){
   $('monthlyChart').hidden=true;$('monthlyEmpty').hidden=false;
   $('monthlyCoverage').textContent='Todavía sin meses cerrados';
   return;
  }
  $('monthlyEmpty').hidden=true;$('monthlyChart').hidden=false;
  $('monthlyCoverage').textContent=months.length+' meses disponibles';
  $('monthlyScope').textContent='Últimos '+months.length+' meses cerrados';
  if(typeof Chart==='undefined'){
   $('monthlyChart').hidden=true;$('monthlyEmpty').hidden=false;
   $('monthlyEmpty').textContent='No se pudo cargar la biblioteca de gráficos.';return;
  }
  monthlyChart=new Chart($('monthlyChart'),{
   type:'bar',
   data:{labels:months.map(m=>archiveLabel(m.month)),datasets:[{
    label:'Media de ocupación',data:months.map(m=>m.mean),
    backgroundColor:months.map(m=>m.days<7?'#a9bed9':'#427bb7'),
    borderRadius:7,maxBarThickness:46
   }]},
   options:{responsive:true,maintainAspectRatio:false,animation:false,
    plugins:{legend:{display:false},tooltip:{callbacks:{
     label:item=>'Media: '+num(item.parsed.y)+' personas',
     afterLabel:item=>{
      const m=months[item.dataIndex];
      return ['Máximo: '+num(m.max),'Días con datos: '+m.days,
        m.days<7?'Cobertura limitada, interpretar con cautela':''];
     }}}},
    scales:{
     x:{grid:{display:false},ticks:{color:'#8290a7',font:{size:10}}},
     y:{beginAtZero:true,grid:{color:'#eaf0f7'},ticks:{color:'#8290a7',precision:0}}
    }
   }
  });
 }catch(e){
  if(!monthlyChart){
   $('monthlyChart').hidden=true;$('monthlyEmpty').hidden=false;
   $('monthlyEmpty').textContent='La comparativa mensual aparecerá al cerrar el primer mes.';
  }
 }
}
window.addEventListener('ocupacion:data',render);
render();
monthly();
setInterval(monthly,15*60000);
})();
