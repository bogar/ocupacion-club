'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../assets/desglose-model.js');
const mk=(timestamp,props={})=>({timestamp,...props});
const raw=time=>({time:new Date(time),people:100});
const fakeInfo=date=>({day:date.toISOString().slice(0,10),hour:date.getUTCHours()});
test('acepta solo agregados por categoria, sin identificadores privados',()=>{
 const obj={version:1,metric:'estimated_people_by_category',
  points:[mk('2026-11-20T14:00:00.000Z',{directed:20,tennis:null,squash:0,fronton:0})]};
 assert.equal(model.parse(obj).length,1);
 assert.equal(model.parse({...obj,points:[{...obj.points[0],instructor:'DOCENTE'}]}),null);
 assert.equal(model.parse({...obj,points:[{...obj.points[0],session_id:'24528991'}]}),null);
 assert.equal(model.parse({...obj,metric:'attendees'}),null);
});
test('no publica cifras exactas de 1 a 4 personas en un grupo',()=>{
 const obj={version:1,metric:'estimated_people_by_category',
  points:[mk('2026-11-20T14:00:00.000Z',{directed:3,squash:5})]};
 const result=model.parse(obj);
 assert.equal(result[0].directed,null);
 assert.equal(result[0].squash,5);
});
test('apila solo datos conocidos y conserva resto sin atribuir',()=>{
 const time='2026-11-20T14:00:00.000Z';
 const points=model.parse({version:1,metric:'estimated_people_by_category',
  points:[mk(time,{directed:20,tennis:null,squash:5,fronton:null})]});
 const summary=[{x:Date.parse(time),mean:100,label:'14:00',count:1}];
 const data=model.build(summary,[raw(time)],'raw',points,fakeInfo);
 assert.equal(data.available,true);
 assert.equal(data.series.directed[0].y,20);
 assert.equal(data.series.tennis[0].y,null);
 assert.equal(data.series.squash[0].y,5);
 assert.equal(data.series.unattributed[0].y,75);
});
test('no apila estimaciones que superen personas medidas',()=>{
 const time='2026-11-20T14:00:00.000Z';
 const points=model.parse({version:1,metric:'estimated_people_by_category',
  points:[mk(time,{directed:95,tennis:20,squash:null,fronton:null})]});
 const summary=[{x:Date.parse(time),mean:100,label:'14:00',count:1}];
 const data=model.build(summary,[raw(time)],'raw',points,fakeInfo);
 assert.equal(data.available,false);
 assert.equal(data.series.unattributed[0].y,null);
});
test('no extrapola una lectura puntual al promedio de toda una hora',()=>{
 const a='2026-11-20T14:00:00.000Z',b='2026-11-20T14:15:00.000Z';
 const points=model.parse({version:1,metric:'estimated_people_by_category',
  points:[mk(a,{directed:20})]});
 const summary=[{x:Date.parse(a),mean:100,label:'14 h',count:2}];
 const data=model.build(summary,[raw(a),raw(b)],'hour',points,fakeInfo);
 assert.equal(data.available,false);
});
test('solo empareja lecturas proximas, nunca datos de otro dia',()=>{
 const time=Date.parse('2026-11-20T14:00:00.000Z');
 const points=model.parse({version:1,metric:'estimated_people_by_category',
  points:[mk('2026-11-19T14:00:00.000Z',{directed:20})]});
 assert.equal(model.nearest(points,time),null);
});

test('la serie pública real de 15 minutos se alinea con muestras de 5 minutos',()=>{
 const point='2026-11-20T13:37:30.000Z';
 const data=model.parse({version:1,metric:'estimated_people_by_category',
  points:[mk(point,{directed:15,tennis:null,squash:null,fronton:null})]});
 const times=['2026-11-20T13:35:00.000Z','2026-11-20T13:40:00.000Z',
  '2026-11-20T13:45:00.000Z'];
 const readings=times.map(time=>({time:new Date(time),people:100}));
 const summary=readings.map(({time,people})=>({
  x:time.getTime(),mean:people,max:people,count:1,label:time.toISOString()
 }));
 const result=model.build(summary,readings,'raw',data,fakeInfo);
 assert.equal(result.coverage,3);
 assert.deepEqual(result.series.directed.map(p=>p.y),[15,15,15]);
 assert.deepEqual(result.series.tennis.map(p=>p.y),[null,null,null]);
 assert.deepEqual(result.series.unattributed.map(p=>p.y),[85,85,85]);
});
