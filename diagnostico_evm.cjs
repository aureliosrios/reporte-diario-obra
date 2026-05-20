/**
 * diagnostico_evm.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Diagnóstico integral de base de datos RDO + EVM
 * Valida la consistencia relacional y matemática de los archivos Excel:
 *   - BD_Presupuesto_EDT.xlsx
 *   - BD_PV_Diario_EDT.xlsx
 *   - BD_PV_CurvaS_Proyecto.xlsx
 *   - BD_RRHH.xlsx
 *   - BD_Almacen.xlsx
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;

const sep = (t) => console.log(`\n${'═'.repeat(65)}\n  ${t}\n${'═'.repeat(65)}`);
const ok  = (t) => console.log(`  ✅ ${t}`);
const err = (t) => console.log(`  ❌ ${t}`);
const warn= (t) => console.log(`  ⚠️  ${t}`);
const inf = (t) => console.log(`  ℹ️  ${t}`);

// ─── 0. BD_Proyecto.xlsx ─────────────────────────────────────────────────────
sep('0. ANÁLISIS DE BD_Proyecto.xlsx (Metadatos Generales)');
let projRaw = [];
try {
  const wbProj = XLSX.readFile(path.join(ROOT, 'BD_Proyecto.xlsx'));
  projRaw = XLSX.utils.sheet_to_json(wbProj.Sheets['Proyecto'], { defval: '' });
  ok('Archivo BD_Proyecto.xlsx cargado correctamente.');
  if (projRaw.length > 0) {
    const p = projRaw[0];
    ok(`Proyecto: "${p.nombre_largo}" (${p.proyecto_codigo})`);
    ok(`Constructora: "${p.empresa_constructora}" | Ubicación: "${p.ubicacion}"`);
    ok(`Monto de Contrato: ${p.moneda} ${p.monto_contrato.toLocaleString()}`);
  } else {
    err('La hoja "Proyecto" en BD_Proyecto.xlsx está vacía.');
  }
} catch (e) {
  err(`No se pudo leer BD_Proyecto.xlsx: ${e.message}`);
}

// ─── 1. BD_Presupuesto_EDT.xlsx ──────────────────────────────────────────────
sep('1. ANÁLISIS DE BD_Presupuesto_EDT.xlsx (Presupuesto y EDT)');
let edtRaw = [];
try {
  const wbEdt = XLSX.readFile(path.join(ROOT, 'BD_Presupuesto_EDT.xlsx'));
  edtRaw = XLSX.utils.sheet_to_json(wbEdt.Sheets['Presupuesto'], { defval: '' });
  ok('Archivo BD_Presupuesto_EDT.xlsx cargado correctamente.');
  inf(`Hojas disponibles: ${wbEdt.SheetNames.join(', ')}`);
} catch (e) {
  err(`No se pudo leer BD_Presupuesto_EDT.xlsx: ${e.message}`);
}

if (edtRaw.length > 0) {
  const cols = Object.keys(edtRaw[0]);
  inf(`Columnas disponibles: ${cols.join(', ')}`);
  
  const colsRequeridas = ['edt_id', 'edt_nombre', 'actividad_id', 'actividad_nombre', 
                          'codigo', 'unidad', 'metrado_total_planificado', 'precio_unitario', 
                          'precio_parcial', 'presupuesto_total', 'nivel_wbs', 'padre_id'];
  const colsFaltantes = colsRequeridas.filter(c => !cols.includes(c));
  if (colsFaltantes.length === 0) {
    ok('Todas las columnas jerárquicas requeridas están presentes.');
  } else {
    err(`Columnas faltantes: ${colsFaltantes.join(', ')}`);
  }

  const caps = edtRaw.filter(r => r.nivel_wbs === 1);
  const acts = edtRaw.filter(r => r.nivel_wbs === 2);
  inf(`Estructura WBS: ${caps.length} Capítulos (Nivel 1) y ${acts.length} Partidas Ejecutoras (Nivel 2)`);

  if (acts.length === 30) {
    ok('¡Estructura de 30 actividades validada correctamente!');
  } else {
    warn(`Se esperaban 30 actividades, pero se encontraron ${acts.length}.`);
  }

  // Verificar presupuestos en cero
  const actsSinBudget = acts.filter(r => (parseFloat(r.presupuesto_total) || 0) === 0);
  if (actsSinBudget.length === 0) {
    ok('Todas las partidas tienen presupuestos mayores a cero.');
  } else {
    err(`${actsSinBudget.length} partidas tienen presupuesto en cero.`);
  }

  // Verificar coherencia jerárquica
  let jerarquiaOk = true;
  caps.forEach(cap => {
    const hijos = acts.filter(r => r.padre_id === cap.edt_id);
    const sumHijos = hijos.reduce((s, r) => s + (parseFloat(r.precio_parcial) || 0), 0);
    const capBudget = parseFloat(cap.presupuesto_total) || 0;
    const diff = Math.abs(sumHijos - capBudget);
    
    if (diff > 0.1) {
      err(`Capítulo [${cap.codigo}] "${cap.edt_nombre}" descabalado: Suma Hijos = S/ ${sumHijos} vs Capítulo = S/ ${capBudget}`);
      jerarquiaOk = false;
    } else {
      console.log(`     [OK] [${cap.codigo}] Suma partidas: S/ ${sumHijos.toLocaleString()} == Capítulo: S/ ${capBudget.toLocaleString()}`);
    }
  });
  if (jerarquiaOk) ok('Coherencia jerárquica de presupuesto al 100%.');
}

// ─── 2. BD_PV_Diario_EDT.xlsx ────────────────────────────────────────────────
sep('2. ANÁLISIS DE BD_PV_Diario_EDT.xlsx (Distribución de PV)');
let metRaw = [];
try {
  const wbMet = XLSX.readFile(path.join(ROOT, 'BD_PV_Diario_EDT.xlsx'));
  metRaw = XLSX.utils.sheet_to_json(wbMet.Sheets['PV_Diario_EDT'], { defval: '' });
  ok('Archivo BD_PV_Diario_EDT.xlsx cargado correctamente.');
} catch (e) {
  err(`No se pudo leer BD_PV_Diario_EDT.xlsx: ${e.message}`);
}

if (metRaw.length > 0 && edtRaw.length > 0) {
  const metIds = [...new Set(metRaw.map(r => r.id_wbs))];
  inf(`Total partidas con distribución de PV: ${metIds.length}`);
  
  const idsEDT = edtRaw.filter(r => r.nivel_wbs === 2).map(r => String(r.actividad_id));
  const noMapeados = metIds.filter(id => !idsEDT.includes(String(id)));
  if (noMapeados.length === 0) {
    ok('Todas las partidas distribuidas en el cronograma mapean a la EDT.');
  } else {
    err(`IDs de cronograma no encontrados en EDT: ${noMapeados.join(', ')}`);
  }

  // Validar conservación de la masa para cada partida
  let masaOk = true;
  edtRaw.filter(r => r.nivel_wbs === 2).forEach(act => {
    const dailyRecords = metRaw.filter(r => String(r.id_wbs) === String(act.actividad_id));
    const sumQty = dailyRecords.reduce((s, r) => s + (parseFloat(r.metrado_diario_planificado) || 0), 0);
    const diff = Math.abs(sumQty - act.metrado_total_planificado);
    
    if (diff > 0.01) {
      err(`Partida [${act.codigo}]: Suma metrados diarios = ${sumQty} vs Metrado EDT = ${act.metrado_total_planificado}`);
      masaOk = false;
    }
  });
  if (masaOk) ok('Conservación de masa validada: la suma de metrados diarios es idéntica al total EDT para todas las partidas.');
}

// ─── 3. BD_PV_CurvaS_Proyecto.xlsx ──────────────────────────────────────────
sep('3. ANÁLISIS DE BD_PV_CurvaS_Proyecto.xlsx (Curva S Oficial)');
let curvaRaw = [];
try {
  const wbCurva = XLSX.readFile(path.join(ROOT, 'BD_PV_CurvaS_Proyecto.xlsx'));
  curvaRaw = XLSX.utils.sheet_to_json(wbCurva.Sheets['CurvaS'], { defval: '' });
  ok('Archivo BD_PV_CurvaS_Proyecto.xlsx cargado correctamente.');
} catch (e) {
  err(`No se pudo leer BD_PV_CurvaS_Proyecto.xlsx: ${e.message}`);
}

if (curvaRaw.length > 0 && edtRaw.length > 0) {
  inf(`Periodo planificado: ${curvaRaw[0]?.fecha} al ${curvaRaw[curvaRaw.length - 1]?.fecha} (${curvaRaw.length} días calendario)`);
  if (curvaRaw.length === 90) {
    ok('¡Plazo del proyecto validado a 90 días exactos!');
  } else {
    warn(`Se esperaban 90 días de ejecución, pero se registraron ${curvaRaw.length} días.`);
  }

  // Validar coherencia numérica Curve S vs Presupuesto Total (BAC)
  const bacPresupuesto = edtRaw.filter(r => r.nivel_wbs === 1).reduce((s, r) => s + (parseFloat(r.presupuesto_total) || 0), 0);
  const bacCurvaS = parseFloat(curvaRaw[curvaRaw.length - 1]?.pv_acumulado) || 0;
  const diffBac = Math.abs(bacPresupuesto - bacCurvaS);

  inf(`BAC Presupuesto: S/ ${bacPresupuesto.toLocaleString()}`);
  inf(`BAC Curva S Acumulado: S/ ${bacCurvaS.toLocaleString()}`);
  
  if (diffBac < 1.0) {
    ok('Coherencia de Línea Base: El BAC del Presupuesto es matemáticamente idéntico al acumulado final de la Curva S.');
  } else {
    err(`¡DESCUADRE DETECTADO! Diferencia: S/ ${diffBac.toFixed(2)}`);
  }
}

// ─── 4. BD_RRHH.xlsx y BD_Almacen.xlsx ────────────────────────────────────────
sep('4. ANÁLISIS DE CATÁLOGOS DE COSTOS REALES (RRHH y Almacén)');
try {
  const wbRrhh = XLSX.readFile(path.join(ROOT, 'BD_RRHH.xlsx'));
  const rrhh = XLSX.utils.sheet_to_json(wbRrhh.Sheets['Recursos_MO'], { defval: '' });
  ok(`BD_RRHH.xlsx cargado. ${rrhh.length} perfiles de Mano de Obra (HH) listos.`);
  rrhh.forEach(r => console.log(`     • [${r.codigo}] ${r.nombre}: S/ ${r.costo_unitario}/hora`));
} catch (e) {
  err(`Error cargando BD_RRHH.xlsx: ${e.message}`);
}

try {
  const wbAlmacen = XLSX.readFile(path.join(ROOT, 'BD_Almacen.xlsx'));
  const almacen = XLSX.utils.sheet_to_json(wbAlmacen.Sheets['Materiales_Equipos'], { defval: '' });
  const mats = almacen.filter(r => r.tipo === 'material');
  const eqs = almacen.filter(r => r.tipo === 'equipo');
  ok(`BD_Almacen.xlsx cargado. ${mats.length} materiales y ${eqs.length} maquinarias/equipos catalogados.`);
} catch (e) {
  err(`Error cargando BD_Almacen.xlsx: ${e.message}`);
}

// ─── 5. Estado de Sincronización JSON ────────────────────────────────────────
sep('5. DIAGNÓSTICO DE ARCHIVOS JSON DE PRODUCCIÓN');
const jsonFiles = ['project.json', 'pv-edt-data.json', 'pv-curve.json', 'pv-by-chapter.json', 'resources.json'];
let jsonOk = true;

jsonFiles.forEach(file => {

  const p = path.join(ROOT, 'data', file);
  if (fs.existsSync(p)) {
    const size = fs.statSync(p).size;
    ok(`Archivo data/${file} existe (${size} bytes)`);
  } else {
    err(`Archivo data/${file} NO EXISTE. Requiere sincronización del pipeline.`);
    jsonOk = false;
  }
});

console.log(`\n${'═'.repeat(65)}`);
if (jsonOk) {
  ok('SISTEMA RDO + EVM OPERATIVO Y SINCRONIZADO AL 100%.');
} else {
  warn('Se requiere ejecutar: node scripts/generate-pv-json.cjs para sincronizar los JSON de producción.');
}
console.log(`${'═'.repeat(65)}\n`);
