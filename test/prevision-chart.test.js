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
 assert.match(code,/interaction:\(futureShown\|\|ongoingShown\)\?\{mode:'nearest',axis:'x',intersect:false\}/);
});
test('no se proyecta el total del club ni se apila la previsión con mediciones',()=>{
 const section=code.slice(code.indexOf('const futureEnabled='),code.indexOf(" $('trendChart').hidden=false;"));
 assert.doesNotMatch(section,/Total en el club/);
 assert.match(section,/nowLine/);
 assert.match(section,/availability|disponibilidad/);
 assert.match(code,/forecast:'?true'?/);
});

test('solo Hoy mezcla el desglose reciente con el histórico y respeta caducidad',()=>{
 assert.match(code,/data\/desglose-reciente\.json/);
 assert.match(code,/function effectiveBreakdown\(\)/);
 assert.match(code,/Date\.now\(\)>breakdownRecentExpiry/);
 assert.match(code,/for\(const point of breakdownRecentPoints\)\{/);
 assert.match(code,/merged\[key\]=consolidated\[key\]/);
 assert.match(code,/const layered=window\.OcupacionDesglose\.build\(summary,rows,granularity,effectivePoints,info\)/);
});

test('franja actual es una línea continua sin puntos y se separa del total medido',()=>{
 assert.match(code,/window\.OcupacionPrevision\.ongoing\(forecastDoc,nowMs\)/);
 assert.match(code,/label:label\+' \(franja actual\)'/);
 assert.match(code,/pointRadius:0,pointHoverRadius:0/);
 assert.match(code,/stack:'franja-actual-'\+key/);
 assert.match(code,/borderDash:\[5,5\]/);
 assert.match(code,/!futureShown&&!ongoingShown/);
});

test('las franjas próximas se muestran como intervalos completos en un zoom separado',()=>{
 assert.match(html,/id="forecastTimeline"/);
 assert.match(html,/id="forecastTimelineAxis"/);
 assert.match(html,/id="forecastTimelineRows"/);
 assert.match(code,/OcupacionPrevision\.intervals\(forecastDoc,nowMs\)/);
 assert.match(code,/renderForecastTimeline\(futureEnabled,forecastDoc,nowMs,futureStyles\)/);
 assert.match(code,/segment\.start,y:segment\.value/);
 assert.match(code,/segment\.end,y:segment\.value/);
 assert.match(code,/part\.phase==='current'/);
 assert.match(code,/Sin datos verificables/);
});

test('la leyenda agrupa los segmentos por categoría y conmuta todos juntos',()=>{
 assert.match(code,/const legendKey=label=>label.replace/);
 assert.match(code,/if\(seen.has\(key\)\)return false/);
 assert.match(code,/chart.setDatasetVisibility\(index,!visible\)/);
});
