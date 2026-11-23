'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../assets/app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('fuente futura independiente, sin fallback a Pages ni archivo histórico',()=>{
 assert.match(code,/data\/prevision\.json/);
 assert.match(code,/forecastDoc=doc/);
 assert.match(code,/loadForecast\(\)/);
 assert.match(html,/prevision-model\.js/);
 assert.match(html,/forecastInfo/);
});
test('solo se dibuja futuro en el desglose de Hoy',()=>{
 assert.match(code,/breakdownEnabled&&!selectedDay&&!selectedMonth&&period===1/);
 assert.match(code,/borderDash:\[5,5\]/);
 assert.match(code,/stack:'prevision-'/);
 assert.match(code,/spanGaps:false/);
 assert.match(code,/interaction:futureShown\?\{mode:'nearest',axis:'x',intersect:false\}/);
});
test('no se proyecta el total del club ni se apila la previsión con mediciones',()=>{
 const section=code.slice(code.indexOf('const futureEnabled='),code.indexOf(" $('trendChart').hidden=false;"));
 assert.doesNotMatch(section,/Total en el club/);
 assert.match(section,/nowLine/);
 assert.match(section,/availability|disponibilidad/);
 assert.match(code,/forecast:'?true'?/);
});
