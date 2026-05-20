/**
 * diagnostico_evm.cjs
 * Diagnóstico integral: analiza la coherencia de todas las bases de datos
 * para identificar exactamente qué está fallando en el motor EVM.
 */
'use strict';
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

const sep = (t) => console.log(`\n${'═'.repeat(60)}\n  ${t}\n${'═'.repeat(60)}`);
const ok  = (t) => console.log(`  ✅ ${t}`);
const err = (t) => console.log(`  ❌ ${t}`);
const warn= (t) => console.log(`  ⚠️  ${t}`);
const inf = (t) => console.log(`  ℹ️  ${t}`);

// ─── 1. BD_EDT.xlsx ──────────────────────────────────────────────────────────
sep('1. ANÁLISIS DE BD_EDT.xlsx');
const wbEdt  = XLSX.readFile(path.join(ROOT, 'BD_EDT.xlsx'));
const edtRaw = XLSX.utils.sheet_to_json(wbEdt.Sheets['Sheet1'], { defval: '' });

const edtCols = edtRaw.length > 0 ? Object.keys(edtRaw[0]) : [];
console.log('  Columnas disponibles:', edtCols);

const colsRequeridas = ['edt_id','edt_nombre','actividad_id','actividad_nombre',
  'codigo','unidad','presupuesto_total','nivel_wbs','padre_id'];
const colsFaltantes = colsRequeridas.filter(c => !edtCols.includes(c));
if (colsFaltantes.length === 0) ok('Todas las columnas requeridas presentes');
else err(`Columnas FALTANTES: ${colsFaltantes.join(', ')}`);

const tieneMet = edtCols.includes('metrado_total_planificado');
if (tieneMet) ok('Columna metrado_total_planificado PRESENTE');
else warn('Columna metrado_total_planificado AUSENTE → unitPrice = presupuesto_total / 1');

// Verificar presupuesto_total en actividades
const acts = edtRaw.filter(r => r.nivel_wbs === 2);
const actsConBudget = acts.filter(r => (r.presupuesto_total || 0) > 0);
const actsSinBudget = acts.filter(r => (r.presupuesto_total || 0) === 0);
inf(`Actividades nivel 2: ${acts.length} total, ${actsConBudget.length} con presupuesto, ${actsSinBudget.length} sin presupuesto`);

if (actsSinBudget.length > 0) {
  err('Actividades con presupuesto_total = 0 (unitPrice = 0 → EV siempre 0):');
  actsSinBudget.slice(0,5).forEach(r => console.log(`     • ${r.codigo} - ${r.actividad_nombre}`));
}

// Mostrar resumen por capítulo
const caps = edtRaw.filter(r => r.nivel_wbs === 1);
console.log('\n  Resumen por capítulo:');
caps.forEach(cap => {
  const hijos = acts.filter(r => r.padre_id === cap.edt_id);
  const sumBudget = hijos.reduce((s,r) => s + (r.presupuesto_total || 0), 0);
  const sumMet = tieneMet ? hijos.reduce((s,r) => s + (r.metrado_total_planificado || 0), 0) : 'N/A';
  console.log(`     [${cap.codigo}] ${cap.edt_nombre}: ${hijos.length} actividades, S/ ${sumBudget.toLocaleString()} presupuesto`);
});

// ─── 2. BD_Metrados_Planificados.xlsx ────────────────────────────────────────
sep('2. ANÁLISIS DE BD_Metrados_Planificados.xlsx');
const wbMet  = XLSX.readFile(path.join(ROOT, 'BD_Metrados_Planificados.xlsx'));
const metRaw = XLSX.utils.sheet_to_json(wbMet.Sheets['Sheet1'], { defval: '' });

const metCols = metRaw.length > 0 ? Object.keys(metRaw[0]) : [];
console.log('  Columnas:', metCols);

// Verificar mapeo de id_wbs → actividad conocida
const actividadCodigoLookup = {};
edtRaw.filter(r => r.nivel_wbs === 2).forEach(r => {
  actividadCodigoLookup[r.actividad_id] = r.codigo;
});

const metIds = [...new Set(metRaw.map(r => r.id_wbs))];
const noMapeados = metIds.filter(id => !actividadCodigoLookup[id]);
if (noMapeados.length === 0) ok(`Todos los ${metIds.length} id_wbs mapean a un código EDT`);
else err(`${noMapeados.length} id_wbs sin mapeo en BD_EDT: ${noMapeados.slice(0,5).join(', ')}`);

// PV total del proyecto
const pvTotal = metRaw.reduce((s,r) => s + (r.pv_diario || 0), 0);
inf(`PV total del proyecto (suma pv_diario): S/ ${pvTotal.toFixed(2)}`);
inf(`Fechas: ${metRaw[0]?.fecha} → ${metRaw[metRaw.length-1]?.fecha}`);

// ─── 3. PV.xlsx ──────────────────────────────────────────────────────────────
sep('3. ANÁLISIS DE PV.xlsx');
const wbPv = XLSX.readFile(path.join(ROOT, 'PV.xlsx'));
console.log('  Hojas:', wbPv.SheetNames);

