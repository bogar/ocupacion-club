'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const archive=require('../assets/desglose-archive');
const model=require('../assets/desglose-model');
const row=(timestamp,value=10)=>({
 timestamp,directed:value,tennis:null,squash:null,fronton:null
});
const doc=points=>({version:2,metric:'estimated_people_by_category',points});

test('valida índice ordenado, sin meses repetidos ni campos extra',()=>{
 assert.deepEqual(archive.parseIndex({months:['2026-10','2026-11']}),['2026-10','2026-11']);
 for(const months of [['2026-11','2026-10'],['2026-10','2026-10'],['2026-13']]){
  assert.equal(archive.parseIndex({months}),null);
 }
 assert.equal(archive.parseIndex({months:[],name:'Centro'}),null);
 assert.equal(archive.parseIndex({months:'2026-11'}),null);
});

test('clasifica por mes de Madrid, no por subcadena del UTC',()=>{
 assert.equal(archive.monthAt(Date.parse('2026-10-31T23:07:30.000Z')),'2026-11');
 assert.equal(archive.monthAt(Date.parse('2026-10-25T00:07:30.000Z')),'2026-10');
 assert.equal(archive.monthAt(Date.parse('2026-12-31T23:07:30.000Z')),'2027-01');
});

test('rechaza archivos con fechas de otro mes, identificadores o puntos falsos',()=>{
 const valid=doc([row('2026-10-31T23:07:30.000Z')]);
 assert.equal(archive.parseMonth(valid,'2026-11',model).length,1);
 assert.equal(archive.parseMonth(valid,'2026-10',model),null);
 assert.equal(archive.parseMonth(doc([{...valid.points[0],room:'Sala'}]),'2026-11',model),null);
 assert.equal(archive.parseMonth(doc([row('2026-11-01T00:00:00.000Z')]),'2026-11',model),null);
});

test('combina solapamiento sin perder categorías ni duplicar timestamps',()=>{
 const ms=Date.parse('2026-11-20T13:37:30.000Z');
 const stored={ms,quarter:true,directed:10,tennis:3,squash:null,fronton:null};
 const recent={ms,quarter:true,directed:null,tennis:6,squash:2,fronton:null};
 const merged=archive.combine([recent],[stored]);
 assert.equal(merged.length,1);
 assert.deepEqual(merged[0],{...stored,tennis:6,squash:2});
 assert.deepEqual(archive.combine([recent],merged),merged);
});
