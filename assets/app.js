(() => {
"use strict";
const $ = id => document.getElementById(id);
const zone = "Europe/Madrid";
const format = new Intl.DateTimeFormat("es-ES",{timeZone:zone,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const local = new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",hourCycle:"h23"});
const names = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const number = x => new Intl.NumberFormat("es-ES",{maximumFractionDigits:0}).format(x);
const avg = a => a.reduce((s,n)=>s+n,0)/a.length;
const info = date => {const p=Object.fromEntries(local.formatToParts(date).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));return {day:p.year+"-"+p.month+"-"+p.day,weekday:(["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday)+6)%7,hour:Number(p.hour)};};
let data=[], period=1, chart=null, selectedMonth=null, monthLoading=false, monthError=null;
const archivedMonths=new Set(), archivedData=new Map();
const monthKey = date => info(date).day.slice(0,7);

function parse(csv) {
 const lines=csv.replace(/^\uFEFF/,"").trim().split(/\r?\n/);
 if(lines[0]!=="timestamp,people")throw Error("Formato CSV incorrecto");
 const seen=new Set();
 return lines.slice(1).map(line=>{
  const m=line.match(/^([^,]+),(\d+)$/);if(!m)return null;
  const time=new Date(m[1]),people=Number(m[2]);
  if(!Number.isFinite(time.getTime())||!Number.isSafeInteger(people)||seen.has(time.getTime()))return null;
  seen.add(time.getTime());return {time,people};
 }).filter(Boolean).sort((a,b)=>a.time-b.time);
}
function status(message,state){$("statusText").textContent=message;$("status").dataset.state=state;}
function metrics(){
 $("totalReadings").textContent=number(data.length);
 if(!data.length){status("Sin datos","warning");$("lastUpdate").textContent="Esperando primeras lecturas";return;}
 const now=new Date(), last=data.at(-1), minutes=Math.max(0,Math.floor((now-last.time)/60000));
 $("currentCount").textContent=number(last.people);$("lastUpdate").textContent="Última lectura: "+format.format(last.time);
 $("ageHint").textContent=minutes<60?"Hace "+minutes+" min":"Hace "+Math.floor(minutes/60)+" h "+minutes%60+" min";
 $("footerStamp").textContent="Último registro: "+format.format(last.time);
 status(minutes<20?"Datos recientes":"Datos desactualizados",minutes<20?"ok":"warning");
 const seven=data.filter(x=>x.time>=new Date(now-7*86400000));
 if(seven.length){$("avg7").textContent=number(Math.round(avg(seven.map(x=>x.people))));$("avg7Note").textContent="Personas por lectura";}
 const today=info(now).day, samples=data.filter(x=>info(x.time).day===today);
 if(samples.length){
  const hi=samples.reduce((a,b)=>a.people>=b.people?a:b),lo=samples.reduce((a,b)=>a.people<=b.people?a:b);
  $("maxToday").textContent=number(hi.people);$("minToday").textContent=number(lo.people);
  $("maxTodayNote").textContent=format.format(hi.time);$("minTodayNote").textContent=format.format(lo.time);
 }
 $("totalNote").textContent=new Set(data.map(x=>info(x.time).day)).size+" días con registros";
}
function trend(){
 if(chart){chart.destroy();chart=null;}
 const empty=$("chartEmpty"), now=new Date(), today=info(now).day;
 if(selectedMonth && (monthLoading || monthError)){
  $("trendChart").hidden=true;empty.hidden=false;
  empty.textContent=monthLoading?"Cargando histórico mensual…":monthError;
  $("chartCount").textContent="";
  return;
 }
 const selected=selectedMonth
  ? (archivedData.get(selectedMonth)||data).filter(x=>monthKey(x.time)===selectedMonth)
  : data.filter(x=>period===1?info(x.time).day===today:x.time>=new Date(now-period*86400000));
 $("chartCount").textContent=number(selected.length)+" lecturas";
 if(!selected.length||typeof Chart==="undefined"){
  $("trendChart").hidden=true;empty.hidden=false;
  empty.textContent=!selected.length?"No hay datos para este periodo.":"No se pudo cargar la biblioteca de gráficos.";
  return;
 }
 $("trendChart").hidden=false;empty.hidden=true;
 chart=new Chart($("trendChart"),{
  type:"line",
  data:{datasets:[{label:"Personas",data:selected.map(x=>({x:x.time.getTime(),y:x.people})),parsing:false,borderColor:"#3665db",backgroundColor:"rgba(54,101,219,.10)",borderWidth:2,pointRadius:selected.length>80?0:2,fill:true,tension:.2}]},
  options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>format.format(new Date(items[0].parsed.x)),label:item=>number(item.parsed.y)+" personas"}}},scales:{x:{type:"linear",grid:{display:false},ticks:{maxTicksLimit:7,callback:value=>new Intl.DateTimeFormat("es-ES",{timeZone:zone,...(!selectedMonth&&period===1?{hour:"2-digit",minute:"2-digit"}:{day:"2-digit",month:"2-digit"})}).format(new Date(value))}},y:{beginAtZero:true,ticks:{precision:0}}}}
 });
}
function heat(){
 const buckets=Array.from({length:7},()=>Array.from({length:18},()=>new Map()));
 for(const x of data){const k=info(x.time);if(k.hour<6||k.hour>23)continue;const slot=buckets[k.weekday][k.hour-6],vals=slot.get(k.day)||[];vals.push(x.people);slot.set(k.day,vals);}
 const grid=buckets.map(day=>day.map(slot=>({days:slot.size,mean:slot.size?avg([...slot.values()].map(avg)):null})));
 const values=grid.flat().filter(x=>x.mean!==null).map(x=>x.mean),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0;
 const target=$("heatmap");target.replaceChildren();
 function cell(text,cls,title){const el=document.createElement("div");el.className=cls;el.textContent=text;if(title){el.title=title;el.setAttribute("aria-label",title);}target.append(el);}
 cell("Día","heat-header heat-day");for(let hour=6;hour<=23;hour++)cell(String(hour).padStart(2,"0"),"heat-header");
 for(let d=0;d<7;d++){cell(names[d].slice(0,3),"heat-day");for(let h=0;h<18;h++){const c=grid[d][h],level=c.mean===null?0:max===min?3:Math.min(5,1+Math.floor((c.mean-min)/(max-min)*4.999));cell(c.mean===null?"·":number(Math.round(c.mean)),"heat-cell heat-"+level,names[d]+" "+(h+6)+":00 · "+(c.mean===null?"Sin datos":number(Math.round(c.mean))+" personas de media, "+c.days+" días"));}}
 $("heatmapCaption").textContent=values.length?"Color relativo al histórico disponible.":"Se irá completando cuando haya más registros.";
 const rec=$("recommendations");rec.replaceChildren();const best=grid.flatMap((day,d)=>day.map((x,h)=>({...x,d,h:h+6}))).filter(x=>x.days>=3).sort((a,b)=>a.mean-b.mean).slice(0,3);
 if(!best.length){const p=document.createElement("p");p.className="muted-copy";p.textContent="Se necesitan al menos tres días de datos por franja para identificar patrones.";rec.append(p);}
 for(const x of best){const e=document.createElement("article");e.className="recommendation";for(const [tag,text] of [["strong",names[x.d]+" · "+String(x.h).padStart(2,"0")+":00"],["span",number(Math.round(x.mean))+" personas de media"],["small",x.days+" días analizados"]]){const n=document.createElement(tag);n.textContent=text;e.append(n);}rec.append(e);}
}
// El histórico mensual se lee solo cuando se selecciona ese mes.
// El panel de tiempo real conserva únicamente los últimos 60 días en memoria.
function updateMonthOptions(){
 const select=$("monthSelect");
 const available=new Set([...archivedMonths, ...data.map(x=>monthKey(x.time))]);
 const months=[...available].sort().reverse();
 select.replaceChildren(new Option("Elegir mes", ""));
 const monthLabel=new Intl.DateTimeFormat("es-ES",{timeZone:"UTC",month:"long",year:"numeric"});
 for(const month of months){
  const label=monthLabel.format(new Date(month+"-15T12:00:00Z"));
  select.add(new Option(label.charAt(0).toUpperCase()+label.slice(1), month));
 }
 select.value=selectedMonth||"";
}
async function refreshArchiveIndex(){
 try{
  const response=await fetch("data/archivo/index.json?t="+Date.now(),{cache:"no-store"});
  if(!response.ok) return;
  const index=await response.json();
  if(!Array.isArray(index.months)) return;
  archivedMonths.clear();
  for(const month of index.months){
   if(/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) archivedMonths.add(month);
  }
  updateMonthOptions();
 }catch(error){ /* Si falla el índice, el panel reciente sigue disponible. */ }
}
async function showMonth(month){
 selectedMonth=month||null;monthError=null;monthLoading=false;
 if(!selectedMonth){trend();return;}
 if(!archivedMonths.has(month)||archivedData.has(month)){trend();return;}
 monthLoading=true;trend();
 try{
  const response=await fetch("data/archivo/"+month+".csv?t="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw Error("No se pudo cargar el archivo de "+month);
  const csv=await response.text();
  const parsed=parse(csv);
  if(selectedMonth!==month)return;
  archivedData.set(month,parsed);
  monthError=null;
 }catch(error){if(selectedMonth===month)monthError="No se pudo consultar este mes. Inténtalo de nuevo.";}
 finally{if(selectedMonth===month){monthLoading=false;trend();}}
}
document.querySelectorAll("[data-days]").forEach(b=>b.addEventListener("click",()=>{
 period=Number(b.dataset.days);selectedMonth=null;monthLoading=false;monthError=null;
 $("monthSelect").value="";
 document.querySelectorAll("[data-days]").forEach(x=>{const selected=x===b;x.classList.toggle("selected",selected);x.setAttribute("aria-pressed",String(selected));});
 trend();
}));
$("monthSelect").addEventListener("change",event=>{
 const month=event.target.value;
 document.querySelectorAll("[data-days]").forEach(x=>{x.classList.remove("selected");x.setAttribute("aria-pressed","false");});
 if(!month){
  const todayButton=document.querySelector('[data-days="1"]');
  todayButton.classList.add("selected");todayButton.setAttribute("aria-pressed","true");
 }
 showMonth(month);
});
// Refresca el CSV sin recargar la página y actualiza la edad de los datos cada minuto.
let lastCsv = null;
async function refresh() {
 try {
  const response = await fetch("data/ocupacion.csv?t="+Date.now(), {cache:"no-store"});
  if (!response.ok) throw Error("No se pudieron cargar los datos");
  const csv = await response.text();
  if (csv !== lastCsv) {
   const next = parse(csv);
   data = next;
   lastCsv = csv;
   updateMonthOptions();
   metrics();
   trend();
   heat();
  } else {
   metrics();
  }
 } catch (error) {
  if (lastCsv === null) {
   $("lastUpdate").textContent = error.message;
   $("chartEmpty").hidden = false;
   $("chartEmpty").textContent = error.message;
   $("trendChart").hidden = true;
   heat();
  }
  status("Error al consultar datos", "warning");
  $("ageHint").textContent = "No se ha podido verificar una nueva actualización.";
 }
}
refresh();
refreshArchiveIndex();
setInterval(refresh, 60000);
setInterval(refreshArchiveIndex, 300000);
})();