const pvGen = XLSX.utils.sheet_to_json(wbPv.Sheets['PV_General'], { defval: '' });
const pvDia = XLSX.utils.sheet_to_json(wbPv.Sheets['PV_Diario'], { defval: '' });
const pvCur = XLSX.utils.sheet_to_json(wbPv.Sheets['PV_CurvaS'], { defval: '' });

inf(`PV_General: ${pvGen.length} actividades | PV_Diario: ${pvDia.length} filas | PV_CurvaS: ${pvCur.length} fechas`);

const pvGenCols = pvGen.length > 0 ? Object.keys(pvGen[0]) : [];
console.log('  Columnas PV_General:', pvGenCols);

// Verificar metrado en PV_General
const pvTieneMetrado = pvGenCols.includes('metrado_total_planificado');
if (pvTieneMetrado) ok('PV_General tiene metrado_total_planificado');
else warn('PV_General NO tiene metrado_total_planificado');

// Verificar ids de actividad en PV vs BD_EDT
const pvActIds = [...new Set(pvGen.map(r => r.actividad_id))];
const pvIds_enEdt = pvActIds.filter(id => actividadCodigoLookup[id]);
const pvIds_sinEdt = pvActIds.filter(id => !actividadCodigoLookup[id]);
inf(`IDs en PV_General: ${pvActIds.length} | mapeados en BD_EDT: ${pvIds_enEdt.length} | sin mapeo: ${pvIds_sinEdt.length}`);
if (pvIds_sinEdt.length > 0) warn(`IDs de PV sin mapeo: ${pvIds_sinEdt.join(', ')}`);

// Verificar coherencia PV_General vs PV_Diario
const pvDiaCols = pvDia.length > 0 ? Object.keys(pvDia[0]) : [];
console.log('  Columnas PV_Diario:', pvDiaCols);
const pvDiaIds = [...new Set(pvDia.map(r => r.actividad_id))];
const pvDia_sinGen = pvDiaIds.filter(id => !pvActIds.includes(id));
if (pvDia_sinGen.length === 0) ok('Todas las actividades de PV_Diario están en PV_General');
else warn(`Actividades en PV_Diario sin definición en PV_General: ${pvDia_sinGen.join(', ')}`);

// Coherencia numérica: PV_General.pv_total vs suma PV_Diario por actividad
console.log('\n  Verificación de coherencia numérica PV_General vs PV_Diario:');
let coherente = true;
pvGen.forEach(gen => {
  const sumDia = pvDia.filter(d => d.actividad_id === gen.actividad_id).reduce((s,d) => s + (d.pv_diario||0), 0);
  const diff = Math.abs(sumDia - (gen.pv_total || 0));
  if (diff > 1) {
    warn(`  ${gen.actividad_id} (${gen.actividad_nombre}): pv_total=${gen.pv_total} vs Σpv_diario=${sumDia.toFixed(2)} → diff=${diff.toFixed(2)}`);
    coherente = false;
  }
});
if (coherente) ok('Coherencia PV_General.pv_total == Σ PV_Diario.pv_diario para todas las actividades');

// ─── 4. Verificar los JSON generados ─────────────────────────────────────────
sep('4. ANÁLISIS DE JSON GENERADOS');

const pvEdtPath = path.join(ROOT, 'data', 'pv-edt-data.json');
if (!fs.existsSync(pvEdtPath)) {
  err('data/pv-edt-data.json NO EXISTE — ejecutar: node scripts/generate-pv-json.cjs');
} else {
  const pvEdt = JSON.parse(fs.readFileSync(pvEdtPath, 'utf-8'));
  ok(`data/pv-edt-data.json: BAC=${pvEdt.bac}, ${pvEdt.edt?.length} items, ${pvEdt.plannedValues?.length} valores PV`);
  
  // Verificar unitPrice en actividades
  const edtActs = pvEdt.edt.filter(e => e.parentId !== null);
  const sinUnitPrice = edtActs.filter(e => (e.unitPrice || 0) === 0);
  const conUnitPrice = edtActs.filter(e => (e.unitPrice || 0) > 0);
  if (sinUnitPrice.length === 0) ok(`Todas las ${edtActs.length} actividades tienen unitPrice > 0`);
  else {
    err(`${sinUnitPrice.length} actividades con unitPrice = 0 → EV = 0 para esas partidas:`);
    sinUnitPrice.forEach(e => console.log(`     • [${e.code}] ${e.name}: unitPrice=${e.unitPrice}, totalBudgetQty=${e.totalBudgetQty}`));
  }
  
  // Muestra los 3 primeros items para verificar estructura
  console.log('\n  Primeros 3 items EDT:');
  pvEdt.edt.slice(0,3).forEach(e => console.log(`     ${JSON.stringify(e)}`));
}

