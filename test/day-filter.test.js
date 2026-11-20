'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const dates=require('../assets/day-filter.js');

test('usa el día local de Madrid, incluso en cambios de horario',()=>{
 assert.equal(dates.key(new Date('2026-11-20T23:30:00.000Z')),'2026-11-21');
 assert.equal(dates.key(new Date('2026-03-29T00:30:00.000Z')),'2026-03-29');
 assert.equal(dates.key(new Date('2026-03-29T22:30:00.000Z')),'2026-03-30');
 assert.equal(dates.key(new Date('2026-10-25T01:30:00.000Z')),'2026-10-25');
});
test('solo acepta fechas reales no futuras',()=>{
 assert.equal(dates.valid('2026-11-20','2026-11-20'),true);
 assert.equal(dates.valid('2026-11-19','2026-11-20'),true);
 assert.equal(dates.valid('2026-11-21','2026-11-20'),false);
 assert.equal(dates.valid('2026-02-29','2026-11-20'),false);
 assert.equal(dates.valid('2024-02-29','2026-11-20'),true);
 assert.equal(dates.valid('20/11/2026','2026-11-20'),false);
 assert.equal(dates.valid('2026-13-01','2026-11-20'),false);
});
test('etiqueta un día histórico en español sin cambio por huso del equipo',()=>{
 assert.match(dates.label('2026-11-20'),/Viernes, 20 de noviembre de 2026/);
 assert.equal(dates.label('2026-02-30'),'');
});
