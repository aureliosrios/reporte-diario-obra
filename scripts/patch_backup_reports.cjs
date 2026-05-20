/**
 * patch_backup_reports.cjs
 * Reemplaza la función generate20DaysSyntheticReports en App.tsx
 * para usar los códigos reales del EDT del proyecto.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const appTsx = path.join(__dirname, '..', 'src', 'App.tsx');
let content  = fs.readFileSync(appTsx, 'utf-8');

const start = content.indexOf('const generate20DaysSyntheticReports');
const end   = content.indexOf('\nconst BACKUP_REPORTS');

if (start === -1 || end === -1) {
  console.error('No se encontraron los markers en App.tsx');
  process.exit(1);
}

const newFn = `const generate20DaysSyntheticReports = (): DailyReport[] => {
  const reports: DailyReport[] = [];
  const baseDate = new Date("2026-05-15");

  // Fases reales del cronograma EDT:
  //  Días 01-04: OBR-PRE - Obras Preliminares (OBR-PRE-01, OBR-PRE-02)
  //  Días 05-08: CIM     - Cimentación       (CIM-01 … CIM-04)
  //  Días 09-20: EST     - Estructura        (EST-01 … EST-05)

  for (let day = 0; day < 20; day++) {
    const currentDate  = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000);
    const dateString   = currentDate.toISOString().split("T")[0];
    const dateStrShort = dateString.replace(/-/g, "");
    const idReporte    = \`REP-MFG-\${dateStrShort}\`;

    let weatherMorning:   "Soleado"|"Nublado"|"Lluvia"|"Viento" = "Soleado";
    let weatherAfternoon: "Soleado"|"Nublado"|"Lluvia"|"Viento" = "Nublado";
    let effectiveHours = 8;
    let conflicts   = "Ninguno";
    let observations = "Avances conformes al programa diario de obra.";

    if (day === 5) {
      weatherMorning = "Nublado"; weatherAfternoon = "Lluvia";
      effectiveHours = 4;
      conflicts    = "Lluvia torrencial en la tarde. Trabajos paralizados a las 14:00.";
      observations = "Parada parcial por tormenta. Personal evacuado a refugios.";
    } else if (day >= 6 && day <= 11) {
      effectiveHours = 9.5;
      conflicts    = "Jornada extendida autorizada para recuperar avance.";
      observations = "1.5 horas extras ejecutadas. Productividad normalizada.";
    }

    // Capítulo EDT activo según fase real del cronograma
    const chapterWbsId = day < 4 ? "OBR-PRE" : day < 8 ? "CIM" : "EST";
    const totalStaff   = Math.round(18 + Math.random() * 8) + (day >= 6 && day <= 11 ? 4 : 0);

    let hseDetails    = "Inspección de EPPs y arneses conforme. Charla de 5 min realizada.";
    let safetyIncident = "Ninguno";
    if (day === 10) {
      hseDetails    = "Revisión de cables de andamio con observaciones menores.";
      safetyIncident = "Resbalón de peón en rampa de acceso. Primeros auxilios. Sin baja laboral.";
    }

    // ── Actividades ejecutadas (códigos EDT reales del proyecto) ──────────────
    const dayActivities: DailyReport["activities"] = [];

    if (day < 4) {
      // OBR-PRE: Obras Preliminares
      dayActivities.push({ edtCode: "OBR-PRE-01", name: "Trazos y niveles",    unit: "m2", plannedQty: 425, qtyExecuted: 390 - day * 5, notes: "Replanteo de ejes principales" });
      dayActivities.push({ edtCode: "OBR-PRE-02", name: "Limpieza del terreno", unit: "m2", plannedQty: 325, qtyExecuted: 310 - day * 5, notes: "Limpieza y retiro de residuos" });
    } else if (day < 8) {
      // CIM: Cimentación
      const d = day - 4;
      if (d === 0) dayActivities.push({ edtCode: "CIM-01", name: "Excavación masiva",            unit: "m3", plannedQty: 380,  qtyExecuted: 340,  notes: "Excavación de zanjas y zapatas" });
      if (d === 1) dayActivities.push({ edtCode: "CIM-01", name: "Excavación masiva",            unit: "m3", plannedQty: 380,  qtyExecuted: day === 5 ? 80 : 360, notes: day === 5 ? "Parálisis por lluvia" : "Recuperación con jornada extendida" });
      if (d === 2) dayActivities.push({ edtCode: "CIM-02", name: "Concreto de solado",           unit: "m3", plannedQty: 32,   qtyExecuted: 28,   notes: "Vaciado de solado de limpieza" });
      if (d === 3) {
        dayActivities.push({ edtCode: "CIM-03", name: "Encofrado de cimentación",     unit: "m2", plannedQty: 325,  qtyExecuted: 300,  notes: "Encofrado de zapatas" });
        dayActivities.push({ edtCode: "CIM-04", name: "Acero de refuerzo cimentación", unit: "kg", plannedQty: 3800, qtyExecuted: 3400, notes: "Habilitación y colocación de fierro" });
      }
    } else {
      // EST: Estructura
      const dEst = day - 8;
      if (dEst < 3) {
        dayActivities.push({ edtCode: "EST-01", name: "Encofrado de columnas",     unit: "m2", plannedQty: 235,  qtyExecuted: 200 + dEst * 10,  notes: "Encofrado de placas y columnas 1er piso" });
        dayActivities.push({ edtCode: "EST-02", name: "Acero de refuerzo columnas", unit: "kg", plannedQty: 2066, qtyExecuted: 1800 + dEst * 100, notes: "Habilitación y colocación de acero" });
      } else if (dEst < 7) {
        dayActivities.push({ edtCode: "EST-03", name: "Concreto de columnas", unit: "m3", plannedQty: 30, qtyExecuted: 25 + (dEst - 3) * 2, notes: "Vaciado concreto f\\'c=280 kg/cm2" });
      } else {
        dayActivities.push({ edtCode: "EST-04", name: "Encofrado de vigas y losas", unit: "m2", plannedQty: 339,  qtyExecuted: 300 + (dEst - 7) * 8,  notes: "Encofrado con tableros de fondo de losa" });
        dayActivities.push({ edtCode: "EST-05", name: "Acero de vigas y losas",    unit: "kg", plannedQty: 2907, qtyExecuted: 2600 + (dEst - 7) * 50, notes: "Colocación de acero en vigas principales" });
      }
    }

    // ── Recursos consumidos (IDs reales BD_RRHH) ─────────────────────────────
    const manoObra: DailyReport["manoObra"] = [
      { resourceId: "LH-CAP", name: "Capataz de Edificación", hoursWorked: effectiveHours,    edtGroupCode: chapterWbsId },
      { resourceId: "LH-OPE", name: "Operario Civil",         hoursWorked: effectiveHours * 4, edtGroupCode: chapterWbsId },
      { resourceId: "LH-PEO", name: "Peón de Construcción",   hoursWorked: effectiveHours * 8, edtGroupCode: chapterWbsId }
    ];
    const materials: DailyReport["materials"] = [];
    const equipos:   DailyReport["equipos"]   = [];

    if (chapterWbsId === "OBR-PRE") {
      equipos.push({ resourceId: "EQ-MEZ", name: "Mezcladora Trompo 9p3", qtyUsed: effectiveHours / 2, unit: "Hora Máquina", edtGroupCode: "OBR-PRE" });
    } else if (chapterWbsId === "CIM") {
      equipos.push({ resourceId: "EQ-RET", name: "Retroexcavadora Oruga CAT 320", qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "CIM" });
      if (day >= 6) {
        materials.push({ resourceId: "MAT-CEM", name: "Cemento Portland Tipo I",          qtyConsumed: 35, unit: "Bolsa",   edtGroupCode: "CIM" });
        materials.push({ resourceId: "MAT-ACE", name: "Fierro Corrugado Grade 60 1/2\\"", qtyConsumed: 28, unit: "Varilla", edtGroupCode: "CIM" });
      }
    } else {
      equipos.push({ resourceId: "EQ-MEZ", name: "Mezcladora de Concreto Trompo 9p3",   qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "EST" });
      equipos.push({ resourceId: "EQ-VIB", name: "Vibradora de Concreto Naftera 2\\"",   qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "EST" });
      materials.push({ resourceId: "MAT-CEM", name: "Cemento Portland Tipo I",           qtyConsumed: day >= 13 ? 90 : 45, unit: "Bolsa",   edtGroupCode: "EST" });
      materials.push({ resourceId: "MAT-ACE", name: "Fierro Corrugado Grade 60 1/2\\"",  qtyConsumed: 18,                  unit: "Varilla", edtGroupCode: "EST" });
    }

    reports.push({
      id: idReporte, projectCode: "MFG-01", date: dateString,
      shift: "Mañana", effectiveHours, supervisor: "Ing. Alejandro Rivas",
      weatherMorning, weatherAfternoon,
      activities: dayActivities, manoObra, materials, equipos,
      totalStaff, safetyInspected: true,
      safetyDetails: hseDetails, incidents: safetyIncident, conflicts,
      plannedNextDay: "Preparar encofrado y control de calidad de materiales.",
      generalNotes: observations,
      signatureUrlLocal: "", photoUrlsLocal: [],
      signatureBase64: "", photoBase64s: [],
      createdAt: new Date().toISOString()
    });
  }

  return reports;
};`;

const updated = content.substring(0, start) + newFn + content.substring(end);
fs.writeFileSync(appTsx, updated, 'utf-8');
console.log('App.tsx actualizado correctamente.');
console.log('Función reemplazada:', end - start, '→', newFn.length, 'chars');
