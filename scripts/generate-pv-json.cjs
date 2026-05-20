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

// 3. Generate EDT items (matching EdtItem interface)
const edtItems = edtRaw.map(r => ({
  code: r.nivel_wbs === 1 ? String(r.edt_id) : String(r.actividad_id),
  parentId: r.nivel_wbs === 1 ? null : String(r.padre_id),
  name: r.nivel_wbs === 1 ? r.edt_nombre : r.actividad_nombre,
  unit: r.unidad || 'Global',
  totalBudgetQty: r.nivel_wbs === 2 ? (r.presupuesto_total || 0) : 1,
  unitPrice: r.nivel_wbs === 2 ? (r.presupuesto_total > 0 ? 1 : 0) : 0
}));

// 4. Generate Planned Values (matching PlannedValue interface)
const plannedValues = metRaw.map(r => ({
  date: r.fecha,
  edtCode: String(r.id_wbs),
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

// 6. Generate backup EDT with synthetic codes for backward compat
const CHAPTER_MAP = {
  '1': { code: 'OBR-PRE', name: 'Obras Preliminares' },
  '2': { code: 'CIM', name: 'Cimentación' },
  '3': { code: 'EST', name: 'Estructura' },
  '4': { code: 'ALB', name: 'Albañilería' },
  '5': { code: 'INST', name: 'Instalaciones' },
  '6': { code: 'ACAB', name: 'Acabados' },
  '7': { code: 'OBR-EXT', name: 'Obras Exteriores' }
};

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

// Also generate a compact version for the app bundle fallback
const compact = {
  dates: pvCurve.map(d => d.date),
  pvDaily: pvCurve.map(d => d.pvDaily),
  pvCumulative: pvCurve.map(d => d.pvCumulative)
};
fs.writeFileSync(path.join(dataDir, 'pv-curve-compact.json'), JSON.stringify(compact));
console.log('✓ data/pv-curve-compact.json (compact format)');
