/* Utilidades puras para los filtros del mapa de calor (fechas locales ya calculadas por app.js). */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OcupacionHeatmap=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function offsetDay(day,offset){
  const value=new Date(day+'T12:00:00Z');
  if(!Number.isFinite(value.getTime()))throw Error('Fecha inválida');
  value.setUTCDate(value.getUTCDate()+offset);
  return value.toISOString().slice(0,10);
 }
 function weekday(day){
  return (new Date(day+'T12:00:00Z').getUTCDay()+6)%7;
 }
 function dates(mode,today){
  if(mode==='hoy')return [today];
  if(mode==='ayer')return [offsetDay(today,-1)];
  if(mode==='siete')return Array.from({length:7},(_,index)=>offsetDay(today,index-6));
  return [];
 }
 // Horas 06:00-23:00. Se distingue expresamente cero observado de falta de lecturas.
 function dailyBuckets(rows,keys,getInfo){
  const daily=new Map(keys.map(key=>[key,Array.from({length:18},()=>({sum:0,count:0}))]));
  for(const row of rows){
   const part=getInfo(row.time),hours=daily.get(part.day);
   if(!hours||part.hour<6||part.hour>23)continue;
   const slot=hours[part.hour-6];
   slot.sum+=row.people;slot.count++;
  }
  return keys.map(key=>daily.get(key).map(slot=>({
   mean:slot.count?slot.sum/slot.count:null,
   days:slot.count?1:0
  })));
 }
 // Lunes anteriores con lunes, martes con martes, etc. El día actual nunca se incluye.
 function comparableRows(rows,today,getInfo){
  const earliest=offsetDay(today.day,-56);
  return rows.filter(row=>{
   const part=getInfo(row.time);
   return part.weekday===today.weekday&&part.day<today.day&&part.day>=earliest;
  });
 }
 return {offsetDay,weekday,dates,dailyBuckets,comparableRows};
});
