/**
 * generate-pv-json.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline de datos: Excel → JSON estáticos para el servidor Express y GitHub Pages.
 *
 * Genera:
 *   data/pv-curve.json          — Curva S acumulada del proyecto (177 fechas)
 *   data/pv-by-chapter.json     — PV acumulado por capítulo EDT (código real)
 *   data/pv-edt-data.json       — Estructura EDT + valores planificados diarios
 *   data/resources.json         — Catálogo de recursos (BD_RRHH)
 *   public/data/*               — Copias para GitHub Pages / modo estático
 *
 * Regla de EVM aplicada:
 *   PV(t) = Σ pv_diario hasta t              (de BD_Metrados_Planificados)
 *   BAC   = PV al último día del cronograma  (fin del proyecto)
 *   unitPrice por partida = presupuesto_total / metrado_total_planificado
 *   → EV = Σ (qty_ejecutado × unitPrice) queda en la misma unidad monetaria que PV
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

/** Redondear a 2 decimales */
const r2 = v => Math.round(v * 100) / 100;

/** Escribir JSON en /data/ y también copiarlo a /public/data/ */
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

// ─── 1. Leer BD_EDT.xlsx ─────────────────────────────────────────────────────
console.log('\n[1/5] Leyendo BD_EDT.xlsx …');
const wbEdt  = XLSX.readFile(path.join(ROOT, 'BD_EDT.xlsx'));
const edtRaw = XLSX.utils.sheet_to_json(wbEdt.Sheets['Sheet1'], { defval: '' });
console.log(`  → ${edtRaw.length} filas leídas`);

// ─── 2. Leer BD_Metrados_Planificados.xlsx ───────────────────────────────────
console.log('\n[2/5] Leyendo BD_Metrados_Planificados.xlsx …');
const wbMet  = XLSX.readFile(path.join(ROOT, 'BD_Metrados_Planificados.xlsx'));
const metRaw = XLSX.utils.sheet_to_json(wbMet.Sheets['Sheet1'], { defval: '' });
console.log(`  → ${metRaw.length} filas leídas`);

// ─── 3. Leer BD_RRHH.xlsx (catálogo de recursos) ────────────────────────────
console.log('\n[3/5] Leyendo BD_RRHH.xlsx …');
let resourceItems = [];
try {
  const wbRrhh = XLSX.readFile(path.join(ROOT, 'BD_RRHH.xlsx'));
  const raw    = XLSX.utils.sheet_to_json(wbRrhh.Sheets[wbRrhh.SheetNames[0]], { defval: '' });
  resourceItems = raw.map(r => ({
    id:       r.codigo,
    name:     r.nombre,
    type:     r.tipo,           // 'mano_obra' | 'material' | 'equipo'
    unit:     r.unidad,
    unitCost: r.costo_unitario
  })).filter(r => r.id && r.name);
  console.log(`  → ${resourceItems.length} recursos cargados`);
} catch (e) {
  console.warn('  ⚠ BD_RRHH.xlsx no encontrado — recursos vacíos');
}

// ─── 4. Construir lookups de EDT ─────────────────────────────────────────────
console.log('\n[4/5] Procesando estructura EDT …');

// edt_id (número) → código alphanumerico del capítulo (Nivel 1)
const chapterCodeById   = {};   // edt_id → 'OBR-PRE'
const chapterNameById   = {};   // edt_id → 'Obras Preliminares'
// actividad_id (ej. '1.1') → código alfanumérico de la partida (Nivel 2)
const activityCodeById  = {};   // '1.1' → 'OBR-PRE-01'
// actividad_id → edt_id del capítulo padre
const activityParentId  = {};   // '1.1' → 1
// partida código → presupuesto_total (S/) + metrado_total
const activityBudget    = {};   // 'OBR-PRE-01' → { budget, metrado }

edtRaw.forEach(r => {
  if (r.nivel_wbs === 1) {
    chapterCodeById[r.edt_id] = r.codigo;
    chapterNameById[r.edt_id] = r.edt_nombre;
  } else if (r.nivel_wbs === 2) {
    activityCodeById[r.actividad_id] = r.codigo;
    activityParentId[r.actividad_id] = r.padre_id;
    activityBudget[r.codigo] = {
      budget:  r.presupuesto_total || 0,
      metrado: r.metrado_total_planificado || 1
    };
  }
});

// ─── 5. Construir la lista de ítems EDT (EdtItem interface) ──────────────────

/**
 * unitPrice = presupuesto_total / metrado_total_planificado
 * Esto garantiza que:  EV = qty_ejecutado × unitPrice  esté en S/ (soles)
 * Y sea coherente con el PV de la curva S.
 */
