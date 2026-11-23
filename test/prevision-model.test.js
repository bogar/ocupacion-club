'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../assets/prevision-model.js');
const generated='2026-11-23T13:50:00.000Z';
const point=(stamp,other={})=>({
 timestamp:stamp,directed:null,tennis:null,squash:null,fronton:null,...other
});
const valid=()=>({
 version:1,metric:'future_reservation_equivalents',
 generated_at:generated,valid_until:'2026-11-23T14:15:00.000Z',
 horizon_minutes:120,
 points:[point('2026-11-23T14:07:30.000Z',{directed:20,tennis:9}),
         point('2026-11-23T14:22:30.000Z',{directed:20,tennis:null})]
});
test('acepta agregados futuros y conserva ausencias como desconocidas',()=>{
 const d=model.parse(valid());
 assert.equal(d.points.length,2);
 const s=model.series(d,Date.parse('2026-11-23T13:55:00.000Z'));
 assert.deepEqual(s.directed.map(p=>p.y),[20,20]);
 assert.deepEqual(s.tennis.map(p=>p.y),[9,null]);
 assert.equal(s.squash[0].y,null);
});
test('rechaza reservas e identificadores privados y puntos fuera del horizonte',()=>{
 for(const key of ['session_id','room','name','player','source']){
  const d=valid();d.points[0][key]='privado';
  assert.equal(model.parse(d),null);
 }
 const d=valid();d.points[0].timestamp='2026-11-24T14:07:30.000Z';
 assert.equal(model.parse(d),null);
});
test('rechaza cifras imposibles y denominadores sin modelar',()=>{
 for(const [key,val] of [['tennis',16],['tennis',4],['squash',7],
                           ['fronton',3],['directed',2],['directed',1001]]){
  const d=valid();d.points[0][key]=val;
  assert.equal(model.parse(d),null,key+': '+val);
 }
});
test('proyección caduca y nunca rellena puntos futuros con ceros',()=>{
 const d=model.parse(valid());
 assert.equal(model.active(d,Date.parse('2026-11-23T14:16:00.000Z')).length,0);
 assert.equal(model.active(d,Date.parse('2026-11-23T14:10:00.000Z')).length,1);
 assert.equal(model.series(d,Date.parse('2026-11-23T14:10:00.000Z')).tennis[0].y,null);
});
test('rechaza marcas repetidas, documento con caducidad larga o versión distinta',()=>{
 let d=valid();d.points.push({...d.points[0]});
 assert.equal(model.parse(d),null);
 d=valid();d.valid_until='2026-11-23T14:30:00.000Z';
 assert.equal(model.parse(d),null);
 d=valid();d.version=2;
 assert.equal(model.parse(d),null);
});

test('v2 incluye franja en curso y desaparece al cambiar el cuarto de hora',()=>{
 const doc={...valid(),version:2,current:
  point('2026-11-23T13:52:30.000Z',{directed:20,tennis:9,fronton:0})
 };
 const parsed=model.parse(doc);
 assert.ok(parsed);
 const active=model.ongoing(parsed,Date.parse('2026-11-23T13:55:00.000Z'));
 assert.equal(active.start,Date.parse('2026-11-23T13:45:00.000Z'));
 assert.equal(active.values.tennis,9);
 assert.equal(active.values.squash,null);
 // La franja futura conocida ANTES de empezar no desaparece al pasar
 // por el límite de 15 minutos: pasa a representarse como provisional actual.
 const rollover=model.ongoing(parsed,Date.parse('2026-11-23T14:01:00.000Z'));
 assert.equal(rollover.start,Date.parse('2026-11-23T14:00:00.000Z'));
 assert.equal(rollover.values.directed,20);
 assert.equal(model.ongoing(parsed,Date.parse('2026-11-23T14:16:00.000Z')),null);
});
test('v2 rechaza datos privados, valores imposibles y centro de franja incorrecto',()=>{
 const doc={...valid(),version:2,current:
  point('2026-11-23T13:52:30.000Z',{directed:20,tennis:9})};
 for(const key of ['name','room','session_id']){
  const copy={...doc,current:{...doc.current,[key]:'privado'}};
  assert.equal(model.parse(copy),null);
 }
 const wrong={...doc,current:{...doc.current,timestamp:'2026-11-23T14:07:30.000Z'}};
 assert.equal(model.parse(wrong),null);
 const impossible={...doc,current:{...doc.current,tennis:4}};
 assert.equal(model.parse(impossible),null);
 const empty={...doc,current:null};
 assert.equal(model.parse(empty).current,null);
});

test('una franja ya empezada nunca se muestra como previsión futura',()=>{
 const doc=model.parse(valid());
 const now=Date.parse('2026-11-23T14:05:00.000Z');
 const upcoming=model.active(doc,now);
 assert.deepEqual(upcoming.map(p=>new Date(p.ms).toISOString()),
  ['2026-11-23T14:22:30.000Z']);
});

test('líneas temporales abarcan la duración de franjas consecutivas sin inventar huecos',()=>{
 const doc=model.parse(valid());
 const now=Date.parse('2026-11-23T13:55:00.000Z');
 const parts=model.intervals(doc,now);
 assert.deepEqual(parts.directed,[{
  start:Date.parse('2026-11-23T14:00:00.000Z'),
  end:Date.parse('2026-11-23T14:30:00.000Z'),
  value:20,phase:'future'
 }]);
 assert.deepEqual(parts.tennis,[{
  start:Date.parse('2026-11-23T14:00:00.000Z'),
  end:Date.parse('2026-11-23T14:15:00.000Z'),
  value:9,phase:'future'
 }]);
 assert.deepEqual(parts.squash,[]);
});

test('franja recién iniciada conserva la previsión previa pero no reescribe el pasado',()=>{
 const doc=model.parse(valid());
 const now=Date.parse('2026-11-23T14:05:00.000Z');
 const current=model.intervals(doc,now);
 assert.deepEqual(current.directed,[{
  start:now,end:Date.parse('2026-11-23T14:15:00.000Z'),
  value:20,phase:'current'
 },{
  start:Date.parse('2026-11-23T14:15:00.000Z'),
  end:Date.parse('2026-11-23T14:30:00.000Z'),
  value:20,phase:'future'
 }]);
 // Captura generada DESPUÉS del inicio: no puede justificar retrospectivamente
 // un cuarto ya empezado que no tenga observación previa.
 const bad={...valid(),generated_at:'2026-11-23T14:05:00.000Z',
  valid_until:'2026-11-23T14:15:00.000Z'};
 const parsed=model.parse(bad);
 assert.equal(model.ongoing(parsed,now),null);
});

test('las franjas desconocidas se cortan y un cero verificado no se trata como desconocido',()=>{
 const doc=valid();
 doc.points=[
  point('2026-11-23T14:07:30.000Z',{fronton:0}),
  point('2026-11-23T14:22:30.000Z',{fronton:null}),
  point('2026-11-23T14:37:30.000Z',{fronton:4})
 ];
 const parsed=model.parse(doc),now=Date.parse('2026-11-23T13:55:00.000Z');
 const values=model.intervals(parsed,now).fronton;
 assert.equal(values.length,2);
 assert.equal(values[0].value,0);
 assert.equal(values[0].end,Date.parse('2026-11-23T14:15:00.000Z'));
 assert.equal(values[1].start,Date.parse('2026-11-23T14:30:00.000Z'));
});
