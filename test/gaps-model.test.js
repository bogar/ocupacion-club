'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../assets/gaps-model');
const fs=require('node:fs');
const path=require('node:path');
const points=(...times)=>times.map((s,i)=>({x:Date.parse('2026-11-24T'+s+'Z'),y:i+100}));
test('incidencia real: hueco de 75 min no se interpola en ninguna serie',()=>{
 const rows=points('12:10:21','12:15:11','13:30:12','13:35:30');
 const gaps=model.find(rows);
 assert.equal(gaps.length,1);
 assert.equal(gaps[0].minutes,75);
 const result=model.breakSeries(rows,gaps);
 assert.equal(result.length,5);
 assert.deepEqual(result[2],{x:gaps[0].mid,y:null,gap:true});
 assert.equal(rows.length,4);
 assert.deepEqual(result.filter(p=>!p.gap),rows);
});
test('malla nocturna con desfase normal no se confunde con incidencia',()=>{
 assert.deepEqual(model.find(points('03:00:05','03:15:35','03:30:08')),[]);
 assert.equal(model.find(points('03:00:05','03:30:08')).length,1);
});
test('día: 15 min exactos se conservan, un hueco mayor se interrumpe',()=>{
 assert.deepEqual(model.find(points('12:00:00','12:15:00')),[]);
 assert.equal(model.find(points('12:00:00','12:15:01')).length,1);
 assert.deepEqual(model.find([]),[]);
});
test('la integración rompe las series históricas antes de añadir la previsión',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../assets/app.js'),'utf8');
 assert.match(code,/granularity==='raw'&&window\.OcupacionHuecos/);
 assert.ok(code.indexOf('OcupacionHuecos.breakSeries')<code.indexOf('const futureEnabled='));
 assert.match(code,/dataset.spanGaps=false/);
 assert.match(code,/Sin cobertura continua/);
});
