'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../assets/app.js'),'utf8');
test('el desglose no retrocede al respaldo de Pages',()=>{
 assert.match(code,/const live=\[[^\n]+data\/desglose\.json/);
 assert.match(code,/fetch\(url,\{cache:'no-store'\}\)/);
});
test('el desglose se refresca mientras está visible y al recuperar el foco',()=>{
 assert.match(code,/if\(!quickMode&&breakdownEnabled&&document\.visibilityState==='visible'\)\s*\{\s*loadBreakdown\(\);loadBreakdownRecent\(\);loadForecast\(\);/);
 assert.match(code,/\},120000\)/);
 assert.match(code,/addEventListener\('visibilitychange'/);
});
test('mantiene datos válidos si falla la consulta',()=>{
 assert.match(code,/if\(!breakdownLoaded\)breakdownPoints=\[\]/);
 assert.match(code,/breakdownCheckedAt=new Date\(\)/);
 assert.match(code,/Datos consultados a las/);
});
