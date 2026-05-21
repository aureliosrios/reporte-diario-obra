import React, { useState, useEffect } from "react";
import { SmartMockup } from "./components/SmartMockup";
import { ReportForm } from "./components/ReportForm";
import { ProjectDashboard } from "./components/ProjectDashboard";
import { GoogleScriptDocs } from "./components/GoogleScriptDocs";
import { Project, EdtItem, PlannedValue, ResourceItem, DailyReport, EvmMetrics, PvCurvePoint } from "./types";
import { FALLBACK_PV_CURVE } from "./data/pv-curve-fallback";
import { PV_BY_CHAPTER, type PvChapterPoint } from "./data/pv-chapter-fallback";
import { 
  Building2, LineChart, FileText, ChevronRight, Loader2, Info, HardHat, Compass, ServerCrash, ExternalLink, Settings2
} from "lucide-react";

// Backup fallback structures if server fetch fails or is slow
const BACKUP_PROJECTS: Project[] = [
  { id: "PRJ-001", name: "Edificio Multifamiliar Girasoles", code: "MFG-01", location: "San Isidro, Lima, Perú", manager: "Ing. Alejandro Rivas" },
];

// BACKUP_EDT: usado SOLO si tanto el servidor Express como el archivo estático
// /data/pv-edt-data.json fallan. Refleja la estructura real del proyecto.
const BACKUP_EDT: EdtItem[] = [
  // Capítulos Nivel 1 (5 capítulos del proyecto real)
  { code: "OBR-PRE",  parentId: null, name: "Obras Preliminares y Provisionales",    unit: "Global", totalBudgetQty: 45000,  unitPrice: 0 },
  { code: "MOV-TIE",  parentId: null, name: "Movimiento de Tierras",                  unit: "Global", totalBudgetQty: 92250,  unitPrice: 0 },
  { code: "EST-CON",  parentId: null, name: "Estructuras de Concreto",               unit: "Global", totalBudgetQty: 321350, unitPrice: 0 },
  { code: "ARQ-ACAB", parentId: null, name: "Arquitectura y Acabados",                unit: "Global", totalBudgetQty: 313200, unitPrice: 0 },
  { code: "INS-SAN",  parentId: null, name: "Instalaciones Sanitarias y Eléctricas", unit: "Global", totalBudgetQty: 81590,  unitPrice: 0 },
  // Actividades Nivel 2
  { code: "OBR-PRE-01", parentId: "OBR-PRE", name: "Limpieza de terreno manual", unit: "m2", totalBudgetQty: 1500, unitPrice: 6 },
  { code: "OBR-PRE-02", parentId: "OBR-PRE", name: "Trazo, nivelación y replanteo", unit: "m2", totalBudgetQty: 1500, unitPrice: 8 },
  { code: "OBR-PRE-03", parentId: "OBR-PRE", name: "Cerco provisional de obra", unit: "m", totalBudgetQty: 240, unitPrice: 50 },
  { code: "OBR-PRE-04", parentId: "OBR-PRE", name: "Almacén y oficina provisional", unit: "Global", totalBudgetQty: 1, unitPrice: 12000 },
  { code: "MOV-TIE-01", parentId: "MOV-TIE", name: "Excavación masiva", unit: "m3", totalBudgetQty: 1200, unitPrice: 22 },
  { code: "MOV-TIE-02", parentId: "MOV-TIE", name: "Excavación manual zanjas", unit: "m3", totalBudgetQty: 180, unitPrice: 45 },
  { code: "MOV-TIE-03", parentId: "MOV-TIE", name: "Relleno y compactado", unit: "m3", totalBudgetQty: 450, unitPrice: 35 },
  { code: "MOV-TIE-04", parentId: "MOV-TIE", name: "Eliminación de desmonte", unit: "m3", totalBudgetQty: 1500, unitPrice: 28 },
  { code: "EST-CON-01", parentId: "EST-CON", name: "Solado de concreto e=3\"", unit: "m2", totalBudgetQty: 350, unitPrice: 32 },
  { code: "EST-CON-02", parentId: "EST-CON", name: "Concreto f'c=210 zapatas", unit: "m3", totalBudgetQty: 160, unitPrice: 380 },
  { code: "EST-CON-03", parentId: "EST-CON", name: "Acero refuerzo zapatas", unit: "kg", totalBudgetQty: 4500, unitPrice: 5.5 },
  { code: "EST-CON-04", parentId: "EST-CON", name: "Concreto f'c=280 columnas", unit: "m3", totalBudgetQty: 85, unitPrice: 420 },
  { code: "EST-CON-05", parentId: "EST-CON", name: "Encofrado metálico columnas", unit: "m2", totalBudgetQty: 320, unitPrice: 65 },
  { code: "EST-CON-06", parentId: "EST-CON", name: "Acero refuerzo columnas", unit: "kg", totalBudgetQty: 6200, unitPrice: 5.8 },
  { code: "EST-CON-07", parentId: "EST-CON", name: "Concreto f'c=210 losas y vigas", unit: "m3", totalBudgetQty: 120, unitPrice: 410 },
  { code: "EST-CON-08", parentId: "EST-CON", name: "Encofrado vigas y losas", unit: "m2", totalBudgetQty: 580, unitPrice: 55 },
  { code: "EST-CON-09", parentId: "EST-CON", name: "Acero refuerzo vigas y losas", unit: "kg", totalBudgetQty: 8800, unitPrice: 5.8 },
  { code: "ARQ-ACAB-01", parentId: "ARQ-ACAB", name: "Muros de ladrillo King Kong", unit: "m2", totalBudgetQty: 1100, unitPrice: 75 },
  { code: "ARQ-ACAB-02", parentId: "ARQ-ACAB", name: "Tarrajeo frotachado interior", unit: "m2", totalBudgetQty: 2400, unitPrice: 22 },
  { code: "ARQ-ACAB-03", parentId: "ARQ-ACAB", name: "Tarrajeo cielorrasos", unit: "m2", totalBudgetQty: 850, unitPrice: 26 },
  { code: "ARQ-ACAB-04", parentId: "ARQ-ACAB", name: "Contrapiso de concreto", unit: "m2", totalBudgetQty: 850, unitPrice: 24 },
  { code: "ARQ-ACAB-05", parentId: "ARQ-ACAB", name: "Piso porcelanato 60x60", unit: "m2", totalBudgetQty: 800, unitPrice: 85 },
  { code: "ARQ-ACAB-06", parentId: "ARQ-ACAB", name: "Pintura látex interior", unit: "m2", totalBudgetQty: 2400, unitPrice: 12 },
  { code: "ARQ-ACAB-07", parentId: "ARQ-ACAB", name: "Puertas contraplacadas", unit: "und", totalBudgetQty: 32, unitPrice: 450 },
  { code: "ARQ-ACAB-08", parentId: "ARQ-ACAB", name: "Ventanas vidrio templado", unit: "m2", totalBudgetQty: 110, unitPrice: 220 },
  { code: "INS-SAN-01", parentId: "INS-SAN", name: "Redes de desagüe PVC 4\"", unit: "m", totalBudgetQty: 320, unitPrice: 42 },
  { code: "INS-SAN-02", parentId: "INS-SAN", name: "Tubería agua fría/caliente", unit: "m", totalBudgetQty: 450, unitPrice: 35 },
  { code: "INS-SAN-03", parentId: "INS-SAN", name: "Tuberías PVC luz empotradas", unit: "m", totalBudgetQty: 950, unitPrice: 18 },
  { code: "INS-SAN-04", parentId: "INS-SAN", name: "Cableado cobre tipo NH-80", unit: "m", totalBudgetQty: 2800, unitPrice: 6.5 },
  { code: "INS-SAN-05", parentId: "INS-SAN", name: "Montaje aparatos sanitarios", unit: "jgo", totalBudgetQty: 18, unitPrice: 950 },
];