// Verificar pv-by-chapter.json
const pvChPath = path.join(ROOT, 'data', 'pv-by-chapter.json');
if (!fs.existsSync(pvChPath)) {
  err('data/pv-by-chapter.json NO EXISTE');
} else {
  const pvCh = JSON.parse(fs.readFileSync(pvChPath, 'utf-8'));
  console.log(`\n  pv-by-chapter.json: ${pvCh.length} capítulos`);
  pvCh.forEach(ch => {
    const lastPt = ch.points[ch.points.length-1];
    const pt0603 = ch.points.find(p => p.date === '2026-06-03') || 
                   ch.points.filter(p => p.date <= '2026-06-03').pop();
    console.log(`     [${ch.code}] "${ch.name}" | BAC=S/${ch.totalBudget?.toLocaleString()} | PV@Jun3=S/${pt0603?.pvCumulative?.toFixed(0)||'N/A'} | Max=S/${lastPt?.pvCumulative?.toFixed(0)}`);
  });
  
  // Verificar que los codes coincidan con EDT chapters
  const edtRaw2 = JSON.parse(fs.readFileSync(pvEdtPath, 'utf-8'));
  const edtCapCodes = edtRaw2.edt.filter(e => e.parentId === null).map(e => e.code);
  const pvChCodes = pvCh.map(c => c.code);
  const codesNoMatch = edtCapCodes.filter(c => !pvChCodes.includes(c));
  if (codesNoMatch.length === 0) ok('Códigos EDT ↔ pv-by-chapter.json coinciden perfectamente');
  else err(`Códigos EDT sin pv-by-chapter: ${codesNoMatch.join(', ')}`);
}

// ─── 5. Simulación del motor EVM con datos reales ────────────────────────────
sep('5. SIMULACIÓN: ¿Qué calcula el dashboard con los datos actuales?');

// Simular el lookup de PV por capítulo para fecha 2026-06-03
const statusDate = '2026-06-03';
const statusDateTime = new Date(statusDate).getTime();

if (fs.existsSync(pvChPath) && fs.existsSync(pvEdtPath)) {
  const pvCh2 = JSON.parse(fs.readFileSync(pvChPath, 'utf-8'));
  const pvEdt2 = JSON.parse(fs.readFileSync(pvEdtPath, 'utf-8'));
  
  const chapterPvAtCutoff = {};
  pvCh2.forEach(ch => {
    let closest = 0;
    for (const pt of ch.points) {
      if (new Date(pt.date).getTime() <= statusDateTime) closest = pt.pvCumulative;
      else break;
    }
    chapterPvAtCutoff[ch.code] = closest;
  });
  
  console.log(`\n  PV por capítulo a ${statusDate}:`);
  const edtChapters = pvEdt2.edt.filter(e => e.parentId === null);
  let sumPv = 0;
  edtChapters.forEach(ch => {
    const pv = chapterPvAtCutoff[ch.code];
    const found = pv !== undefined;
    if (found) { sumPv += pv; ok(`[${ch.code}] PV = S/ ${pv?.toFixed(2)}`); }
    else err(`[${ch.code}] LOOKUP FALLIDO → PV = 0 (clave no encontrada en pv-by-chapter)`);
  });
  
  // Verificar coherencia con curva S total
  const pvCurveData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pv-curve.json'), 'utf-8'));
  const pvTotalAt = pvCurveData.filter(p => p.date <= statusDate).pop()?.pvCumulative || 0;
  inf(`\n  PV integral a ${statusDate}: S/ ${pvTotalAt.toFixed(2)}`);
  inf(`  Σ PV capítulos a ${statusDate}: S/ ${sumPv.toFixed(2)}`);
  const diff = Math.abs(pvTotalAt - sumPv);
  if (diff < 1) ok(`Coherencia PV integral ≈ Σ PV capítulos ✓`);
  else warn(`Diferencia: S/ ${diff.toFixed(2)} (${((diff/pvTotalAt)*100).toFixed(1)}%)`);
  
  // Simular EV con BACKUP_REPORTS activities
  console.log('\n  Simulando EV con actividades típicas de BACKUP_REPORTS:');
  const testActivities = [
    { edtCode: 'EST-01', qty: 15 },
    { edtCode: 'EST-02', qty: 80 },
    { edtCode: 'EST-03', qty: 25 },
    { edtCode: 'EST-04', qty: 30 },
    { edtCode: 'ARQ-01', qty: 65 },
    { edtCode: 'ARQ-02', qty: 110 },
  ];
  testActivities.forEach(act => {
    const edt = pvEdt2.edt.find(e => e.code === act.edtCode);
    if (!edt) err(`[${act.edtCode}] → NO ENCONTRADO en EDT → EV = 0`);
    else if ((edt.unitPrice || 0) === 0) warn(`[${act.edtCode}] "${edt.name}" → unitPrice = 0 → EV = 0`);
    else ok(`[${act.edtCode}] "${edt.name}" → qty=${act.qty} × unitPrice=${edt.unitPrice} = EV=S/${(act.qty * edt.unitPrice).toFixed(2)}`);
  });
}

sep('6. RESUMEN DE PROBLEMAS Y ACCIONES RECOMENDADAS');