const edtItems = edtRaw.map(r => {
  if (r.nivel_wbs === 1) {
    // Capítulo: calcular presupuesto total sumando partidas hijas
    const childBudgets = Object.entries(activityParentId)
      .filter(([, pid]) => pid === r.edt_id)
      .map(([actId]) => activityBudget[activityCodeById[actId]]?.budget || 0);
    const totalBudget = childBudgets.reduce((s, v) => s + v, 0);
    return {
      code:           r.codigo,
      parentId:       null,
      name:           r.edt_nombre,
      unit:           'Global',
      totalBudgetQty: totalBudget,   // presupuesto del capítulo en S/
      unitPrice:      0              // capítulos no tienen unitPrice directo
    };
  } else {
    const code     = r.codigo;
    const budInfo  = activityBudget[code] || { budget: 0, metrado: 1 };
    // unitPrice real en S/ por unidad de metrado
    const uPrice   = budInfo.metrado > 0 ? r2(budInfo.budget / budInfo.metrado) : 0;
    return {
      code,
      parentId:       chapterCodeById[r.padre_id] || String(r.padre_id),
      name:           r.actividad_nombre,
      unit:           r.unidad || 'Global',
      totalBudgetQty: r.metrado_total_planificado || 0,  // metrado contratado
      unitPrice:      uPrice                             // S/ por unidad
    };
  }
});

// Calcular BAC total del proyecto
const bac = edtItems
  .filter(e => e.parentId === null)
  .reduce((s, ch) => s + ch.totalBudgetQty, 0);
console.log(`  → ${edtItems.length} ítems EDT generados | BAC total: S/ ${bac.toFixed(2)}`);

// ─── 6. Valores Planificados diarios (PlannedValue interface) ─────────────────
const plannedValues = metRaw.map(r => ({
  date:        r.fecha,
  edtCode:     activityCodeById[r.id_wbs] || String(r.id_wbs),
  plannedQty:  r.metrado_diario_planificado || 0
}));
console.log(`  → ${plannedValues.length} registros de PV diarios`);

// ─── 7. Curva S acumulada del proyecto ───────────────────────────────────────
const pvByDate = {};
for (const r of metRaw) {
  if (!pvByDate[r.fecha]) pvByDate[r.fecha] = 0;
  pvByDate[r.fecha] += r.pv_diario || 0;
}
const sortedDates = Object.keys(pvByDate).sort();
let acum = 0;
const pvCurve = sortedDates.map(fecha => {
  acum += pvByDate[fecha];
  return { date: fecha, pvDaily: r2(pvByDate[fecha]), pvCumulative: r2(acum) };
});
console.log(`  → Curva S: ${pvCurve.length} fechas | PV total: S/ ${acum.toFixed(2)}`);

// ─── 8. PV acumulado por capítulo EDT ────────────────────────────────────────

/**
 * CLAVE: usamos el CÓDIGO del capítulo (ej. "OBR-PRE") como `code`
 * en pv-by-chapter.json, NO el nombre.
 * Esto permite un lookup sin ambigüedad en ProjectDashboard.tsx:
 *   chapterPvAtCutoff[ch.code]  — siempre funciona.
 */
const activityToChapterCode = {};  // actividad_id → código capítulo padre (ej 'OBR-PRE')
edtRaw.forEach(r => {
  if (r.nivel_wbs === 2 && chapterCodeById[r.padre_id]) {
    activityToChapterCode[r.actividad_id] = chapterCodeById[r.padre_id];
  }
});

// Inicializar acumulado por capítulo × fecha
const dailyByChapterCode = {};
for (const code of Object.values(chapterCodeById)) {
  dailyByChapterCode[code] = {};
  for (const f of sortedDates) dailyByChapterCode[code][f] = 0;
}
for (const r of metRaw) {
  const chCode = activityToChapterCode[r.id_wbs];
  if (chCode && r.fecha) {
    dailyByChapterCode[chCode][r.fecha] = (dailyByChapterCode[chCode][r.fecha] || 0) + (r.pv_diario || 0);
  }
}

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

// Validar coherencia: suma de BAC capítulos ≈ BAC total
const sumChapterBac = pvByChapter.reduce((s, ch) => s + ch.totalBudget, 0);
console.log(`  → ${pvByChapter.length} capítulos | Σ BAC capítulos: S/ ${sumChapterBac.toFixed(2)} | BAC total: S/ ${bac.toFixed(2)}`);
const diff = Math.abs(sumChapterBac - bac);
if (diff > 1) {
  console.warn(`  ⚠ INCONSISTENCIA: diferencia de S/ ${diff.toFixed(2)} entre Σ capítulos y BAC total`);
} else {
  console.log(`  ✓ Coherencia BAC: OK (diferencia < S/ 1.00)`);
}

// ─── 9. Escribir todos los archivos ──────────────────────────────────────────
console.log('\n[5/5] Escribiendo archivos JSON …');

// pv-edt-data.json → incluye BAC total del proyecto
writeJson('pv-edt-data.json', { bac, edt: edtItems, plannedValues });

// pv-curve.json
writeJson('pv-curve.json', pvCurve);

// pv-by-chapter.json (code = código EDT, no nombre)
writeJson('pv-by-chapter.json', pvByChapter);

// resources.json
if (resourceItems.length > 0) {
  writeJson('resources.json', resourceItems);
} else {
  console.log('  ⚠ resources.json omitido (BD_RRHH vacío)');
}

// Compact curve (para bundle embedded fallback)
writeJson('pv-curve-compact.json', {
  dates:         pvCurve.map(d => d.date),
  pvDaily:       pvCurve.map(d => d.pvDaily),
  pvCumulative:  pvCurve.map(d => d.pvCumulative)
}, false);  // no necesita copia en public/

console.log('\n✅ Pipeline completado. Todos los JSON están sincronizados con los Excel.\n');