const BACKUP_RESOURCES: ResourceItem[] = [
  { id: "LH-CAP", name: "Capataz de Edificación", type: "mano_obra", unit: "Hora Hombre", unitCost: 28.0 },
  { id: "LH-OPE", name: "Operario de Obra Civil", type: "mano_obra", unit: "Hora Hombre", unitCost: 22.5 },
  { id: "LH-OFI", name: "Oficial de Obra Civil", type: "mano_obra", unit: "Hora Hombre", unitCost: 18.0 },
  { id: "LH-PEO", name: "Peón de Construcción", type: "mano_obra", unit: "Hora Hombre", unitCost: 14.5 },
  { id: "LH-SUP", name: "Supervisor SST (Prevencionista)", type: "mano_obra", unit: "Hora Hombre", unitCost: 35.0 },
  { id: "MAT-CEM", name: "Cemento Portland Tipo I (bolsa 42.5kg)", type: "material", unit: "Bolsa", unitCost: 24.5 },
  { id: "MAT-ACE", name: "Acero refuerzo corrugado fy=4200", type: "material", unit: "kg", unitCost: 4.8 },
  { id: "MAT-ARE", name: "Arena gruesa para mezclas", type: "material", unit: "m3", unitCost: 65.0 },
  { id: "MAT-PIE", name: "Piedra chancada de 1/2\"", type: "material", unit: "m3", unitCost: 72.0 },
  { id: "MAT-LAD", name: "Ladrillo King Kong arcilla 18 huecos", type: "material", unit: "Millar", unitCost: 850.0 },
  { id: "MAT-POR", name: "Porcelanato pulido premium 60x60cm", type: "material", unit: "m2", unitCost: 45.0 },
  { id: "MAT-PUE", name: "Puerta contraplacada de cedro", type: "material", unit: "und", unitCost: 350.0 },
  { id: "MAT-VID", name: "Vidrio templado e=8mm c/perfilerías", type: "material", unit: "m2", unitCost: 150.0 },
  { id: "MAT-DES", name: "Tubería PVC Sanitaria 4\"", type: "material", unit: "m", unitCost: 12.5 },
  { id: "MAT-AGU", name: "Tubería PVC agua fría 1/2\"", type: "material", unit: "m", unitCost: 8.5 },
  { id: "EQ-MEZ", name: "Mezcladora de concreto trompo 9p3", type: "equipo", unit: "Hora Máquina", unitCost: 15.0 },
  { id: "EQ-VIB", name: "Vibradora de concreto naftera 2\"", type: "equipo", unit: "Hora Máquina", unitCost: 8.5 },
  { id: "EQ-RET", name: "Retroexcavadora CAT 320 Orugas", type: "equipo", unit: "Hora Máquina", unitCost: 55.0 },
  { id: "EQ-VOL", name: "Camión Volquete Volvo 15m3", type: "equipo", unit: "Hora Máquina", unitCost: 42.0 },
  { id: "EQ-AND", name: "Andamio multidireccional normado", type: "equipo", unit: "Día", unitCost: 6.0 },
];

