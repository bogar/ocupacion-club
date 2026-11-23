/* Archivos mensuales anónimos del desglose, cargados solo bajo demanda. */
(function(root,factory){
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 if(root)root.OcupacionDesgloseArchivo=value;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const fields=['directed','fronton','squash','tennis','timestamp'];
 const monthFormat=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'
 });
 function monthAt(ms){
  const parts=Object.fromEntries(monthFormat.formatToParts(new Date(ms))
   .filter(part=>part.type==='year'||part.type==='month')
   .map(part=>[part.type,part.value]));
  return parts.year+'-'+parts.month;
 }
 function parseIndex(doc){
  if(!doc||typeof doc!=='object'||Array.isArray(doc)||
     Object.keys(doc).join(',')!=='months'||!Array.isArray(doc.months))return null;
  const months=doc.months;
  if(months.some((month,index)=>typeof month!=='string'||
     !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||
     (index>0&&months[index-1]>=month)))return null;
  return months;
 }
 function parseMonth(doc,month,model){
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||
     !doc||typeof doc!=='object'||Array.isArray(doc)||
     Object.keys(doc).sort().join(',')!=='metric,points,version'||
     !Array.isArray(doc.points)||!model||typeof model.parse!=='function')
   return null;
  for(const point of doc.points){
   if(!point||typeof point!=='object'||Array.isArray(point)||
      Object.keys(point).sort().join(',')!==fields.join(','))return null;
  }
  const parsed=model.parse(doc);
  if(!parsed||parsed.some(point=>monthAt(point.ms)!==month))return null;
  return parsed;
 }
 function combine(recent,archive){
  const rows=new Map();
  for(const points of [archive,recent]){
   if(!Array.isArray(points))continue;
   for(const point of points){
    const old=rows.get(point.ms)||{};
    const merged={...old,...point};
    for(const field of fields.slice(0,4)){
     if(point[field]===null&&old[field]!==undefined)merged[field]=old[field];
    }
    rows.set(point.ms,merged);
   }
  }
  return [...rows.values()].sort((a,b)=>a.ms-b.ms);
 }
 return {monthAt,parseIndex,parseMonth,combine};
});
