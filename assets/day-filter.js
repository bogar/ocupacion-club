/* Utilidades de fecha del gráfico histórico. Siempre Europe/Madrid. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OcupacionFecha=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const zone='Europe/Madrid';
 const local=new Intl.DateTimeFormat('en-GB',{
  timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'
 });
 const display=new Intl.DateTimeFormat('es-ES',{
  timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'
 });
 function key(date){
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))return null;
  const p=Object.fromEntries(local.formatToParts(date)
   .filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
 }
 function valid(day,today=key(new Date())){
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const date=new Date(day+'T12:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day&&day<=today;
 }
 function label(day){
  if(!valid(day,day))return '';
  const s=display.format(new Date(day+'T12:00:00Z'));
  return s[0].toUpperCase()+s.slice(1);
 }
 return {key,valid,label};
});