const generateBackupPlannedValues = (): PlannedValue[] => {
  const values: PlannedValue[] = [];
  const baseDate = new Date("2026-06-01");

  for (let i = 0; i < 20; i++) {
    const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];

    values.push({ date: dateStr, edtCode: "OBR-PRE-01", plannedQty: 75 });
    values.push({ date: dateStr, edtCode: "MOV-TIE-01", plannedQty: 60 });
    values.push({ date: dateStr, edtCode: "EST-CON-01", plannedQty: 18 });
    values.push({ date: dateStr, edtCode: "EST-CON-02", plannedQty: 8 });
    values.push({ date: dateStr, edtCode: "EST-CON-03", plannedQty: 225 });
    values.push({ date: dateStr, edtCode: "ARQ-ACAB-01", plannedQty: 55 });
    values.push({ date: dateStr, edtCode: "ARQ-ACAB-02", plannedQty: 120 });
    values.push({ date: dateStr, edtCode: "INS-SAN-01", plannedQty: 16 });
    values.push({ date: dateStr, edtCode: "INS-SAN-02", plannedQty: 23 });
  }
  return values;
};

const generate20DaysSyntheticReports = (): DailyReport[] => {
  const reports: DailyReport[] = [];
  const baseDate = new Date("2026-06-01");

  // Fases reales del cronograma EDT (nuevo: 5 capítulos, 90 días):
  //  Días 01-04: OBR-PRE  - Obras Preliminares (OBR-PRE-01 … OBR-PRE-04)
  //  Días 05-08: MOV-TIE  - Movimiento de Tierras (MOV-TIE-01 … MOV-TIE-04)
  //  Días 09-14: EST-CON  - Estructuras de Concreto (EST-CON-01 … EST-CON-09)
  //  Días 15-18: ARQ-ACAB - Arquitectura y Acabados (ARQ-ACAB-01 … ARQ-ACAB-08)
  //  Días 19-20: INS-SAN  - Instalaciones Sanitarias y Eléctricas (INS-SAN-01 … INS-SAN-05)

  for (let day = 0; day < 20; day++) {
    const currentDate  = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000);
    const dateString   = currentDate.toISOString().split("T")[0];
    const dateStrShort = dateString.replace(/-/g, "");
    const idReporte    = `REP-MFG-${dateStrShort}`;

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
    const chapterWbsId = day < 4 ? "OBR-PRE" : day < 8 ? "MOV-TIE" : day < 14 ? "EST-CON" : day < 18 ? "ARQ-ACAB" : "INS-SAN";
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
      dayActivities.push({ edtCode: "OBR-PRE-01", name: "Limpieza de terreno manual", unit: "m2", plannedQty: 425, qtyExecuted: 390 - day * 5, notes: "Limpieza y retiro de residuos" });
      dayActivities.push({ edtCode: "OBR-PRE-02", name: "Trazo, nivelación y replanteo", unit: "m2", plannedQty: 380, qtyExecuted: 340 - day * 5, notes: "Replanteo de ejes principales" });
    } else if (day < 8) {
      // MOV-TIE: Movimiento de Tierras
      const d = day - 4;
      if (d === 0) dayActivities.push({ edtCode: "MOV-TIE-01", name: "Excavación masiva con excavadora", unit: "m3", plannedQty: 380, qtyExecuted: 340, notes: "Excavación de zanjas y zapatas" });
      if (d === 1) dayActivities.push({ edtCode: "MOV-TIE-01", name: "Excavación masiva con excavadora", unit: "m3", plannedQty: 380, qtyExecuted: day === 5 ? 80 : 360, notes: day === 5 ? "Parálisis por lluvia" : "Recuperación con jornada extendida" });
      if (d === 2) dayActivities.push({ edtCode: "MOV-TIE-03", name: "Relleno y compactado con vibradora", unit: "m3", plannedQty: 120, qtyExecuted: 100, notes: "Relleno de zanjas" });
      if (d === 3) {
        dayActivities.push({ edtCode: "MOV-TIE-04", name: "Eliminación de desmonte c/volquete 15m3", unit: "m3", plannedQty: 450, qtyExecuted: 400, notes: "Desmonte acumulado" });
        dayActivities.push({ edtCode: "MOV-TIE-02", name: "Excavación manual de zanjas y vigas", unit: "m3", plannedQty: 55, qtyExecuted: 48, notes: "Excavación complementaria" });
      }
    } else if (day < 14) {
      // EST-CON: Estructuras de Concreto
      const dEst = day - 8;
      if (dEst < 3) {
        dayActivities.push({ edtCode: "EST-CON-01", name: "Solado de concreto e=3\"", unit: "m2", plannedQty: 105, qtyExecuted: 90 + dEst * 5, notes: "Solado de limpieza" });
        dayActivities.push({ edtCode: "EST-CON-05", name: "Encofrado metálico columnas", unit: "m2", plannedQty: 100, qtyExecuted: 85 + dEst * 5, notes: "Encofrado de placas y columnas 1er piso" });
      } else if (dEst < 7) {
        dayActivities.push({ edtCode: "EST-CON-04", name: "Concreto f'c=280 columnas", unit: "m3", plannedQty: 26, qtyExecuted: 22 + (dEst - 3) * 2, notes: "Vaciado concreto f'c=280 kg/cm2" });
        dayActivities.push({ edtCode: "EST-CON-06", name: "Acero refuerzo columnas", unit: "kg", plannedQty: 1860, qtyExecuted: 1600 + (dEst - 3) * 80, notes: "Habilitación y colocación de acero" });
      } else {
        dayActivities.push({ edtCode: "EST-CON-08", name: "Encofrado vigas y losas", unit: "m2", plannedQty: 175, qtyExecuted: 150 + (dEst - 7) * 5, notes: "Encofrado con tableros de fondo de losa" });
        dayActivities.push({ edtCode: "EST-CON-09", name: "Acero refuerzo vigas y losas", unit: "kg", plannedQty: 2640, qtyExecuted: 2300 + (dEst - 7) * 50, notes: "Colocación de acero en vigas principales" });
      }
    } else if (day < 18) {
      // ARQ-ACAB: Arquitectura y Acabados
      const dArq = day - 14;
      if (dArq < 2) {
        dayActivities.push({ edtCode: "ARQ-ACAB-01", name: "Muros de ladrillo King Kong", unit: "m2", plannedQty: 310, qtyExecuted: 280 + dArq * 15, notes: "Asentado de muros de ladrillo" });
        dayActivities.push({ edtCode: "ARQ-ACAB-02", name: "Tarrajeo frotachado interior", unit: "m2", plannedQty: 690, qtyExecuted: 620 + dArq * 30, notes: "Tarrajeo de muros interiores" });
      } else {
        dayActivities.push({ edtCode: "ARQ-ACAB-05", name: "Piso porcelanato 60x60", unit: "m2", plannedQty: 225, qtyExecuted: 200 + (dArq - 2) * 10, notes: "Instalación de piso porcelanato" });
        dayActivities.push({ edtCode: "ARQ-ACAB-06", name: "Pintura látex interior", unit: "m2", plannedQty: 690, qtyExecuted: 600 + (dArq - 2) * 30, notes: "Pintura de muros y columnas" });
      }
    } else {
      // INS-SAN: Instalaciones Sanitarias y Eléctricas
      const dIns = day - 18;
      dayActivities.push({ edtCode: "INS-SAN-01", name: "Redes de desagüe PVC 4\"", unit: "m", plannedQty: 95, qtyExecuted: 80 + dIns * 10, notes: "Tendido de tubería de desagüe" });
      dayActivities.push({ edtCode: "INS-SAN-04", name: "Cableado cobre tipo NH-80", unit: "m", plannedQty: 810, qtyExecuted: 720 + dIns * 40, notes: "Cableado de circuitos eléctricos" });
    }

    // ── Recursos consumidos (IDs reales BD_RRHH + BD_Almacen) ─────────────────
    const manoObra: DailyReport["manoObra"] = [
      { resourceId: "LH-CAP", name: "Capataz de Edificación", hoursWorked: effectiveHours,    edtGroupCode: chapterWbsId },
      { resourceId: "LH-OPE", name: "Operario de Obra Civil",  hoursWorked: effectiveHours * 4, edtGroupCode: chapterWbsId },
      { resourceId: "LH-PEO", name: "Peón de Construcción",   hoursWorked: effectiveHours * 8, edtGroupCode: chapterWbsId }
    ];
    const materials: DailyReport["materials"] = [];
    const equipos:   DailyReport["equipos"]   = [];

    if (chapterWbsId === "OBR-PRE") {
      equipos.push({ resourceId: "EQ-MEZ", name: "Mezcladora de concreto trompo 9p3", qtyUsed: effectiveHours / 2, unit: "Hora Máquina", edtGroupCode: "OBR-PRE" });
    } else if (chapterWbsId === "MOV-TIE") {
      equipos.push({ resourceId: "EQ-RET", name: "Retroexcavadora CAT 320 Orugas", qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "MOV-TIE" });
      equipos.push({ resourceId: "EQ-VOL", name: "Camión Volquete Volvo 15m3", qtyUsed: effectiveHours / 2, unit: "Hora Máquina", edtGroupCode: "MOV-TIE" });
    } else if (chapterWbsId === "EST-CON") {
      equipos.push({ resourceId: "EQ-MEZ", name: "Mezcladora de concreto trompo 9p3", qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "EST-CON" });
      equipos.push({ resourceId: "EQ-VIB", name: "Vibradora de concreto naftera 2\"", qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "EST-CON" });
      materials.push({ resourceId: "MAT-CEM", name: "Cemento Portland Tipo I (bolsa 42.5kg)", qtyConsumed: day >= 13 ? 90 : 45, unit: "Bolsa", edtGroupCode: "EST-CON" });
      materials.push({ resourceId: "MAT-ACE", name: "Acero de refuerzo corrugado fy=4200", qtyConsumed: 18, unit: "kg", edtGroupCode: "EST-CON" });
    } else if (chapterWbsId === "ARQ-ACAB") {
      materials.push({ resourceId: "MAT-LAD", name: "Ladrillo King Kong arcilla 18 huecos", qtyConsumed: day >= 16 ? 40 : 80, unit: "Millar", edtGroupCode: "ARQ-ACAB" });
      materials.push({ resourceId: "MAT-POR", name: "Porcelanato pulido premium 60x60cm", qtyConsumed: day >= 16 ? 20 : 0, unit: "m2", edtGroupCode: "ARQ-ACAB" });
    } else {
      // INS-SAN
      materials.push({ resourceId: "MAT-DES", name: "Tubería PVC Sanitaria pesada de 4\"", qtyConsumed: 15, unit: "m", edtGroupCode: "INS-SAN" });
      materials.push({ resourceId: "MAT-AGU", name: "Tubería PVC agua fría de 1/2\"", qtyConsumed: 22, unit: "m", edtGroupCode: "INS-SAN" });
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
};
const BACKUP_REPORTS = generate20DaysSyntheticReports();

