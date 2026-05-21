/**
 * Script: generar base de datos sintética para Google Sheets
 *
 * Lee los archivos data/ existentes (pv-edt-data.json, resources.json, project.json)
 * y genera 30+ días de reportes sintéticos coherentes con el PV programado.
 *
 * Output: scripts/synthetic-sheets-output.json  (estructura por pestañas)
 *         scripts/synthetic-sheets-output.csv    (archivos individuales)
 */

const fs = require("fs");
const path = require("path");

// ─── 1. Cargar datos fuente ─────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_DIR = __dirname;

const project = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "project.json"), "utf-8"));
const pvEdt = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "pv-edt-data.json"), "utf-8"));
const resources = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "resources.json"), "utf-8"));

const edtList = pvEdt.edt;
const plannedValues = pvEdt.plannedValues;
const bac = pvEdt.bac;

// ─── 2. Construir lookup helpers ────────────────────────────────────────────
const edtMap = {};
edtList.forEach(e => { edtMap[e.code] = e; });

const chapters = edtList.filter(e => e.parentId === null);
const chapterMap = {};
chapters.forEach(ch => { chapterMap[ch.code] = ch; });

// Agrupar partidas hijas por capítulo
const activitiesByChapter = {};
edtList.forEach(e => {
  if (e.parentId && chapterMap[e.parentId]) {
    if (!activitiesByChapter[e.parentId]) activitiesByChapter[e.parentId] = [];
    activitiesByChapter[e.parentId].push(e);
  }
});

// Recurso lookup
const resourceMap = {};
resources.forEach(r => { resourceMap[r.id] = r; });

// Agrupar PV por fecha
const pvByDate = {};
plannedValues.forEach(pv => {
  if (!pvByDate[pv.date]) pvByDate[pv.date] = {};
  pvByDate[pv.date][pv.edtCode] = pv.plannedQty;
});

// ─── 3. Determinar fechas del proyecto ──────────────────────────────────────
const allDates = Object.keys(pvByDate).sort();
const START_DATE = allDates[0]; // "2026-06-01"
const END_DATE = allDates[allDates.length - 1]; // ~"2026-06-30"

console.log(`Proyecto: ${project.name}`);
console.log(`Rango de fechas: ${START_DATE} → ${END_DATE}`);
console.log(`Capítulos: ${chapters.map(c => c.code).join(", ")}`);

// ─── 4. Para cada fecha, determinar qué capítulos están activos ─────────────
function getActiveChapters(dateStr) {
  const dayPV = pvByDate[dateStr];
  if (!dayPV) return [];

  const activeCodes = new Set();
  Object.keys(dayPV).forEach(edtCode => {
    const edt = edtMap[edtCode];
    if (edt && edt.parentId && chapterMap[edt.parentId]) {
      activeCodes.add(edt.parentId);
    }
  });
  return Array.from(activeCodes).sort();
}

function getActivitiesForChapter(dateStr, chapterCode) {
  const dayPV = pvByDate[dateStr];
  if (!dayPV) return [];

  const chapterItems = activitiesByChapter[chapterCode] || [];
  return chapterItems
    .filter(item => dayPV[item.code] !== undefined && dayPV[item.code] > 0)
    .map(item => ({
      code: item.code,
      name: item.name,
      unit: item.unit,
      unitPrice: item.unitPrice,
      plannedQty: dayPV[item.code]
    }));
}

