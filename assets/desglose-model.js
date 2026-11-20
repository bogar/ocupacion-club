/* Modelo seguro para desglose estimado, sin datos privados ni dependencias. */
(function(root,factory){
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 if(root)root.OcupacionDesglose=value;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const categories=['directed','tennis','squash','fronton'];
 const aliases={directed:'Actividades dirigidas',tennis:'Tenis',squash:'Esquaix',fronton:'Frontón'};
 const MAX_POINTS=18000;
 const TOLERANCE_MS=8*60*1000;
 function parse(input){
  if(!input||input.version!==1||input.metric!=='estimated_people_by_category'||
    !Array.isArray(input.points)||input.points.length>MAX_POINTS)return null;
  const points=[],seen=new Set();
  for(const item of input.points){
   if(!item||typeof item!=='object'||Array.isArray(item))return null;
   if(Object.keys(item).some(k=>k!=='timestamp'&&!categories.includes(k)))return null;
   if(typeof item.timestamp!=='string')return null;
   const ms=Date.parse(item.timestamp);
   if(!Number.isFinite(ms)||new Date(ms).toISOString()!==item.timestamp||seen.has(ms))return null;
   seen.add(ms);
   const entry={ms};
   for(const key of categories){
    const v=item[key];
    if(v===undefined||v===null){entry[key]=null;continue;}
    // No se publican recuentos exactos de grupos pequeños. Estos datos
    // deben agregarse y validarse previamente en el exportador privado.
    if(!Number.isSafeInteger(v)||v<0||v>1000)return null;
    entry[key]=v>0&&v<5?null:v;
   }
   points.push(entry);
  }
  points.sort((a,b)=>a.ms-b.ms);
  return points;
 }
 function nearest(points,ms){
  let a=0,b=points.length;
  while(a<b){const mid=(a+b)>>1;if(points[mid].ms<ms)a=mid+1;else b=mid;}
  const before=a>0?points[a-1]:null,after=a<points.length?points[a]:null;
  const best=before&&after?
    (ms-before.ms<=after.ms-ms?before:after):(before||after);
  return best&&Math.abs(best.ms-ms)<=TOLERANCE_MS?best:null;
 }
 function keyFor(time,granularity,getParts){
  if(granularity==='raw')return String(time.getTime());
  const p=getParts(time);
  return granularity==='hour'?p.day+'-'+String(p.hour).padStart(2,'0'):p.day;
 }
 function build(summary,readings,granularity,points,getParts){
  if(!Array.isArray(points)||!points.length)return {available:false,coverage:0,series:[]};
  const groups=new Map();
  for(const row of readings){
   if(!row||!(row.time instanceof Date)||!Number.isSafeInteger(row.people)||row.people<0)continue;
   const key=keyFor(row.time,granularity,getParts);
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(row);
  }
  const data=Object.fromEntries([...categories,'unattributed'].map(k=>[k,[]]));
  let covered=0,missing=0,overlap=0;
  for(const bucket of summary){
   const group=groups.get(keyFor(new Date(bucket.x),granularity,getParts))||[];
   const selected=group.map(r=>({total:r.people,p:nearest(points,r.time.getTime())}));
   const hasSources=selected.length&&selected.some(({p})=>p&&categories.some(k=>p[k]!==null));
   const sums=Object.fromEntries(categories.map(k=>[k,0]));
   let valid=false;
   if(hasSources){
    // Para vistas medias, todas las lecturas deben contar con las mismas
    // categorías conocidas; no extrapolamos los pocos datos existentes.
    const common=categories.filter(k=>selected.every(({p})=>p&&p[k]!==null));
    if(common.length){
     let ok=true;
     for(const s of selected){
      const subtotal=common.reduce((n,k)=>n+s.p[k],0);
      if(subtotal>s.total){ok=false;break;}
      for(const k of common)sums[k]+=s.p[k];
     }
     if(ok){
      for(const k of common)sums[k]=Math.round(sums[k]/selected.length);
      const included=common.reduce((n,k)=>n+sums[k],0);
      if(included<=bucket.mean){
       valid=true;covered++;
      }else overlap++;
     }else overlap++;
    }
   }
   if(!valid)missing++;
   for(const key of categories){
    data[key].push({x:bucket.x,y:valid&&sums[key]!==undefined?
      sums[key]:null,label:bucket.label});
   }
   const used=categories.reduce((sum,k)=>sum+sums[k],0);
   data.unattributed.push({x:bucket.x,y:valid?Math.max(0,bucket.mean-used):null,
    label:bucket.label});
  }
  return {available:covered>0,coverage:covered,total:summary.length,missing,overlap,
   series:data,labels:aliases};
 }
 return {parse,nearest,build,categories,aliases};
});
