'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const heatmap=require('../assets/heatmap-model.js');

test('días naturales: hoy, ayer y siete días con fechas peninsulares',()=>{
 assert.deepEqual(heatmap.dates('hoy','2026-11-23'),['2026-11-23']);
 assert.deepEqual(heatmap.dates('ayer','2026-11-23'),['2026-11-22']);
 assert.deepEqual(heatmap.dates('siete','2026-11-23'),[
  '2026-11-17','2026-11-18','2026-11-19','2026-11-20',
  '2026-11-21','2026-11-22','2026-11-23'
 ]);
});

test('desplazamiento de fechas seguro en cambios de mes, año y horario',()=>{
 assert.equal(heatmap.offsetDay('2026-03-29',-1),'2026-03-28');
 assert.equal(heatmap.offsetDay('2026-10-25',1),'2026-10-26');
 assert.equal(heatmap.offsetDay('2027-01-01',-1),'2026-12-31');
 assert.equal(heatmap.weekday('2026-11-22'),6);
 assert.equal(heatmap.weekday('2026-11-23'),0);
});

test('cada día tiene una fila: cero medido no significa hora sin datos',()=>{
 const info=time=>time;
 const rows=[
  {time:{day:'2026-11-22',hour:6,weekday:6},people:0},
  {time:{day:'2026-11-22',hour:6,weekday:6},people:4},
  {time:{day:'2026-11-23',hour:6,weekday:0},people:100},
  {time:{day:'2026-11-22',hour:5,weekday:6},people:300}
 ];
 const grid=heatmap.dailyBuckets(rows,['2026-11-22','2026-11-23'],info);
 assert.deepEqual(grid[0][0],{mean:2,days:1});
 assert.deepEqual(grid[0][1],{mean:null,days:0});
 assert.deepEqual(grid[1][0],{mean:100,days:1});
 assert.equal(grid[0].length,18);
 assert.equal(grid.length,2);
 assert.deepEqual(heatmap.dailyBuckets([rows[0]],['2026-11-22'],info)[0][0],
  {mean:0,days:1});
});

test('otros lunes: excluye hoy, otros días y registros fuera de ocho semanas',()=>{
 const info=time=>time;
 const today={day:'2026-11-23',weekday:0};
 const limit=heatmap.offsetDay(today.day,-56);
 const rows=[
  {time:{day:'2026-11-16',weekday:0,hour:9},people:10},
  {time:{day:limit,weekday:0,hour:9},people:11},
  {time:{day:'2026-11-23',weekday:0,hour:9},people:12},
  {time:{day:'2026-11-22',weekday:6,hour:9},people:13},
  {time:{day:heatmap.offsetDay(limit,-7),weekday:0,hour:9},people:14}
 ];
 assert.deepEqual(heatmap.comparableRows(rows,today,info).map(row=>row.people),[10,11]);
});