export default function App() {
  const [activeTab, setActiveTab] = useState<"campo" | "control" | "sheets">("control");
  const [projects, setProjects] = useState<Project[]>(BACKUP_PROJECTS);
  const [edtList, setEdtList] = useState<EdtItem[]>(BACKUP_EDT);
  const [plannedValues, setPlannedValues] = useState<PlannedValue[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>(BACKUP_RESOURCES);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [pvCurveData, setPvCurveData] = useState<PvCurvePoint[]>([]);
  const [pvByChapter, setPvByChapter] = useState<PvChapterPoint[]>([]);
  /** BAC total del proyecto (Budget at Completion) desde pv-edt-data.json */
  const [projectBac, setProjectBac] = useState<number>(0);
  
  // Custom Apps script link string saved in localstorage
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Sync / Load Initial database from Express Server API or Local fallback
  const fetchAllData = async (customUrl?: string) => {
    setLoading(true);
    const webhookUrl = customUrl || localStorage.getItem("RDO_APPS_SCRIPT_WEBHOOK") || "";
    
    // Si tenemos una URL de webhook, intentemos cargar los reportes directamente de Google Sheets
    let liveReports: DailyReport[] = [];
    let fetchedFromSheets = false;
    
    if (webhookUrl) {
      try {
        console.log("Sincronizando reportes en vivo desde Google Sheets:", webhookUrl);
        const response = await fetch(webhookUrl);
        if (response.ok) {
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            const match = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            if (match) {
              data = JSON.parse(match[1].trim());
            } else {
              throw new Error("No se pudo extraer JSON de la respuesta HTML");
            }
          }
          if (Array.isArray(data)) {
            liveReports = data;
            fetchedFromSheets = true;
            console.log("¡Reportes sincronizados en vivo con éxito! Cantidad:", liveReports.length);
          }
        }
      } catch (e) {
        console.warn("No se pudo cargar desde Google Sheets. ¿Están configurados los permisos CORS?:", e);
      }
    }

    try {
      const pRes = await fetch("/api/projects");
      const pData = await pRes.json();
      setProjects(pData);

      const mRes = await fetch("/api/master-data");
      const mData = await mRes.json();
      setEdtList(mData.edt);
      setPlannedValues(mData.plannedValues);
      setResources(mData.resources);
      if (mData.bac && mData.bac > 0) setProjectBac(mData.bac);

      // Si cargamos con éxito desde Sheets, usamos esos reportes. Si no, consultamos el servidor Express local.
      if (fetchedFromSheets) {
        setReports(liveReports);
      } else {
        const rRes = await fetch("/api/reports");
        const rData = await rRes.json();
        setReports(rData);
      }

      // Load PV Curve data (try API first, then static file, then fallback)
      try {
        const pvRes = await fetch("/api/pv-curve");
        if (pvRes.ok) {
          setPvCurveData(await pvRes.json());
        } else {
          throw new Error("API returned not OK");
        }
      } catch (e) {
        try {
          // Fallback: load from static JSON file (works on GitHub Pages)
          const pvRes = await fetch("/data/pv-curve.json");
          if (pvRes.ok) {
            setPvCurveData(await pvRes.json());
          } else {
            throw new Error("Static file not found");
          }
        } catch (e2) {
          // Final fallback: use embedded constant
          console.warn("Usando curva S embebida (fallback final):", e2);
          setPvCurveData(FALLBACK_PV_CURVE);
        }
      }

      // Load per-chapter PV data
      try {
        const chRes = await fetch("/api/pv-chapter");
        if (chRes.ok) {
          setPvByChapter(await chRes.json());
        } else {
          throw new Error("API returned not OK");
        }
      } catch {
        try {
          const chRes = await fetch("/data/pv-by-chapter.json");
          if (chRes.ok) {
            setPvByChapter(await chRes.json());
          } else {
            throw new Error("Static file not found");
          }
        } catch {
          console.warn("Usando PV por capítulo embebido (fallback final)");
          setPvByChapter(PV_BY_CHAPTER);
        }
      }

      setIsOfflineMode(false);
    } catch (err) {
      console.warn("[RDO] Express offline — intentando carga estática desde /data/ …", err);

      // ── Intento 1: Cargar EDT + PV desde el JSON estático generado por el pipeline ──
      try {
        const edtRes = await fetch("/data/pv-edt-data.json");
        if (edtRes.ok) {
          const edtData = await edtRes.json();
          setEdtList(edtData.edt || BACKUP_EDT);
          setPlannedValues(edtData.plannedValues || []);
          if (edtData.bac && edtData.bac > 0) setProjectBac(edtData.bac);
          console.log("[RDO] EDT y PV cargados desde /data/pv-edt-data.json (modo estático)");
        } else {
          throw new Error("pv-edt-data.json no disponible");
        }
      } catch {
        // ── Fallback final: usar BACKUP_EDT hardcodeado ──
        console.warn("[RDO] Usando BACKUP_EDT de emergencia (5 capítulos aproximados)");
        setEdtList(BACKUP_EDT);
        setPlannedValues(generateBackupPlannedValues());
      }

      // ── Intento 2: Cargar metadata del proyecto desde JSON estático ──
      try {
        const pRes = await fetch("/data/project.json");
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData)) {
            setProjects(pData);
          } else {
            setProjects([{ id: "PRJ-001", name: pData.name || "Edificio Multifamiliar Girasoles", code: pData.code || "MFG-01", location: pData.location || "", manager: pData.manager || "" }]);
          }
        }
      } catch {
        // queda BACKUP_PROJECTS del estado inicial
      }

      // ── Intento 3: Cargar recursos desde JSON estático ──
      try {
        const rRes = await fetch("/data/resources.json");
        if (rRes.ok) {
          setResources(await rRes.json());
        }
      } catch {
        // queda BACKUP_RESOURCES del estado inicial
      }

      // ── Intento 4: Curva S acumulada del proyecto ──
      try {
        const pvRes = await fetch("/data/pv-curve.json");
        if (pvRes.ok) {
          setPvCurveData(await pvRes.json());
        } else {
          setPvCurveData(FALLBACK_PV_CURVE);
        }
      } catch {
        setPvCurveData(FALLBACK_PV_CURVE);
      }

      // ── Intento 5: PV por capítulo ──
      try {
        const chRes = await fetch("/data/pv-by-chapter.json");
        if (chRes.ok) {
          setPvByChapter(await chRes.json());
        } else {
          setPvByChapter(PV_BY_CHAPTER);
        }
      } catch {
        setPvByChapter(PV_BY_CHAPTER);
      }

      // ── Reportes: Google Sheets > BACKUP ──
      if (fetchedFromSheets) {
        setReports(liveReports);
        setIsOfflineMode(false);
      } else {
        setReports(BACKUP_REPORTS);
        setIsOfflineMode(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUrl = localStorage.getItem("RDO_APPS_SCRIPT_WEBHOOK") || "";
    if (storedUrl) {
      setAppsScriptUrl(storedUrl);
    }
    fetchAllData(storedUrl);
  }, []);

  // Save Apps Script URL whenever changed
  useEffect(() => {
    if (appsScriptUrl) {
      localStorage.setItem("RDO_APPS_SCRIPT_WEBHOOK", appsScriptUrl);
    }
  }, [appsScriptUrl]);

  // Handle a newly registered report submission to refresh internal list
  const handleReportSubmitted = (newReport: DailyReport, metrics: EvmMetrics) => {
    // Append metrics inside report body
    const enrichedReport = {
      ...newReport,
      metrics
    };
    setReports(prev => [...prev, enrichedReport]);
    // Redirect to Control Dashboard automatically!
    setActiveTab("control");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen bg-slate-900 text-slate-100">
        <Loader2 className="w-12 h-12 text-sky-400 animate-spin mb-4" />
        <h2 className="text-lg font-bold font-sans">Inicializando Sistema RDO + EVM</h2>
        <p className="text-xs text-slate-400 mt-2 font-mono">Construyendo bases de datos de campo...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 border-t-2 border-sky-500">
      
      {/* Top Main Navigation Bar (Responsiva, Premium layout) */}
      <header className="bg-slate-950 text-white border-b border-slate-800 shrink-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand/Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-sky-600 to-sky-450 p-2 rounded-xl text-slate-950 font-black shadow-lg shadow-sky-500/10 shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-sky-400 font-sans uppercase">SISTEMA DIARIO</span>
                {isOfflineMode && (
                  <span className="bg-amber-500/10 text-amber-400 text-[8px] font-extrabold font-mono px-2 py-0.5 rounded-full border border-amber-500/20 uppercase animate-pulse">
                    Local Resilient
                  </span>
                )}
              </div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-none mt-1 font-sans">
                REPORTE DIARIO DE OBRA (RDO)
              </h1>
            </div>
          </div>

          {/* Core Desktop Tabs */}
          <nav className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("campo")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold tracking-tight transition-all duration-150 ${
                activeTab === "campo"
                  ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/10"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <HardHat className="w-4 h-4" />
              RDO Campo (Celular)
            </button>

            <button
              onClick={() => setActiveTab("control")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold tracking-tight transition-all duration-150 ${
                activeTab === "control"
                  ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/10"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <LineChart className="w-4 h-4" />
              Tablero EVM
            </button>

            <button
              onClick={() => setActiveTab("sheets")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold tracking-tight transition-all duration-150 ${
                activeTab === "sheets"
                  ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/10"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Despliegue Sheets
            </button>
          </nav>

        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col justify-start">
        {activeTab === "campo" && (
          <div className="py-4">
            <SmartMockup title="Simulador de Reporte Campo">
              <ReportForm
                projects={projects}
                edtList={edtList}
                plannedValues={plannedValues}
                resources={resources}
                onReportSubmitted={handleReportSubmitted}
                appsScriptUrl={appsScriptUrl}
                setAppsScriptUrl={setAppsScriptUrl}
              />
            </SmartMockup>
          </div>
        )}

        {activeTab === "control" && (
          <div className="max-w-7xl mx-auto w-full px-2 sm:px-6 lg:px-8 py-6 flex-1">
            <ProjectDashboard
              reports={reports}
              edtList={edtList}
              resources={resources}
              projectName={projects.length > 0 ? projects[0].name : "Edificio Multifamiliar Girasoles"}
              onRefresh={() => fetchAllData(appsScriptUrl)}
              isSheetsConnected={!!appsScriptUrl}
              pvCurveData={pvCurveData}
              pvByChapter={pvByChapter}
              bac={projectBac}
            />
          </div>
        )}

        {activeTab === "sheets" && (
          <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
            <GoogleScriptDocs />
          </div>
        )}
      </main>

      {/* Elegant Footer workspace credits */}
      <footer className="bg-slate-950 text-slate-500 py-4 text-center text-xs border-t border-slate-800 shrink-0">
        <p className="font-sans font-semibold">
          © {new Date().getFullYear()} Reporte Diario de Obra (RDO) · Control S-Curve & EVM (Earned Value)
        </p>
      </footer>

    </div>
  );
}
