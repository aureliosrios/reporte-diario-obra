/**
 * scripts/generate-synthetic-db.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Generador automático de bases de datos sintéticas en Excel (.xlsx)
 * para un proyecto de edificación real de 30 actividades y 90 días de ejecución.
 *
 * Bases de datos generadas:
 *   1. BD_Presupuesto_EDT.xlsx
 *   2. BD_PV_Diario_EDT.xlsx
 *   3. BD_PV_CurvaS_Proyecto.xlsx
 *   4. BD_RRHH.xlsx
 *   5. BD_Almacen.xlsx
 *
 * Plazo del proyecto: 2026-06-01 al 2026-08-29 (90 días calendario)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Helper para redondear a 2 decimales
const r2 = v => Math.round(v * 100) / 100;

// Helper para parsear fecha YYYY-MM-DD a objeto Date (local)
function parseDate(dStr) {
  const parts = dStr.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

// Helper para formatear Date a YYYY-MM-DD
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Obtener todas las fechas en un rango (ambas inclusive)
function getDatesInRange(startStr, endStr) {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  const dates = [];
  let curr = new Date(start);
  while (curr <= end) {
    dates.push(formatDate(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEFINICIÓN DE LOS CAPÍTULOS Y LAS 30 PARTIDAS HOJA
// ─────────────────────────────────────────────────────────────────────────────

const chapters = [
  { edt_id: 1, codigo: 'OBR-PRE', edt_nombre: 'Obras Preliminares y Provisionales', padre_id: '' },
  { edt_id: 2, codigo: 'MOV-TIE', edt_nombre: 'Movimiento de Tierras', padre_id: '' },
  { edt_id: 3, codigo: 'EST-CON', edt_nombre: 'Estructuras de Concreto', padre_id: '' },
  { edt_id: 4, codigo: 'ARQ-ACAB', edt_nombre: 'Arquitectura y Acabados', padre_id: '' },
  { edt_id: 5, codigo: 'INS-SAN', edt_nombre: 'Instalaciones Sanitarias y Eléctricas', padre_id: '' },
];

const activities = [
  // 1. Obras Preliminares (OBR-PRE) - 4 actividades
  {
    actividad_id: '1.1',
    codigo: 'OBR-PRE-01',
    actividad_nombre: 'Limpieza de terreno manual',
    unidad: 'm2',
    metrado: 1500,
    pu: 6.00,
    inicio: '2026-06-01',
    fin: '2026-06-05',
    padre_id: 1
  },
  {
    actividad_id: '1.2',
    codigo: 'OBR-PRE-02',
    actividad_nombre: 'Trazo, nivelación y replanteo de zapatas',
    unidad: 'm2',
    metrado: 1500,
    pu: 8.00,
    inicio: '2026-06-02',
    fin: '2026-06-07',
    padre_id: 1
  },
  {
    actividad_id: '1.3',
    codigo: 'OBR-PRE-03',
    actividad_nombre: 'Cerco provisional de obra con madera',
    unidad: 'm',
    metrado: 240,
    pu: 50.00,
    inicio: '2026-06-01',
    fin: '2026-06-08',
    padre_id: 1
  },
  {
    actividad_id: '1.4',
    codigo: 'OBR-PRE-04',
    actividad_nombre: 'Construcción de almacén y oficina provisional',
    unidad: 'Global',
    metrado: 1,
    pu: 12000.00,
    inicio: '2026-06-01',
    fin: '2026-06-10',
    padre_id: 1
  },

  // 2. Movimiento de Tierras (MOV-TIE) - 4 actividades
  {
    actividad_id: '2.1',
    codigo: 'MOV-TIE-01',
    actividad_nombre: 'Excavación masiva con excavadora',
    unidad: 'm3',
    metrado: 1200,
    pu: 22.00,
    inicio: '2026-06-05',
    fin: '2026-06-12',
    padre_id: 2
  },
  {
    actividad_id: '2.2',
    codigo: 'MOV-TIE-02',
    actividad_nombre: 'Excavación manual de zanjas y vigas cimentación',
    unidad: 'm3',
    metrado: 180,
    pu: 45.00,
    inicio: '2026-06-07',
    fin: '2026-06-15',
    padre_id: 2
  },
  {
    actividad_id: '2.3',
    codigo: 'MOV-TIE-03',
    actividad_nombre: 'Relleno y compactado con vibradora',
    unidad: 'm3',
    metrado: 450,
    pu: 35.00,
    inicio: '2026-06-10',
    fin: '2026-06-18',
    padre_id: 2
  },
  {
    actividad_id: '2.4',
    codigo: 'MOV-TIE-04',
    actividad_nombre: 'Eliminación de desmonte c/volquete 15m3',
    unidad: 'm3',
    metrado: 1500,
    pu: 28.00,
    inicio: '2026-06-06',
    fin: '2026-06-20',
    padre_id: 2
  },

  // 3. Estructuras de Concreto (EST-CON) - 9 actividades
  {
    actividad_id: '3.1',
    codigo: 'EST-CON-01',
    actividad_nombre: 'Solado de concreto e=3" f\'c=100 kg/cm2',
    unidad: 'm2',
    metrado: 350,
    pu: 32.00,
    inicio: '2026-06-15',
    fin: '2026-06-20',
    padre_id: 3
  },
  {
    actividad_id: '3.2',
    codigo: 'EST-CON-02',
    actividad_nombre: 'Concreto f\'c=210 kg/cm2 premezclado zapatas',
    unidad: 'm3',
    metrado: 160,
    pu: 380.00,
    inicio: '2026-06-18',
    fin: '2026-06-26',
    padre_id: 3
  },
  {
    actividad_id: '3.3',
    codigo: 'EST-CON-03',
    actividad_nombre: 'Acero de refuerzo corrugado fy=4200 en zapatas',
    unidad: 'kg',
    metrado: 4500,
    pu: 5.50,
    inicio: '2026-06-16',
    fin: '2026-06-24',
    padre_id: 3
  },
  {
    actividad_id: '3.4',
    codigo: 'EST-CON-04',
    actividad_nombre: 'Concreto f\'c=280 kg/cm2 en columnas',
    unidad: 'm3',
    metrado: 85,
    pu: 420.00,
    inicio: '2026-06-25',
    fin: '2026-07-10',
    padre_id: 3
  },
  {
    actividad_id: '3.5',
    codigo: 'EST-CON-05',
    actividad_nombre: 'Encofrado y desencofrado metálico columnas',
    unidad: 'm2',
    metrado: 320,
    pu: 65.00,
    inicio: '2026-06-22',
    fin: '2026-07-08',
    padre_id: 3
  },
  {
    actividad_id: '3.6',
    codigo: 'EST-CON-06',
    actividad_nombre: 'Acero de refuerzo corrugado en columnas',
    unidad: 'kg',
    metrado: 6200,
    pu: 5.80,
    inicio: '2026-06-20',
    fin: '2026-07-06',
    padre_id: 3
  },
  {
    actividad_id: '3.7',
    codigo: 'EST-CON-07',
    actividad_nombre: 'Concreto f\'c=210 kg/cm2 en losas y vigas',
    unidad: 'm3',
    metrado: 120,
    pu: 410.00,
    inicio: '2026-07-10',
    fin: '2026-07-28',
    padre_id: 3
  },
  {
    actividad_id: '3.8',
    codigo: 'EST-CON-08',
    actividad_nombre: 'Encofrado y desencofrado de vigas y losas',
    unidad: 'm2',
    metrado: 580,
    pu: 55.00,
    inicio: '2026-07-05',
    fin: '2026-07-26',
    padre_id: 3
  },
  {
    actividad_id: '3.9',
    codigo: 'EST-CON-09',
    actividad_nombre: 'Acero de refuerzo en vigas y losas aligeradas',
    unidad: 'kg',
    metrado: 8800,
    pu: 5.80,
    inicio: '2026-07-08',
    fin: '2026-07-24',
    padre_id: 3
  },

  // 4. Arquitectura y Acabados (ARQ-ACAB) - 8 actividades
  {
    actividad_id: '4.1',
    codigo: 'ARQ-ACAB-01',
    actividad_nombre: 'Muros de ladrillo King Kong arcilla cocida',
    unidad: 'm2',
    metrado: 1100,
    pu: 75.00,
    inicio: '2026-07-15',
    fin: '2026-08-05',
    padre_id: 4
  },
  {
    actividad_id: '4.2',
    codigo: 'ARQ-ACAB-02',
    actividad_nombre: 'Tarrajeo frotachado de muros interiores',
    unidad: 'm2',
    metrado: 2400,
    pu: 22.00,
    inicio: '2026-07-20',
    fin: '2026-08-12',
    padre_id: 4
  },
  {
    actividad_id: '4.3',
    codigo: 'ARQ-ACAB-03',
    actividad_nombre: 'Tarrajeo fino en cielorrasos y vigas',
    unidad: 'm2',
    metrado: 850,
    pu: 26.00,
    inicio: '2026-07-22',
    fin: '2026-08-15',
    padre_id: 4
  },
  {
    actividad_id: '4.4',
    codigo: 'ARQ-ACAB-04',
    actividad_nombre: 'Contrapiso de concreto e=2" en ambientes',
    unidad: 'm2',
    metrado: 850,
    pu: 24.00,
    inicio: '2026-07-28',
    fin: '2026-08-18',
    padre_id: 4
  },
  {
    actividad_id: '4.5',
    codigo: 'ARQ-ACAB-05',
    actividad_nombre: 'Instalación de piso porcelanato pulido 60x60',
    unidad: 'm2',
    metrado: 800,
    pu: 85.00,
    inicio: '2026-08-01',
    fin: '2026-08-22',
    padre_id: 4
  },
  {
    actividad_id: '4.6',
    codigo: 'ARQ-ACAB-06',
    actividad_nombre: 'Pintura látex en muros interiores y columnas',
    unidad: 'm2',
    metrado: 2400,
    pu: 12.00,
    inicio: '2026-08-10',
    fin: '2026-08-25',
    padre_id: 4
  },
  {
    actividad_id: '4.7',
    codigo: 'ARQ-ACAB-07',
    actividad_nombre: 'Puertas de madera contraplacada con cerraduras',
    unidad: 'und',
    metrado: 32,
    pu: 450.00,
    inicio: '2026-08-08',
    fin: '2026-08-20',
    padre_id: 4
  },
  {
    actividad_id: '4.8',
    codigo: 'ARQ-ACAB-08',
    actividad_nombre: 'Ventanas de vidrio templado templado e=8mm',
    unidad: 'm2',
    metrado: 110,
    pu: 220.00,
    inicio: '2026-08-12',
    fin: '2026-08-24',
    padre_id: 4
  },

  // 5. Instalaciones Sanitarias y Eléctricas (INS-SAN) - 5 actividades
  {
    actividad_id: '5.1',
    codigo: 'INS-SAN-01',
    actividad_nombre: 'Redes de desagüe y ventilación PVC de 4"',
    unidad: 'm',
    metrado: 320,
    pu: 42.00,
    inicio: '2026-07-20',
    fin: '2026-08-10',
    padre_id: 5
  },
  {
    actividad_id: '5.2',
    codigo: 'INS-SAN-02',
    actividad_nombre: 'Tendido de tubería de agua fría y caliente PVC',
    unidad: 'm',
    metrado: 450,
    pu: 35.00,
    inicio: '2026-07-25',
    fin: '2026-08-15',
    padre_id: 5
  },
  {
    actividad_id: '5.3',
    codigo: 'INS-SAN-03',
    actividad_nombre: 'Tuberías PVC de luz empotradas en losa/muros',
    unidad: 'm',
    metrado: 950,
    pu: 18.00,
    inicio: '2026-07-22',
    fin: '2026-08-12',
    padre_id: 5
  },
  {
    actividad_id: '5.4',
    codigo: 'INS-SAN-04',
    actividad_nombre: 'Cableado eléctrico de cobre tipo NH-80',
    unidad: 'm',
    metrado: 2800,
    pu: 6.50,
    inicio: '2026-08-05',
    fin: '2026-08-22',
    padre_id: 5
  },
  {
    actividad_id: '5.5',
    codigo: 'INS-SAN-05',
    actividad_nombre: 'Montaje de aparatos sanitarios y grifería',
    unidad: 'jgo',
    metrado: 18,
    pu: 950.00,
    inicio: '2026-08-18',
    fin: '2026-08-29',
    padre_id: 5
  }
];

console.log(`[SYNTHETIC DB GENERATOR] Cargadas ${activities.length} partidas de edificación.`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONSTRUIR BD_Presupuesto_EDT.xlsx
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1/5] Construyendo BD_Presupuesto_EDT.xlsx …');

// Calcular presupuestos totales por capítulo sumando sus hijos
const chapterBudgets = {};
chapters.forEach(ch => {
  const children = activities.filter(act => act.padre_id === ch.edt_id);
  const sum = children.reduce((acc, act) => acc + (act.metrado * act.pu), 0);
  chapterBudgets[ch.edt_id] = sum;
  console.log(`     Capítulo [${ch.codigo}] "${ch.edt_nombre}": S/ ${sum.toLocaleString()}`);
});

const budgetRows = [];
let consecutiveEdtId = 1;

// Mapear capítulos y partidas al formato del presupuesto
chapters.forEach(ch => {
  const chId = consecutiveEdtId++;
  const chBudget = chapterBudgets[ch.edt_id];
  
  // Agregar fila de Capítulo (Nivel WBS = 1)
  budgetRows.push({
    edt_id: chId,
    edt_nombre: ch.edt_nombre,
    actividad_id: '',
    actividad_nombre: '',
    codigo: ch.codigo,
    unidad: 'Global',
    metrado_total_planificado: '',
    precio_unitario: '',
    precio_parcial: '',
    presupuesto_total: chBudget,
    fecha_inicio: '',
    fecha_fin: '',
    nivel_wbs: 1,
    padre_id: ''
  });

  // Agregar partidas de este capítulo (Nivel WBS = 2)
  const chChildren = activities.filter(act => act.padre_id === ch.edt_id);
  chChildren.forEach(act => {
    const actBudget = r2(act.metrado * act.pu);
    budgetRows.push({
      edt_id: consecutiveEdtId++,
      edt_nombre: '',
      actividad_id: act.actividad_id,
      actividad_nombre: act.actividad_nombre,
      codigo: act.codigo,
      unidad: act.unidad,
      metrado_total_planificado: act.metrado,
      precio_unitario: act.pu,
      precio_parcial: actBudget,
      presupuesto_total: actBudget,
      fecha_inicio: act.inicio,
      fecha_fin: act.fin,
      nivel_wbs: 2,
      padre_id: chId
    });
  });
});

const wbBudget = XLSX.utils.book_new();
const wsBudget = XLSX.utils.json_to_sheet(budgetRows);
XLSX.utils.book_append_sheet(wbBudget, wsBudget, 'Presupuesto');
XLSX.writeFile(wbBudget, path.join(ROOT, 'BD_Presupuesto_EDT.xlsx'));
console.log('  ✓ Creado BD_Presupuesto_EDT.xlsx');

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONSTRUIR BD_PV_Diario_EDT.xlsx Y BD_PV_CurvaS_Proyecto.xlsx (90 días)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2/5] Distribuyendo metrados diarios y calculando Planned Value (EVM) …');

const projectStartDate = '2026-06-01';
const projectEndDate = '2026-08-29';
const projectDates = getDatesInRange(projectStartDate, projectEndDate);
console.log(`     Rango del proyecto: ${projectStartDate} al ${projectEndDate} (${projectDates.length} días)`);

const pvDiarioRows = [];
const dailyProjectTotals = {}; // fecha -> pv_diario sumado
projectDates.forEach(f => { dailyProjectTotals[f] = 0; });

// Distribuir linealmente metrado para cada partida hoja
activities.forEach(act => {
  const actDates = getDatesInRange(act.inicio, act.fin);
  const duration = actDates.length;
  
  let metradoAcum = 0;
  let pvAcum = 0;

  for (let i = 0; i < duration; i++) {
    const isLast = (i === duration - 1);
    const date = actDates[i];
    
    // Distribución física: metrado diario
    let qtyDiaria = r2(act.metrado / duration);
    if (isLast) {
      qtyDiaria = r2(act.metrado - metradoAcum);
    }
    metradoAcum = r2(metradoAcum + qtyDiaria);

    // Distribución monetaria: PV diario
    let pvDiario = r2(qtyDiaria * act.pu);
    if (isLast) {
      pvDiario = r2(r2(act.metrado * act.pu) - pvAcum);
    }
    pvAcum = r2(pvAcum + pvDiario);

    // Sumar al total diario del proyecto para la curva S
    dailyProjectTotals[date] = r2(dailyProjectTotals[date] + pvDiario);

    pvDiarioRows.push({
      id_wbs: act.actividad_id,
      actividad_nombre: act.actividad_nombre,
      fecha: date,
      porcentaje_planificado_diario: r2(qtyDiaria / act.metrado),
      metrado_diario_planificado: qtyDiaria,
      metrado_acumulado_planificado: metradoAcum,
      pv_diario: pvDiario,
      pv_acumulado_actividad: pvAcum
    });
  }
});

// Guardar BD_PV_Diario_EDT.xlsx
const wbPvDiario = XLSX.utils.book_new();
const wsPvDiario = XLSX.utils.json_to_sheet(pvDiarioRows);
XLSX.utils.book_append_sheet(wbPvDiario, wsPvDiario, 'PV_Diario_EDT');
XLSX.writeFile(wbPvDiario, path.join(ROOT, 'BD_PV_Diario_EDT.xlsx'));
console.log('  ✓ Creado BD_PV_Diario_EDT.xlsx');

// Calcular Curva S acumulada agregada del proyecto completo
console.log('\n[3/5] Consolidando la Curva S global del proyecto …');
const curvaSRows = [];
let cumulativeProjectPv = 0;

projectDates.forEach(date => {
  const pvDiario = dailyProjectTotals[date] || 0;
  cumulativeProjectPv = r2(cumulativeProjectPv + pvDiario);
  
  curvaSRows.push({
    fecha: date,
    pv_diario: pvDiario,
    pv_acumulado: cumulativeProjectPv
  });
});

// Guardar BD_PV_CurvaS_Proyecto.xlsx
const wbCurvaS = XLSX.utils.book_new();
const wsCurvaS = XLSX.utils.json_to_sheet(curvaSRows);
XLSX.utils.book_append_sheet(wbCurvaS, wsCurvaS, 'CurvaS');
XLSX.writeFile(wbCurvaS, path.join(ROOT, 'BD_PV_CurvaS_Proyecto.xlsx'));
console.log('  ✓ Creado BD_PV_CurvaS_Proyecto.xlsx');

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONSTRUIR BD_RRHH.xlsx (Tarifas Reales de MO)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4/5] Creando catálogo maestro de personal (BD_RRHH.xlsx) …');

const rrhhRows = [
  { codigo: 'LH-CAP', nombre: 'Capataz de Edificación', tipo: 'mano_obra', unidad: 'Hora Hombre', costo_unitario: 28.00 },
  { codigo: 'LH-OPE', nombre: 'Operario de Obra Civil', tipo: 'mano_obra', unidad: 'Hora Hombre', costo_unitario: 22.50 },
  { codigo: 'LH-OFI', nombre: 'Oficial de Obra Civil', tipo: 'mano_obra', unidad: 'Hora Hombre', costo_unitario: 18.00 },
  { codigo: 'LH-PEO', nombre: 'Peón de Construcción', tipo: 'mano_obra', unidad: 'Hora Hombre', costo_unitario: 14.50 },
  { codigo: 'LH-SUP', nombre: 'Supervisor SST (Prevencionista)', tipo: 'mano_obra', unidad: 'Hora Hombre', costo_unitario: 35.00 }
];

const wbRrhh = XLSX.utils.book_new();
const wsRrhh = XLSX.utils.json_to_sheet(rrhhRows);
XLSX.utils.book_append_sheet(wbRrhh, wsRrhh, 'Recursos_MO');
XLSX.writeFile(wbRrhh, path.join(ROOT, 'BD_RRHH.xlsx'));
console.log('  ✓ Creado BD_RRHH.xlsx');

// ─────────────────────────────────────────────────────────────────────────────
// 5. CONSTRUIR BD_Almacen.xlsx (Catálogo de Materiales y Maquinaria)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5/5] Creando catálogo maestro de almacén y equipos (BD_Almacen.xlsx) …');

const almacenRows = [
  // Materiales
  { id_recurso: 'MAT-CEM', descripcion: 'Cemento Portland Tipo I (bolsa 42.5kg)', tipo: 'material', unidad: 'Bolsa', precio_unitario_real: 24.50 },
  { id_recurso: 'MAT-ACE', descripcion: 'Acero de refuerzo corrugado fy=4200 kg/cm2', tipo: 'material', unidad: 'kg', precio_unitario_real: 4.80 },
  { id_recurso: 'MAT-ARE', descripcion: 'Arena gruesa para mezclas', tipo: 'material', unidad: 'm3', precio_unitario_real: 65.00 },
  { id_recurso: 'MAT-PIE', descripcion: 'Piedra chancada de 1/2"', tipo: 'material', unidad: 'm3', precio_unitario_real: 72.00 },
  { id_recurso: 'MAT-LAD', descripcion: 'Ladrillo King Kong arcilla 18 huecos', tipo: 'material', unidad: 'Millar', precio_unitario_real: 850.00 },
  { id_recurso: 'MAT-POR', descripcion: 'Porcelanato pulido premium 60x60cm', tipo: 'material', unidad: 'm2', precio_unitario_real: 45.00 },
  { id_recurso: 'MAT-PUE', descripcion: 'Puerta contraplacada de cedro c/marco', tipo: 'material', unidad: 'und', precio_unitario_real: 350.00 },
  { id_recurso: 'MAT-VID', descripcion: 'Vidrio templado e=8mm c/perfilerías', tipo: 'material', unidad: 'm2', precio_unitario_real: 150.00 },
  { id_recurso: 'MAT-DES', descripcion: 'Tubería PVC Sanitaria pesada de 4"', tipo: 'material', unidad: 'm', precio_unitario_real: 12.50 },
  { id_recurso: 'MAT-AGU', descripcion: 'Tubería PVC agua fría de 1/2"', tipo: 'material', unidad: 'm', precio_unitario_real: 8.50 },
  
  // Equipos / Maquinarias
  { id_recurso: 'EQ-MEZ', descripcion: 'Mezcladora de concreto trompo 9p3', tipo: 'equipo', unidad: 'Hora Máquina', precio_unitario_real: 15.00 },
  { id_recurso: 'EQ-VIB', descripcion: 'Vibradora de concreto naftera 2"', tipo: 'equipo', unidad: 'Hora Máquina', precio_unitario_real: 8.50 },
  { id_recurso: 'EQ-RET', descripcion: 'Retroexcavadora CAT 320 Orugas', tipo: 'equipo', unidad: 'Hora Máquina', precio_unitario_real: 55.00 },
  { id_recurso: 'EQ-VOL', descripcion: 'Camión Volquete Volvo 15m3', tipo: 'equipo', unidad: 'Hora Máquina', precio_unitario_real: 42.00 },
  { id_recurso: 'EQ-AND', descripcion: 'Andamio multidireccional normado (cuerpo)', tipo: 'equipo', unidad: 'Día', precio_unitario_real: 6.00 }
];

const wbAlmacen = XLSX.utils.book_new();
const wsAlmacen = XLSX.utils.json_to_sheet(almacenRows);
XLSX.utils.book_append_sheet(wbAlmacen, wsAlmacen, 'Materiales_Equipos');
XLSX.writeFile(wbAlmacen, path.join(ROOT, 'BD_Almacen.xlsx'));
console.log('  ✓ Creado BD_Almacen.xlsx');

// ─────────────────────────────────────────────────────────────────────────────
// 6. CONSTRUIR BD_Proyecto.xlsx (Metadatos Generales del Proyecto)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[6/6] Creando metadatos generales del proyecto (BD_Proyecto.xlsx) …');

const proyectoRows = [
  { Propiedad: 'Código de Proyecto', Valor: 'MFG-01' },
  { Propiedad: 'Nombre del Proyecto', Valor: 'Edificio Multifamiliar Girasoles' },
  { Propiedad: 'Empresa Constructora', Valor: 'Constructora Aurelio Rios S.A.C.' },
  { Propiedad: 'Cliente', Valor: 'Inmobiliaria Los Parques S.A.' },
  { Propiedad: 'Ubicación', Valor: 'San Isidro, Lima, Perú' },
  { Propiedad: 'Gerente de Obra', Valor: 'Ing. Alejandro Rivas' },
  { Propiedad: 'Supervisor de Obra', Valor: 'Ing. Claudia Mendoza' }
];



const wbProyecto = XLSX.utils.book_new();
const wsProyecto = XLSX.utils.json_to_sheet(proyectoRows);
XLSX.utils.book_append_sheet(wbProyecto, wsProyecto, 'Proyecto');
XLSX.writeFile(wbProyecto, path.join(ROOT, 'BD_Proyecto.xlsx'));
console.log('  ✓ Creado BD_Proyecto.xlsx');

// Calcular y mostrar BAC final
const finalBAC = chapters.reduce((acc, ch) => acc + chapterBudgets[ch.edt_id], 0);
console.log(`\n✅ PROCESO COMPLETADO EXITOSAMENTE.`);
console.log(`   BAC Total del Proyecto: S/ ${finalBAC.toLocaleString()}`);
console.log(`   Curva S Final Acumulada: S/ ${cumulativeProjectPv.toLocaleString()}`);
console.log(`   La diferencia de balanceo es: S/ ${r2(finalBAC - cumulativeProjectPv).toFixed(2)}\n`);