// ─── 5. Generadores de variación realista ────────────────────────────────────
function rng(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Factores de performance (desviación respecto al PV)
// Días 1-5: ~85-100%  (ramp-up)
// Días 6-15: ~90-110% (steady)
// Días 16-25: ~95-105% (mature)
// Días 26-30: ~90-100% (wind-down)
function getPerformanceFactor(dayIndex, totalDays) {
  const pct = dayIndex / totalDays;
  if (pct < 0.15) return 0.85 + Math.random() * 0.15;     // ramp-up
  if (pct < 0.5) return 0.90 + Math.random() * 0.20;       // steady
  if (pct < 0.85) return 0.93 + Math.random() * 0.12;      // mature
  return 0.88 + Math.random() * 0.12;                       // wind-down
}

// Estados de clima
const weatherOptions = [
  { am: "Soleado", pm: "Soleado" },
  { am: "Soleado", pm: "Nublado" },
  { am: "Nublado", pm: "Nublado" },
  { am: "Nublado", pm: "Lluvia" },
  { am: "Soleado", pm: "Soleado" },
];

// Escenarios de restricciones (algunos días con problemas)
function getScenario(dayIndex, totalDays) {
  // Día de lluvia fuerte en día 7
  if (dayIndex === 6) return "rain";
  // Día de incidente de seguridad en día 12
  if (dayIndex === 11) return "incident";
  // Día de huelga/retraso en día 18
  if (dayIndex === 17) return "strike";
  // Día de alta productividad en día 22
  if (dayIndex === 21) return "high";
  return "normal";
}

// ─── 6. Generar reportes ────────────────────────────────────────────────────
const allReports = [];
const allActivities = [];
const allResources = [];

const dateList = allDates.slice(0, 30); // solo primeros 30 días
let reportCounter = 1;

dateList.forEach((dateStr, dayIndex) => {
  const activeChapters = getActiveChapters(dateStr);
  if (activeChapters.length === 0) return;

  const scenario = getScenario(dayIndex, dateList.length);

  // Determinar condiciones del día
  let weatherAM, weatherPM, effectiveHours, conflictsText, nextDayText, observationsText;

  switch (scenario) {
    case "rain":
      weatherAM = "Nublado";
      weatherPM = "Lluvia";
      effectiveHours = 4;
      conflictsText = "Lluvia intensa en la tarde. Trabajos suspendidos desde las 14:00.";
      nextDayText = "Recuperación de jornada. Trabajos planificados en Estructuras.";
      observationsText = "Paralización parcial por condiciones climáticas adversas.";
      break;
    case "incident":
      weatherAM = "Soleado";
      weatherPM = "Nublado";
      effectiveHours = 7;
      conflictsText = "Incidente leve: resbalón de peón en zona de excavación. Atención en primeros auxilios.";
      nextDayText = "Charla de seguridad reforzada. Continuar con acero de columnas.";
      observationsText = "Se reportó incidente sin baja laboral. Se reforzaron medidas de seguridad.";
      break;
    case "strike":
      weatherAM = "Soleado";
      weatherPM = "Soleado";
      effectiveHours = 5;
      conflictsText = "Paro de 2 horas por reunión sindical. Menor rendimiento en la jornada.";
      nextDayText = "Normalización de actividades. Se programarán horas extras compensatorias.";
      observationsText = "Retraso por medida de fuerza gremial.";
      break;
    case "high":
      weatherAM = "Soleado";
      weatherPM = "Soleado";
      effectiveHours = 10;
      conflictsText = "Ninguno. Jornada extendida autorizada para recuperar cronograma.";
      nextDayText = "Continuar con instalación de pisos y acabados.";
      observationsText = "Alta productividad. Se superó la meta diaria en acabados.";
      break;
    default: // normal
      const w = pickRandom(weatherOptions);
      weatherAM = w.am;
      weatherPM = w.pm;
      effectiveHours = weatherPM === "Lluvia" ? 6 : 8;
      conflictsText = "Sin restricciones mayores.";
      nextDayText = "Continuar con actividades programadas según plan de obra.";
      observationsText = "Jornada normal. Avance conforme al programa.";
      break;
  }

  const perfFactor = getPerformanceFactor(dayIndex, dateList.length);

  // ── Para cada capítulo activo, generar un reporte de PRODUCCIÓN ──
  activeChapters.forEach(chapterCode => {
    const chapter = chapterMap[chapterCode];
    const chapterActivities = getActivitiesForChapter(dateStr, chapterCode);
    if (chapterActivities.length === 0) return;

    const reportId = `REP-SYN-${String(reportCounter).padStart(4, "0")}`;
    reportCounter++;

    const dayActivities = chapterActivities.map(act => {
      const executed = Math.round(act.plannedQty * perfFactor * (0.85 + Math.random() * 0.30));
      const notesOptions = [
        "Trabajo conforme a especificaciones técnicas.",
        "Avance normal sin observaciones.",
        "Cuadrilla completa rindiendo según lo programado.",
        "Supervisión aprobó los trabajos ejecutados.",
      ];
      return {
        edtCode: act.code,
        name: act.name,
        unit: act.unit,
        plannedQty: act.plannedQty,
        qtyExecuted: Math.max(0, executed),
        notes: pickRandom(notesOptions)
      };
    });

    // Personal en obra: escalar según capítulo
    const baseStaff = chapterCode === "OBR-PRE" ? 8 :
                      chapterCode === "MOV-TIE" ? 12 :
                      chapterCode === "EST-CON" ? 25 :
                      chapterCode === "ARQ-ACAB" ? 20 :
                      chapterCode === "INS-SAN" ? 10 : 15;
    const totalStaff = Math.round(baseStaff * (0.8 + Math.random() * 0.4));

    // Mano de obra
    const moTemplates = {
      "OBR-PRE":  ["LH-CAP", "LH-OPE", "LH-PEO"],
      "MOV-TIE":  ["LH-CAP", "LH-OPE", "LH-PEO"],
      "EST-CON":  ["LH-CAP", "LH-OPE", "LH-OFI", "LH-PEO"],
      "ARQ-ACAB": ["LH-CAP", "LH-OFI", "LH-PEO"],
      "INS-SAN":  ["LH-CAP", "LH-OFI", "LH-PEO"],
    };
    const moIds = moTemplates[chapterCode] || ["LH-CAP", "LH-PEO"];
    const manoObra = moIds.map(id => ({
      resourceId: id,
      name: resourceMap[id]?.name || id,
      quantity: Math.max(1, Math.round(rng(1, 4))),
      hoursWorked: Math.round(effectiveHours * rng(0.9, 1.1)),
      edtGroupCode: chapterCode
    }));

    // Materiales (según capítulo)
    const materialTemplates = {
      "EST-CON": [
        { id: "MAT-CEM", qty: () => rng(10, 60) },
        { id: "MAT-ACE", qty: () => rng(100, 400) },
        { id: "MAT-ARE", qty: () => rng(1, 4) },
        { id: "MAT-PIE", qty: () => rng(1, 4) },
      ],
      "ARQ-ACAB": [
        { id: "MAT-LAD", qty: () => rng(0.5, 2.5) },
        { id: "MAT-CEM", qty: () => rng(5, 20) },
        { id: "MAT-POR", qty: () => rng(15, 50) },
      ],
      "INS-SAN": [
        { id: "MAT-DES", qty: () => rng(10, 30) },
        { id: "MAT-AGU", qty: () => rng(10, 30) },
      ],
      "OBR-PRE": [
        { id: "MAT-CEM", qty: () => rng(2, 8) },
      ],
      "MOV-TIE": [],
    };
    const matTpl = materialTemplates[chapterCode] || [];
    const materials = matTpl.map(m => ({
      resourceId: m.id,
      name: resourceMap[m.id]?.name || m.id,
      qtyConsumed: Math.round(m.qty() * 100) / 100,
      edtGroupCode: chapterCode
    }));

    // Equipos (según capítulo)
    const equipoTemplates = {
      "MOV-TIE":  [{ id: "EQ-RET", qty: () => effectiveHours * rng(0.8, 1.0) }, { id: "EQ-VOL", qty: () => effectiveHours * rng(0.5, 0.8) }],
      "EST-CON":  [{ id: "EQ-MEZ", qty: () => effectiveHours * rng(0.7, 1.0) }, { id: "EQ-VIB", qty: () => effectiveHours * rng(0.6, 0.9) }],
      "ARQ-ACAB": [{ id: "EQ-AND", qty: () => Math.round(rng(2, 6)) }],
      "INS-SAN":  [],
      "OBR-PRE":  [{ id: "EQ-RET", qty: () => effectiveHours * rng(0.3, 0.6) }],
    };
    const eqTpl = equipoTemplates[chapterCode] || [];
    const equipos = eqTpl.map(e => ({
      resourceId: e.id,
      name: resourceMap[e.id]?.name || e.id,
      qtyUsed: Math.round(e.qty() * 100) / 100,
      edtGroupCode: chapterCode
    }));

    // Reporte de producción
    const report = {
      reportType: "produccion",
      id: reportId,
      projectCode: project.code,
      date: dateStr,
      chapter: chapterCode,
      shift: "Mañana",
      effectiveHours,
      supervisor: project.manager,
      weatherMorning: weatherAM,
      weatherAfternoon: weatherPM,
      totalStaff,
      activities: dayActivities,
      manoObra,
      materials,
      equipos,
      safetyInspected: true,
      safetyDetails: "Inspección de rutina realizada. EPPs completos.",
      incidents: "Ninguno",
      conflicts: conflictsText,
      plannedNextDay: nextDayText,
      generalNotes: observationsText,
    };

    allReports.push(report);

    // Aplanar actividades para la pestaña Actividades
    dayActivities.forEach(act => {
      allActivities.push({
        reportId,
        date: dateStr,
        chapterCode,
        edtCode: act.edtCode,
        name: act.name,
        unit: act.unit,
        plannedQty: act.plannedQty,
        qtyExecuted: act.qtyExecuted,
        notes: act.notes
      });
    });

    // Aplanar recursos para la pestaña Recursos
    manoObra.forEach(mo => {
      allResources.push({
        reportId,
        date: dateStr,
        chapterCode,
        resourceType: "Mano de Obra",
        resourceId: mo.resourceId,
        resourceName: mo.name,
        quantity: (mo.quantity || 1) * mo.hoursWorked,
        unit: "Hora Hombre",
        unitCost: resourceMap[mo.resourceId]?.unitCost || 0
      });
    });
    materials.forEach(mat => {
      allResources.push({
        reportId,
        date: dateStr,
        chapterCode,
        resourceType: "Material",
        resourceId: mat.resourceId,
        resourceName: mat.name,
        quantity: mat.qtyConsumed,
        unit: resourceMap[mat.resourceId]?.unit || "und",
        unitCost: resourceMap[mat.resourceId]?.unitCost || 0
      });
    });
    equipos.forEach(eq => {
      allResources.push({
        reportId,
        date: dateStr,
        chapterCode,
        resourceType: "Equipo",
        resourceId: eq.resourceId,
        resourceName: eq.name,
        quantity: eq.qtyUsed,
        unit: resourceMap[eq.resourceId]?.unit || "Hora",
        unitCost: resourceMap[eq.resourceId]?.unitCost || 0
      });
    });
  });

  // ── Reporte de SEGURIDAD (1 por día) ──
  const safetyId = `REP-SYN-S-${String(dateList.indexOf(dateStr) + 1).padStart(3, "0")}`;
  const totalStaffAll = activeChapters.reduce((sum, ch) => {
    const baseStaff = ch === "OBR-PRE" ? 8 : ch === "MOV-TIE" ? 12 : ch === "EST-CON" ? 25 : ch === "ARQ-ACAB" ? 20 : ch === "INS-SAN" ? 10 : 15;
    return sum + Math.round(baseStaff * (0.8 + Math.random() * 0.4));
  }, 0);

  let safetyInspected = true;
  let safetyDetails = "Charla de 5 minutos dictada. Inspección de EPPs y áreas de trabajo conforme.";
  let incidents = "Ninguno";

  if (scenario === "incident") {
    safetyDetails = "Charla de seguridad reforzada post-incidente. Se revisaron protocolos.";
    incidents = "Resbalón de peón en rampa de acceso. Atención en primeros auxilios. Sin baja laboral.";
  }

  const safetyReport = {
    reportType: "seguridad",
    id: safetyId,
    projectCode: project.code,
    date: dateStr,
    shift: "Mañana",
    effectiveHours,
    supervisor: project.manager,
    weatherMorning: weatherAM,
    weatherAfternoon: weatherPM,
    totalStaff: totalStaffAll,
    safetyInspected,
    safetyDetails,
    incidents,
    conflicts: conflictsText,
    generalNotes: `Reporte integral de seguridad - ${observationsText}`,
  };

  allReports.push(safetyReport);
});

console.log(`\nGenerados ${allReports.length} reportes:`);
console.log(`  Producción: ${allReports.filter(r => r.reportType === "produccion").length}`);
console.log(`  Seguridad: ${allReports.filter(r => r.reportType === "seguridad").length}`);
console.log(`  Actividades detalle: ${allActivities.length}`);
console.log(`  Recursos detalle: ${allResources.length}`);

// ─── 7. Generar estructura de pestañas para Google Sheets ──────────────────
// Encabezados de cada pestaña

const sheetsData = {
  metadata: {
    project: project.name,
    code: project.code,
    location: project.location,
    manager: project.manager,
    startDate: START_DATE,
    endDate: END_DATE,
    bac: bac,
    generatedAt: new Date().toISOString()
  },
  tabs: {
    Produccion: {
      headers: [
        "ReportID", "Fecha", "Capitulo", "Supervisor", "Turno",
        "HorasEfectivas", "ClimaAM", "ClimaPM", "PersonalTotal",
        "Conflictos", "PlanProximoDia", "Observaciones",
        "NumActividades", "NumMO", "NumMateriales", "NumEquipos"
      ],
      rows: allReports
        .filter(r => r.reportType === "produccion")
        .map(r => [
          r.id, r.date, r.chapter, r.supervisor, r.shift,
          r.effectiveHours, r.weatherMorning, r.weatherAfternoon, r.totalStaff,
          r.conflicts, r.plannedNextDay, r.generalNotes,
          r.activities.length, r.manoObra.length, r.materials.length, r.equipos.length
        ])
    },
    Seguridad: {
      headers: [
        "ReportID", "Fecha", "Supervisor", "Turno",
        "HorasEfectivas", "ClimaAM", "ClimaPM", "PersonalTotal",
        "InspeccionRealizada", "DetallesSeguridad", "Incidentes",
        "Conflictos", "Observaciones"
      ],
      rows: allReports
        .filter(r => r.reportType === "seguridad")
        .map(r => [
          r.id, r.date, r.supervisor, r.shift,
          r.effectiveHours, r.weatherMorning, r.weatherAfternoon, r.totalStaff,
          r.safetyInspected ? "Sí" : "No", r.safetyDetails, r.incidents,
          r.conflicts, r.generalNotes
        ])
    },
    Actividades: {
      headers: [
        "ReportID", "Fecha", "Capitulo", "CodigoEDT", "Actividad",
        "Unidad", "CantidadPlanificada", "CantidadEjecutada", "Notas"
      ],
      rows: allActivities.map(a => [
        a.reportId, a.date, a.chapterCode, a.edtCode, a.name,
        a.unit, a.plannedQty, a.qtyExecuted, a.notes
      ])
    },
    Recursos: {
      headers: [
        "ReportID", "Fecha", "Capitulo", "TipoRecurso",
        "CodigoRecurso", "Recurso", "Cantidad", "Unidad", "CostoUnitario"
      ],
      rows: allResources.map(r => [
        r.reportId, r.date, r.chapterCode, r.resourceType,
        r.resourceId, r.resourceName, r.quantity, r.unit, r.unitCost
      ])
    }
  }
};

// ─── 8. Generar CSV de cada pestaña ──────────────────────────────────────────
function toCsvRow(arr) {
  return arr.map(cell => {
    const str = String(cell ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(",");
}

function generateCsv(headers, rows) {
  const BOM = "\uFEFF";
  return BOM + [toCsvRow(headers), ...rows.map(r => toCsvRow(r))].join("\n");
}

const outputFiles = {};

Object.keys(sheetsData.tabs).forEach(tabName => {
  const tab = sheetsData.tabs[tabName];
  const csv = generateCsv(tab.headers, tab.rows);
  const filename = `synthetic-${tabName}.csv`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), csv, "utf-8");
  outputFiles[tabName] = filename;
  console.log(`  ✓ ${filename} (${tab.rows.length} filas)`);
});

// Guardar JSON completo también
const jsonPath = path.join(OUTPUT_DIR, "synthetic-sheets-output.json");
fs.writeFileSync(jsonPath, JSON.stringify(sheetsData, null, 2), "utf-8");
outputFiles.json = "synthetic-sheets-output.json";
console.log(`  ✓ synthetic-sheets-output.json`);

// ─── 9. Resumen final ────────────────────────────────────────────────────────
console.log(`\n✅ Base de datos sintética generada exitosamente.`);
console.log(`📁 Archivos en: ${OUTPUT_DIR}`);
console.log(`\n📊 Instrucciones para Google Sheets:`);
console.log(`   1. Abrir tu Google Sheet`);
console.log(`   2. Crear pestañas: Producción, Seguridad, Actividades, Recursos`);
console.log(`   3. En cada pestaña, Archivo → Importar → Subir → ${outputFiles.Produccion} (etc.)`);
console.log(`   4. Seleccionar "Reemplazar hoja actual"`);
