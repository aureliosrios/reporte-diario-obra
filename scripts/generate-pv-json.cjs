const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Generate pv-curve.json and pv-edt-data.json from Excel files

const ROOT = path.resolve(__dirname, '..');

// 1. Read BD_EDT
const wbEdt = XLSX.readFile(path.join(ROOT, 'BD_EDT.xlsx'));
const edtRaw = XLSX.utils.sheet_to_json(wbEdt.Sheets['Sheet1'], { defval: '' });

// 2. Read BD_Metrados_Planificados
const wbMet = XLSX.readFile(path.join(ROOT, 'BD_Metrados_Planificados.xlsx'));
const metRaw = XLSX.utils.sheet_to_json(wbMet.Sheets['Sheet1'], { defval: '' });

// 2b. Read BD_RRHH (resource catalog)
let resources = [];
try {
  const wbRrhh = XLSX.readFile(path.join(ROOT, 'BD_RRHH.xlsx'));
  resources = XLSX.utils.sheet_to_json(wbRrhh.Sheets[wbRrhh.SheetNames[0]], { defval: '' });
  console.log(`  BD_RRHH.xlsx: ${resources.length} recursos cargados`);
} catch (e) {
  console.warn('  BD_RRHH.xlsx no encontrado, recursos vacíos');
}

// Build codigo lookup for parent references
const codigoLookup = {}; // edt_id -> codigo (for parentId resolution)
const actividadCodigoLookup = {}; // actividad_id -> codigo
edtRaw.forEach(r => {
  if (r.nivel_wbs === 1) {
    codigoLookup[r.edt_id] = r.codigo;
  } else if (r.nivel_wbs === 2) {
    actividadCodigoLookup[r.actividad_id] = r.codigo;
  }
});

// 3. Generate EDT items (matching EdtItem interface) using the 'codigo' column
const edtItems = edtRaw.map(r => {
  const code = r.codigo || (r.nivel_wbs === 1 ? String(r.edt_id) : String(r.actividad_id));
  const parentId = r.nivel_wbs === 1 ? null : (codigoLookup[r.padre_id] || String(r.padre_id));
  return {
    code,
    parentId,
    name: r.nivel_wbs === 1 ? r.edt_nombre : r.actividad_nombre,
    unit: r.unidad || 'Global',
    totalBudgetQty: r.nivel_wbs === 2 ? (r.presupuesto_total || 0) : 1,
    unitPrice: r.nivel_wbs === 2 && r.presupuesto_total > 0 ? 1 : 0
  };
});

// 4. Generate Planned Values (matching PlannedValue interface)
// Map actividad_id -> codigo for planned values
const plannedValues = metRaw.map(r => ({
  date: r.fecha,
  edtCode: actividadCodigoLookup[r.id_wbs] || String(r.id_wbs),
  plannedQty: r.metrado_diario_planificado || 0
}));

// 5. Generate PV Curve (daily accumulated project-level)
const pvByDate = {};
for (const r of metRaw) {
  if (!pvByDate[r.fecha]) pvByDate[r.fecha] = 0;
  pvByDate[r.fecha] += r.pv_diario || 0;
}
const sortedDates = Object.keys(pvByDate).sort();
let acum = 0;
const pvCurve = sortedDates.map(fecha => {
  acum += pvByDate[fecha];
  return {
    date: fecha,
    pvDaily: Math.round(pvByDate[fecha] * 100) / 100,
    pvCumulative: Math.round(acum * 100) / 100
  };
});

// Write files
const dataDir = path.join(ROOT, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(path.join(dataDir, 'pv-curve.json'), JSON.stringify(pvCurve, null, 2));
console.log(`✓ data/pv-curve.json: ${pvCurve.length} fechas, PV total: ${acum.toFixed(2)}`);

fs.writeFileSync(path.join(dataDir, 'pv-edt-data.json'), JSON.stringify({
  edt: edtItems,
  plannedValues
}, null, 2));
console.log(`✓ data/pv-edt-data.json: ${edtItems.length} EDT items, ${plannedValues.length} planned values`);

// Generate resources JSON from BD_RRHH
if (resources.length > 0) {
  const resourceItems = resources.map(r => ({
    id: r.codigo,
    name: r.nombre,
    type: r.tipo,
    unit: r.unidad,
    unitCost: r.costo_unitario
  }));
  fs.writeFileSync(path.join(dataDir, 'resources.json'), JSON.stringify(resourceItems, null, 2));
  console.log(`✓ data/resources.json: ${resourceItems.length} recursos`);
}

// Also generate a compact version for the app bundle fallback
const compact = {
  dates: pvCurve.map(d => d.date),
  pvDaily: pvCurve.map(d => d.pvDaily),
  pvCumulative: pvCurve.map(d => d.pvCumulative)
};
fs.writeFileSync(path.join(dataDir, 'pv-curve-compact.json'), JSON.stringify(compact));
console.log('✓ data/pv-curve-compact.json (compact format)');

// 7. Generate per-chapter PV data
const activityToChapter = {};
const chapterNames = {};

for (const r of edtRaw) {
  if (r.nivel_wbs === 1) {
    chapterNames[r.edt_id] = r.edt_nombre;
  } else if (r.nivel_wbs === 2) {
    if (chapterNames[r.padre_id]) {
      activityToChapter[r.actividad_id] = chapterNames[r.padre_id];
    }
  }
}

const dailyByChapter = {};
for (const ch of Object.values(chapterNames)) {
  dailyByChapter[ch] = {};
}
for (const f of sortedDates) {
  for (const ch of Object.values(chapterNames)) {
    dailyByChapter[ch][f] = 0;
  }
}

for (const r of metRaw) {
  const chName = activityToChapter[r.id_wbs];
  if (chName && r.fecha && dailyByChapter[chName]) {
    dailyByChapter[chName][r.fecha] += r.pv_diario || 0;
  }
}

const pvByChapter = Object.entries(chapterNames).map(([id, name]) => {
  let cum = 0;
  const points = sortedDates.map(f => {
    cum += dailyByChapter[name][f] || 0;
    return { date: f, pvCumulative: Math.round(cum * 100) / 100 };
  });
  return { code: name, totalBudget: 0, points };
});

fs.writeFileSync(path.join(dataDir, 'pv-by-chapter.json'), JSON.stringify(pvByChapter, null, 2));
console.log(`✓ data/pv-by-chapter.json: ${pvByChapter.length} capítulos`);

// Copy to public/ for GitHub Pages
const publicDir = path.join(ROOT, 'public', 'data');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'pv-by-chapter.json'), JSON.stringify(pvByChapter, null, 2));
console.log('✓ public/data/pv-by-chapter.json (copied for GitHub Pages)');

// Copy resources to public/ if generated
const resourcesFile = path.join(dataDir, 'resources.json');
if (fs.existsSync(resourcesFile)) {
  const resContent = fs.readFileSync(resourcesFile, 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'resources.json'), resContent);
  console.log('✓ public/data/resources.json (copied for GitHub Pages)');
}
