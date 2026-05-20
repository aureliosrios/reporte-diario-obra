/**
 * generate-pv-json.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline de datos: Excel → JSON estáticos para el servidor Express y GitHub Pages.
 *
 * Lee los archivos Excel reestructurados de la línea base:
 *   - BD_Presupuesto_EDT.xlsx      (Estructura y Presupuesto EDT)
 *   - BD_PV_Diario_EDT.xlsx        (PV diario por actividad/EDT)
 *   - BD_PV_CurvaS_Proyecto.xlsx   (Curva S oficial agregada)
 *   - BD_RRHH.xlsx                 (Catálogo de personal MO)
 *   - BD_Almacen.xlsx              (Catálogo de materiales y equipos)
 *
 * Genera:
 *   data/pv-curve.json          — Curva S acumulada del proyecto (90 fechas)
 *   data/pv-by-chapter.json     — PV acumulado por capítulo EDT (código real)
 *   data/pv-edt-data.json       — Estructura EDT + valores planificados diarios
 *   data/resources.json         — Catálogo de recursos unificado (Mano de Obra + Almacén)
 *   public/data/*               — Copias para GitHub Pages / modo estático
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const dataDir   = path.join(ROOT, 'data');
const publicDir = path.join(ROOT, 'public', 'data');

// Asegurar directorios
[dataDir, publicDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ─── Helpers ────────────────────────────────────────────────────────────────

const r2 = v => Math.round(v * 100) / 100;

function writeJson(filename, data, copyToPublic = true) {
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(path.join(dataDir, filename), content, 'utf-8');
  if (copyToPublic) {
    fs.writeFileSync(path.join(publicDir, filename), content, 'utf-8');
    console.log(`  ✓ data/${filename}  +  public/data/${filename}`);
  } else {
    console.log(`  ✓ data/${filename}`);
  }
}

// ─── 1. Leer BD_Presupuesto_EDT.xlsx ─────────────────────────────────────────
console.log('\n[1/7] Leyendo BD_Presupuesto_EDT.xlsx …');
const wbEdt  = XLSX.readFile(path.join(ROOT, 'BD_Presupuesto_EDT.xlsx'));
const edtRaw = XLSX.utils.sheet_to_json(wbEdt.Sheets['Presupuesto'], { defval: '' });
console.log(`  → ${edtRaw.length} filas leídas de la hoja "Presupuesto"`);

// ─── 2. Leer BD_PV_Diario_EDT.xlsx ───────────────────────────────────────────
console.log('\n[2/7] Leyendo BD_PV_Diario_EDT.xlsx …');
const wbMet  = XLSX.readFile(path.join(ROOT, 'BD_PV_Diario_EDT.xlsx'));
const metRaw = XLSX.utils.sheet_to_json(wbMet.Sheets['PV_Diario_EDT'], { defval: '' });
console.log(`  → ${metRaw.length} registros diarios leídos de "PV_Diario_EDT"`);

// ─── 3. Leer BD_PV_CurvaS_Proyecto.xlsx ─────────────────────────────────────
console.log('\n[3/7] Leyendo BD_PV_CurvaS_Proyecto.xlsx …');
const wbCurva = XLSX.readFile(path.join(ROOT, 'BD_PV_CurvaS_Proyecto.xlsx'));
const curvaRaw = XLSX.utils.sheet_to_json(wbCurva.Sheets['CurvaS'], { defval: '' });
console.log(`  → ${curvaRaw.length} fechas leídas de la curva S`);

// ─── 3b. Leer BD_Proyecto.xlsx ──────────────────────────────────────────────
console.log('\n[3b/7] Leyendo BD_Proyecto.xlsx …');
let projectMeta = null;
try {
  const wbProj = XLSX.readFile(path.join(ROOT, 'BD_Proyecto.xlsx'));
  const projRaw = XLSX.utils.sheet_to_json(wbProj.Sheets['Proyecto'], { header: 1, defval: '' });

  const meta = {};
  projRaw.forEach(row => {
    const key = row[0];
    const val = row[1];
    if (key && val !== undefined && val !== '') {
      meta[key] = val;
    }
  });

  projectMeta = {
    id: meta['Código de Proyecto'] || 'MFG-01',
    name: meta['Nombre del Proyecto'] || 'Edificio Multifamiliar Girasoles',
    code: meta['Código de Proyecto'] || 'MFG-01',
    location: meta['Ubicación'] || 'San Isidro, Lima, Perú',
    manager: meta['Gerente de Obra'] || 'Ing. Alejandro Rivas',
    company: meta['Empresa Constructora'] || 'Constructora Aurelio Rios S.A.C.',
    client: meta['Cliente'] || 'Inmobiliaria Los Parques S.A.',
    supervisorCompany: meta['Supervisor de Obra'] || 'Ing. Claudia Mendoza'
  };
  console.log(`  → Proyecto cargado: "${projectMeta.name}" (${projectMeta.company})`);
} catch (e) {
  console.warn('  ⚠ BD_Proyecto.xlsx o la hoja "Proyecto" no se pudo procesar:', e.message);
}

// ─── 4. Leer Catálogos de Recursos (BD_RRHH.xlsx + BD_Almacen.xlsx) ─────────
console.log('\n[4/7] Leyendo recursos de personal (BD_RRHH.xlsx) y almacén (BD_Almacen.xlsx) …');
let resourceItems = [];


// A. Cargar personal de BD_RRHH.xlsx
try {
  const wbRrhh = XLSX.readFile(path.join(ROOT, 'BD_RRHH.xlsx'));
  const rrhhRaw = XLSX.utils.sheet_to_json(wbRrhh.Sheets['Recursos_MO'], { defval: '' });
  rrhhRaw.forEach(r => {
    if (r.codigo && r.nombre) {
      resourceItems.push({
        id:       r.codigo,
        name:     r.nombre,
        type:     r.tipo || 'mano_obra',
        unit:     r.unidad || 'Hora Hombre',
        unitCost: parseFloat(r.costo_unitario) || 0
      });
    }
  });
  console.log(`  → ${rrhhRaw.length} recursos de mano de obra cargados`);
} catch (e) {
  console.warn('  ⚠ BD_RRHH.xlsx o la hoja "Recursos_MO" no se pudo procesar:', e.message);
}

// B. Cargar materiales y equipos de BD_Almacen.xlsx
try {
  const wbAlmacen = XLSX.readFile(path.join(ROOT, 'BD_Almacen.xlsx'));
  const almacenRaw = XLSX.utils.sheet_to_json(wbAlmacen.Sheets['Materiales_Equipos'], { defval: '' });
  almacenRaw.forEach(r => {
    if (r.id_recurso && r.descripcion) {
      resourceItems.push({
        id:       r.id_recurso,
        name:     r.descripcion,
        type:     r.tipo, // 'material' | 'equipo'
        unit:     r.unidad,
        unitCost: parseFloat(r.precio_unitario_real) || 0
      });
    }
  });
  console.log(`  → ${almacenRaw.length} recursos de almacén/equipos cargados`);
} catch (e) {
  console.warn('  ⚠ BD_Almacen.xlsx o la hoja "Materiales_Equipos" no se pudo procesar:', e.message);
}

console.log(`  → Total catálogo unificado: ${resourceItems.length} recursos consolidados`);

// ─── 5. Procesar Estructura EDT ─────────────────────────────────────────────
console.log('\n[5/7] Procesando estructura EDT …');

const chapterCodeById   = {};
const chapterNameById   = {};
const activityCodeById  = {};
const activityParentId  = {};
const activityBudget    = {};

edtRaw.forEach(r => {
  if (r.nivel_wbs === 1) {
    chapterCodeById[r.edt_id] = r.codigo;
    chapterNameById[r.edt_id] = r.edt_nombre;
  } else if (r.nivel_wbs === 2) {
    activityCodeById[r.actividad_id] = r.codigo;
    activityParentId[r.actividad_id] = r.padre_id;
    activityBudget[r.codigo] = {
      budget:  parseFloat(r.presupuesto_total) || 0,
      metrado: parseFloat(r.metrado_total_planificado) || 0,
      pu:      parseFloat(r.precio_unitario) || 0
    };
  }
});

const edtItems = edtRaw.map(r => {
  if (r.nivel_wbs === 1) {
    const totalBudget = parseFloat(r.presupuesto_total) || 0;
    return {
      code:           r.codigo,
      parentId:       null,
      name:           r.edt_nombre,
      unit:           'Global',
      totalBudgetQty: totalBudget,
      unitPrice:      0
    };
  } else {
    const code    = r.codigo;
    const info    = activityBudget[code] || { budget: 0, metrado: 0, pu: 0 };
    const budget  = info.budget;
    const metrado = info.metrado;
    const uPrice  = info.pu > 0 ? info.pu : (metrado > 0 ? r2(budget / metrado) : 0);
    
    return {
      code,
      parentId:       chapterCodeById[r.padre_id] || String(r.padre_id),
      name:           r.actividad_nombre,
      unit:           r.unidad || 'Global',
      totalBudgetQty: metrado,
      unitPrice:      uPrice
    };
  }
});

// Calcular BAC total del proyecto
const bac = edtItems
  .filter(e => e.parentId === null)
  .reduce((s, ch) => s + ch.totalBudgetQty, 0);
console.log(`  → ${edtItems.length} ítems EDT generados | BAC total del presupuesto: S/ ${bac.toFixed(2)}`);

// Verificar coherencia del unitPrice
let coherenciaUP = true;
edtItems.filter(e => e.parentId !== null).forEach(e => {
  const originalRow = edtRaw.find(r => r.codigo === e.code);
  const budget = originalRow ? (parseFloat(originalRow.presupuesto_total) || 0) : 0;
  const diff = Math.abs((e.totalBudgetQty * e.unitPrice) - budget);
  if (budget > 0 && diff > 1) {
    console.warn(`  ⚠ [${e.code}] metrado×unitPrice=${(e.totalBudgetQty * e.unitPrice).toFixed(0)} ≠ presupuesto=${budget}`);
    coherenciaUP = false;
  }
});
if (coherenciaUP) console.log(`  ✓ Coherencia unitPrice: metrado × precio_unitario = presupuesto para todas las partidas`);

// ─── 6. Valores Planificados Diarios (PlannedValue) ──────────────────────────
const plannedValues = metRaw.map(r => ({
  date:        r.fecha,
  edtCode:     activityCodeById[r.id_wbs] || String(r.id_wbs),
  plannedQty:  r.metrado_diario_planificado || 0
}));
console.log(`  → ${plannedValues.length} registros de PV diarios por actividad`);

// ─── 7. Curva S oficial del Proyecto ─────────────────────────────────────────
console.log('\n[6/7] Procesando curva S agregada oficial …');
const pvCurve = curvaRaw.map(r => ({
  date: r.fecha,
  pvDaily: r2(parseFloat(r.pv_diario) || 0),
  pvCumulative: r2(parseFloat(r.pv_acumulado) || 0)
}));
const totalProjectPv = pvCurve[pvCurve.length - 1]?.pvCumulative || 0;
console.log(`  → Curva S: ${pvCurve.length} fechas | PV acumulado total: S/ ${totalProjectPv.toFixed(2)}`);

// Verificar coherencia S-Curve vs BAC
const diffBac = Math.abs(totalProjectPv - bac);
if (diffBac < 1.0) {
  console.log(`  ✓ Coherencia Curva S: PV total ≈ BAC (diferencia S/ ${diffBac.toFixed(2)})`);
} else {
  console.warn(`  ⚠ INCONSISTENCIA: PV total Curva S (${totalProjectPv.toFixed(2)}) ≠ BAC Presupuesto (${bac.toFixed(2)})`);
}

// ─── 8. PV Acumulado por Capítulo ────────────────────────────────────────────
console.log('\n[7/7] Agregando Planned Value por Capítulo EDT …');
const sortedDates = pvCurve.map(p => p.date).sort();

const activityToChapterCode = {};
edtRaw.forEach(r => {
  if (r.nivel_wbs === 2 && chapterCodeById[r.padre_id]) {
    activityToChapterCode[r.actividad_id] = chapterCodeById[r.padre_id];
  }
});

// Inicializar matriz de acumulados diarios por capítulo
const dailyByChapterCode = {};
for (const code of Object.values(chapterCodeById)) {
  dailyByChapterCode[code] = {};
  for (const f of sortedDates) dailyByChapterCode[code][f] = 0;
}

metRaw.forEach(r => {
  const chCode = activityToChapterCode[r.id_wbs];
  if (chCode && r.fecha) {
    dailyByChapterCode[chCode][r.fecha] = (dailyByChapterCode[chCode][r.fecha] || 0) + (r.pv_diario || 0);
  }
});

const pvByChapter = Object.entries(chapterCodeById).map(([edt_id, code]) => {
  const name        = chapterNameById[edt_id];
  const chEdtItem   = edtItems.find(e => e.code === code);
  const totalBudget = chEdtItem ? chEdtItem.totalBudgetQty : 0;
  let cum = 0;
  const points = sortedDates.map(f => {
    cum += dailyByChapterCode[code][f] || 0;
    return { date: f, pvCumulative: r2(cum) };
  });
  return { code, name, totalBudget: r2(totalBudget), points };
});

const sumChapterBac = pvByChapter.reduce((s, ch) => s + ch.totalBudget, 0);
console.log(`  → Consolidados ${pvByChapter.length} capítulos | Σ BAC capítulos: S/ ${sumChapterBac.toFixed(2)} | BAC total: S/ ${bac.toFixed(2)}`);
const diff = Math.abs(sumChapterBac - bac);
if (diff > 1.0) {
  console.warn(`  ⚠ INCONSISTENCIA: diferencia de S/ ${diff.toFixed(2)} entre Σ capítulos y BAC total`);
} else {
  console.log(`  ✓ Coherencia BAC Capítulos: OK (diferencia < S/ 1.00)`);
}

// ─── 9. Escribir Archivos JSON Sincronizados ───────────────────────────────
console.log('\n[Escribiendo archivos JSON sincronizados] …');

if (projectMeta) {
  writeJson('project.json', projectMeta);
}


writeJson('pv-edt-data.json', { bac, edt: edtItems, plannedValues });
writeJson('pv-curve.json', pvCurve);
writeJson('pv-by-chapter.json', pvByChapter);
writeJson('resources.json', resourceItems);

// Curva compacta para optimización
writeJson('pv-curve-compact.json', {
  dates:         pvCurve.map(d => d.date),
  pvDaily:       pvCurve.map(d => d.pvDaily),
  pvCumulative:  pvCurve.map(d => d.pvCumulative)
}, false);

console.log('\n✅ PIPELINE COMPLETADO EXITOSAMENTE. Datos de dashboard actualizados.\n');

