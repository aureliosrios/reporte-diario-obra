const XLSX = require('xlsx');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const CHAPTER_CODES = {
  'Obras Preliminares': 'OBR-PRE',
  'Cimentación': 'CIM',
  'Estructura': 'EST',
  'Albañilería': 'ALB',
  'Instalaciones': 'INS',
  'Acabados': 'ACA',
  'Obras Exteriores': 'OBR-EXT'
};

// === 1. Update BD_EDT.xlsx ===
const edtPath = path.join(ROOT, 'BD_EDT.xlsx');
const wbEdt = XLSX.readFile(edtPath);
const wsName = wbEdt.SheetNames[0];
const ws = wbEdt.Sheets[wsName];
const edtData = XLSX.utils.sheet_to_json(ws, { defval: '' });

const updatedEdt = edtData.map(r => {
  const row = {};
  Object.keys(r).forEach(k => { row[k] = r[k]; });
  if (r.nivel_wbs === 1) {
    row.codigo = CHAPTER_CODES[r.edt_nombre] || '';
  } else if (r.nivel_wbs === 2) {
    const parentRow = edtData.find(p => p.edt_id === r.padre_id && p.nivel_wbs === 1);
    const chCode = parentRow ? (CHAPTER_CODES[parentRow.edt_nombre] || '') : '';
    const parts = String(r.actividad_id).split('.');
    const seq = parts[1] ? parts[1].padStart(2, '0') : '01';
    row.codigo = chCode ? chCode + '-' + seq : '';
  } else {
    row.codigo = '';
  }
  return row;
});

const headerOrder = ['edt_id', 'edt_nombre', 'actividad_id', 'actividad_nombre', 'codigo', 'unidad', 'presupuesto_total', 'fecha_inicio', 'fecha_fin', 'nivel_wbs', 'padre_id'];
const newWs = XLSX.utils.json_to_sheet(updatedEdt, { header: headerOrder });
newWs['!cols'] = (ws['!cols'] || []).slice();
// Add column width for codigo in position 4 (0-indexed)
while (newWs['!cols'].length < 11) newWs['!cols'].push({});
newWs['!cols'][4] = { wch: 12 };

// Remove old sheet and add new one
delete wbEdt.Sheets[wsName];
const idx = wbEdt.SheetNames.indexOf(wsName);
if (idx >= 0) wbEdt.SheetNames.splice(idx, 1);
XLSX.utils.book_append_sheet(wbEdt, newWs, wsName);

XLSX.writeFile(wbEdt, edtPath);

// Verify
const checkWb = XLSX.readFile(edtPath);
const checkWs = checkWb.Sheets[checkWb.SheetNames[0]];
const checkData = XLSX.utils.sheet_to_json(checkWs, { defval: '' });
console.log('✓ BD_EDT.xlsx updated: ' + checkData.length + ' rows, columns: ' + Object.keys(checkData[0]).join(', '));
checkData.forEach(r => {
  if (r.nivel_wbs === 1) {
    console.log('  [N1] ' + r.codigo + ' - ' + r.edt_nombre);
  } else {
    console.log('  [N2] ' + r.codigo + ' - ' + r.actividad_nombre);
  }
});

// === 2. Create BD_RRHH.xlsx ===
const rrhhData = [
  { codigo: 'LH-CAP', nombre: 'Capataz de Edificación', tipo: 'mano_obra', unidad: 'Hora Hombre', costo_unitario: 28.0 },
  { codigo: 'LH-OPE', nombre: 'Operario Civil', tipo: 'mano_obra', unidad: 'Hora Hombre', costo_unitario: 22.5 },
  { codigo: 'LH-OFI', nombre: 'Oficial Carpintero/Fierrero', tipo: 'mano_obra', unidad: 'Hora Hombre', costo_unitario: 18.0 },
  { codigo: 'LH-PEO', nombre: 'Peón de Construcción', tipo: 'mano_obra', unidad: 'Hora Hombre', costo_unitario: 14.5 },
  { codigo: 'MAT-CEM', nombre: 'Cemento Portland Tipo I (Bolsa 42.5kg)', tipo: 'material', unidad: 'Bolsa', costo_unitario: 8.9 },
  { codigo: 'MAT-ARE', nombre: 'Arena Gruesa', tipo: 'material', unidad: 'm3', costo_unitario: 24.0 },
  { codigo: 'MAT-LAD', nombre: 'Ladrillo King Kong Arcilla Cocida 18H', tipo: 'material', unidad: 'Millar', costo_unitario: 320.0 },
  { codigo: 'EQ-MEZ', nombre: 'Mezcladora de Concreto Trompo 9p3', tipo: 'equipo', unidad: 'Hora Máquina', costo_unitario: 12.0 },
  { codigo: 'EQ-RET', nombre: 'Retroexcavadora Oruga CAT 320', tipo: 'equipo', unidad: 'Hora Máquina', costo_unitario: 48.0 }
];

const rrhhWs = XLSX.utils.json_to_sheet(rrhhData);
rrhhWs['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
const rrhhWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(rrhhWb, rrhhWs, 'Recursos');
XLSX.writeFile(rrhhWb, path.join(ROOT, 'BD_RRHH.xlsx'));
console.log('\n✓ BD_RRHH.xlsx created with ' + rrhhData.length + ' resources');
rrhhData.forEach(r => console.log('  ' + r.codigo + ' - ' + r.nombre + ' (' + r.tipo + ', S/ ' + r.costo_unitario + ')'));
