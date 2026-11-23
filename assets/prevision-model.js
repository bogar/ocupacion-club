/* Previsión pública, independiente del histórico y del aforo medido. */
(function(root,factory){
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.OcupacionPrevision=model;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const fields=['directed','tennis','squash','fronton'];
 const factors={directed:5,tennis:3,squash:2,fronton:4};
 const limits={directed:1000,tennis:15,squash:6,fronton:4};
 const STEP=15*60*1000;
 const HORIZON=120*60*1000;
 const MAX_AGE=30*60*1000;
 function isoMs(value){
  if(typeof value!=='string')return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)&&new Date(ms).toISOString()===value?ms:null;
 }
 function parse(doc){
  if(!doc||typeof doc!=='object'||Array.isArray(doc)||
    ![1,2].includes(doc.version)||
    Object.keys(doc).sort().join(',')!==
      (doc.version===2?
       'current,generated_at,horizon_minutes,metric,points,valid_until,version':
       'generated_at,horizon_minutes,metric,points,valid_until,version')||
    doc.metric!=='future_reservation_equivalents'||
    doc.horizon_minutes!==120||!Array.isArray(doc.points)||doc.points.length>9)return null;
  const generated=isoMs(doc.generated_at),until=isoMs(doc.valid_until);
  if(generated===null||until===null||until<=generated||until-generated>MAX_AGE)return null;
  let current=null;
  if(doc.version===2&&doc.current!==null){
   const slot=doc.current;
   if(!slot||typeof slot!=='object'||Array.isArray(slot)||
     Object.keys(slot).sort().join(',')!=='directed,fronton,squash,tennis,timestamp')return null;
   const ms=isoMs(slot.timestamp);
   const center=Math.floor(generated/STEP)*STEP+STEP/2;
   if(ms===null||ms!==center)return null;
   current={ms};
   for(const key of fields){
    const v=slot[key];
    if(v!==null&&(!Number.isSafeInteger(v)||v<0||v>limits[key]||
      (v!==0&&v%factors[key]!==0)))return null;
    current[key]=v;
   }
   if(fields.every(key=>current[key]===null))return null;
  }
  const points=[],seen=new Set();
  for(const point of doc.points){
   if(!point||typeof point!=='object'||Array.isArray(point)||
     Object.keys(point).sort().join(',')!=='directed,fronton,squash,tennis,timestamp')return null;
   const ms=isoMs(point.timestamp);
   if(ms===null||ms%STEP!==STEP/2||seen.has(ms)||
     ms<generated-STEP||ms>generated+HORIZON||points.length>=9)return null;
   seen.add(ms);
   const entry={ms};
   for(const key of fields){
    const v=point[key];
    if(v!==null&&(!Number.isSafeInteger(v)||v<0||v>limits[key]||
      (v!==0&&v%factors[key]!==0)||(key==='directed'&&v>0&&v<5)))return null;
    entry[key]=v;
   }
   points.push(entry);
  }
  points.sort((a,b)=>a.ms-b.ms);
  return {generated,until,points,current};
 }
 function active(doc,now=Date.now()){
  if(!doc||!Number.isFinite(now)||now<doc.generated-60000||now>doc.until)return [];
  return doc.points.filter(p=>p.ms>now&&p.ms<=now+HORIZON);
 }
 function ongoing(doc,now=Date.now()){
  if(!doc||!Number.isFinite(now)||now<doc.generated-60000||now>doc.until||
    !doc.current)return null;
  const start=Math.floor(now/STEP)*STEP;
  if(doc.current.ms!==start+STEP/2)return null;
  return {start,now,values:doc.current};
 }
 function series(doc,now=Date.now()){
  const points=active(doc,now);
  return Object.fromEntries(fields.map(key=>[key,
   points.map(p=>({x:p.ms,y:p[key],forecast:true}))
  ]));
 }
 return {parse,active,series,ongoing,fields};
});
