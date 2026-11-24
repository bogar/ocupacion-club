/* Huecos de datos medidos: nunca interpolar ni crear lecturas para estadísticas. */
(function(root,factory){
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 if(root)root.OcupacionHuecos=value;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const minute=60000;
 const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 function night(ms){
  const [h,m]=clock.format(new Date(ms)).split(':').map(Number);
  return h*60+m>=23*60||h*60+m<=5*60+30;
 }
 function find(summary){
  const gaps=[];
  for(let i=1;i<summary.length;i++){
   const start=summary[i-1].x,end=summary[i].x;
   // La malla nocturna es de 15 min; tolerar desfase normal de captura.
   const limit=night(start)||night(end)?17:15;
   if(Number.isFinite(start)&&Number.isFinite(end)&&end-start>limit*minute)
    gaps.push({start,end,mid:start+(end-start)/2,minutes:Math.round((end-start)/minute)});
  }
  return gaps;
 }
 function breakSeries(points,gaps){
  const breaks=gaps.map(g=>({x:g.mid,y:null,gap:true}));
  return [...points,...breaks].sort((a,b)=>a.x-b.x);
 }
 return {find,breakSeries};
});
