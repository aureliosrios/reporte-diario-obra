import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing large JSON files (we are uploading base64 signatures/photos)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Paths
const DATA_DIR = path.join(process.cwd(), "data");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");
const SIGS_DIR = path.join(DATA_DIR, "signatures");
const PHOTOS_DIR = path.join(DATA_DIR, "photos");
const PV_CURVE_FILE = path.join(DATA_DIR, "pv-curve.json");
const PV_EDT_DATA_FILE = path.join(DATA_DIR, "pv-edt-data.json");
const PV_BY_CHAPTER_FILE = path.join(DATA_DIR, "pv-by-chapter.json");
const RESOURCES_FILE = path.join(DATA_DIR, "resources.json");
const PROJECT_FILE = path.join(DATA_DIR, "project.json");


// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(SIGS_DIR)) fs.mkdirSync(SIGS_DIR);
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR);

// Define default project list
const DEFAULT_PROJECTS = [
  { id: "PRJ-001", name: "Edificio Multifamiliar Girasoles", code: "MFG-01", location: "Lima, San Isidro", manager: "Ing. Alejandro Rivas" },
  { id: "PRJ-002", name: "Condominio de Playa Las Brisas", code: "CPLB-02", location: "Asia, KM 98", manager: "Ing. Claudia Mendoza" },
  { id: "PRJ-003", name: "Complejo Logístico Industrial Lurín", code: "CLIL-03", location: "Lurín, Lote 45", manager: "Ing. Marcos Torres" }
];

// Load real EDT and PV data from the generated JSON (from BD_EDT.xlsx + BD_Metrados_Planificados.xlsx)
let REAL_EDT: any[] = [];
let REAL_PLANNED_VALUES: any[] = [];
let REAL_PV_CURVE: any[] = [];
let REAL_PV_BY_CHAPTER: any[] = [];
let REAL_RESOURCES: any[] = [];
let REAL_PROJECTS: any[] = [];

try {
  if (fs.existsSync(PROJECT_FILE)) {
    const proj = JSON.parse(fs.readFileSync(PROJECT_FILE, "utf-8"));
    REAL_PROJECTS = [
      {
        id: proj.id,
        name: proj.name,
        code: proj.code,
        location: proj.location,
        manager: proj.manager,
        company: proj.company,
        client: proj.client,
        supervisorCompany: proj.supervisorCompany,
        contractAmount: proj.contractAmount,
        plazo: proj.plazo,
        moneda: proj.moneda
      }
    ];
    console.log(`[RDO BACKEND] Cargados metadatos del proyecto único: ${proj.name}`);
  }
  if (fs.existsSync(PV_EDT_DATA_FILE)) {
    const raw = JSON.parse(fs.readFileSync(PV_EDT_DATA_FILE, "utf-8"));
    REAL_EDT = raw.edt || [];
    REAL_PLANNED_VALUES = raw.plannedValues || [];
    console.log(`[RDO BACKEND] Cargados ${REAL_EDT.length} items EDT y ${REAL_PLANNED_VALUES.length} valores planificados desde BD_EDT/BD_Metrados`);
  }
  if (fs.existsSync(PV_CURVE_FILE)) {
    REAL_PV_CURVE = JSON.parse(fs.readFileSync(PV_CURVE_FILE, "utf-8"));
    console.log(`[RDO BACKEND] Curva S cargada: ${REAL_PV_CURVE.length} fechas, PV total: S/ ${REAL_PV_CURVE[REAL_PV_CURVE.length - 1]?.pvCumulative?.toFixed(2) || 0}`);
  }
  if (fs.existsSync(PV_BY_CHAPTER_FILE)) {
    REAL_PV_BY_CHAPTER = JSON.parse(fs.readFileSync(PV_BY_CHAPTER_FILE, "utf-8"));
    console.log(`[RDO BACKEND] PV por capítulo cargado: ${REAL_PV_BY_CHAPTER.length} capítulos`);
  }
  if (fs.existsSync(RESOURCES_FILE)) {
    REAL_RESOURCES = JSON.parse(fs.readFileSync(RESOURCES_FILE, "utf-8"));
    console.log(`[RDO BACKEND] Catálogo de recursos cargado: ${REAL_RESOURCES.length} recursos`);
  }

} catch (e) {
  console.warn("[RDO BACKEND] Error cargando datos reales desde JSON, usando defaults sintéticos:", (e as Error).message);
}

// Define standard EDT (EDT_BD) Work Breakdown Structure
const DEFAULT_EDT = REAL_EDT.length > 0 ? REAL_EDT : [
  // Capítulos Nivel 1
  { code: "EST", parentId: null, name: "Estructuras", unit: "Global", totalBudgetQty: 1, unitPrice: 0 },
  { code: "ARQ", parentId: null, name: "Arquitectura", unit: "Global", totalBudgetQty: 1, unitPrice: 0 },
  { code: "MEP", parentId: null, name: "Instalaciones MEP", unit: "Global", totalBudgetQty: 1, unitPrice: 0 },

  // Partidas Nivel 2
  { code: "EST-01", parentId: "EST", name: "Obras Provisionales y Trabajos Preliminares", unit: "m2", totalBudgetQty: 250, unitPrice: 25 },
  { code: "EST-02", parentId: "EST", name: "Movimiento de Tierras - Excavación masiva", unit: "m3", totalBudgetQty: 1200, unitPrice: 18 },
  { code: "EST-03", parentId: "EST", name: "Concreto de Columnas y Placas (f'c=280 kg/cm2)", unit: "m3", totalBudgetQty: 480, unitPrice: 135 },
  { code: "EST-04", parentId: "EST", name: "Concreto de Vigas y Losas Aligeradas", unit: "m3", totalBudgetQty: 550, unitPrice: 120 },
  
  { code: "ARQ-01", parentId: "ARQ", name: "Muros de Albañilería de Ladrillo KK", unit: "m2", totalBudgetQty: 1800, unitPrice: 16 },
  { code: "ARQ-02", parentId: "ARQ", name: "Tarrajeo Frotachado en Interiores", unit: "m2", totalBudgetQty: 3200, unitPrice: 8.5 },
  { code: "ARQ-03", parentId: "ARQ", name: "Instalación de Pisos Porcelanato 60x60", unit: "m2", totalBudgetQty: 1400, unitPrice: 24 },
  
  { code: "MEP-01", parentId: "MEP", name: "Instalaciones Eléctricas - Canaletados y Tuberías", unit: "m", totalBudgetQty: 2200, unitPrice: 6.2 },
  { code: "MEP-02", parentId: "MEP", name: "Instalaciones Sanitarias - Tendido de Tubería de Desagüe", unit: "m", totalBudgetQty: 850, unitPrice: 9.8 }
];

// Define Planned Value (PV) for each activity in a sliding timeline
const generatePlannedValues = () => {
  if (REAL_PLANNED_VALUES.length > 0) {
    return REAL_PLANNED_VALUES;
  }
  const values = [];
  const baseDate = new Date("2026-05-15");
  
  for (let i = 0; i < 20; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];

    values.push({ date: dateStr, edtCode: "EST-01", plannedQty: 15 });
    values.push({ date: dateStr, edtCode: "EST-02", plannedQty: 80 });
    values.push({ date: dateStr, edtCode: "EST-03", plannedQty: 25 });
    values.push({ date: dateStr, edtCode: "EST-04", plannedQty: 30 });
    values.push({ date: dateStr, edtCode: "ARQ-01", plannedQty: 65 });
    values.push({ date: dateStr, edtCode: "ARQ-02", plannedQty: 110 });
    values.push({ date: dateStr, edtCode: "ARQ-03", plannedQty: 50 });
    values.push({ date: dateStr, edtCode: "MEP-01", plannedQty: 80 });
    values.push({ date: dateStr, edtCode: "MEP-02", plannedQty: 35 });
  }
  return values;
};
const DEFAULT_PV = generatePlannedValues();

// Catalog of Labor, Materials, Equipments (BD_RRHH and BD_Almacen)
const DEFAULT_RESOURCES = [
  // Mano de Obra (Personal)
  { id: "LH-CAP", name: "Capataz de Edificación", type: "mano_obra", unit: "Hora Hombre", unitCost: 28.0 },
  { id: "LH-OPE", name: "Operario Civil", type: "mano_obra", unit: "Hora Hombre", unitCost: 22.5 },
  { id: "LH-OFI", name: "Oficial Carpintero/Fierrero", type: "mano_obra", unit: "Hora Hombre", unitCost: 18.0 },
  { id: "LH-PEO", name: "Peón de Construcción", type: "mano_obra", unit: "Hora Hombre", unitCost: 14.5 },
  { id: "LH-SUP", name: "Supervisor de Seguridad", type: "mano_obra", unit: "Hora Hombre", unitCost: 35.0 },

  // Materiales
  { id: "MAT-CEM", name: "Cemento Portland Tipo I (Bolsa 42.5kg)", type: "material", unit: "Bolsa", unitCost: 8.9 },
  { id: "MAT-ARE", name: "Arena Gruesa", type: "material", unit: "m3", unitCost: 24.0 },
  { id: "MAT-PIE", name: "Piedra Chancada de 1/2\"", type: "material", unit: "m3", unitCost: 28.0 },
  { id: "MAT-LAD", name: "Ladrillo King Kong Arcilla Cocida 18H", type: "material", unit: "Millar", unitCost: 320.0 },
  { id: "MAT-ACE", name: "Fierro Corrugado Grade 60 1/2\"", type: "material", unit: "Varilla", unitCost: 9.50 },
  { id: "MAT-POR", name: "Porcelanato Premium Claro 60x60", type: "material", unit: "m2", unitCost: 16.50 },
  { id: "MAT-TUB", name: "Tubería PVC Eléctrica 3/4\"", type: "material", unit: "Tubo", unitCost: 3.20 },
  { id: "MAT-SAN", name: "Tubería PVC Sanitaria Pesada 4\"", type: "material", unit: "Tubo", unitCost: 11.50 },

  // Equipos / Maquinaria
  { id: "EQ-MEZ", name: "Mezcladora de Concreto Trompo 9p3", type: "equipo", unit: "Hora Máquina", unitCost: 12.0 },
  { id: "EQ-VIB", name: "Vibradora de Concreto Naftera 2\"", type: "equipo", unit: "Hora Máquina", unitCost: 7.5 },
  { id: "EQ-RET", name: "Retroexcavadora Oruga CAT 320", type: "equipo", unit: "Hora Máquina", unitCost: 48.0 },
  { id: "EQ-VOL", name: "Camión Volquete 15m3", type: "equipo", unit: "Hora Máquina", unitCost: 35.0 },
  { id: "EQ-AND", name: "Andamio Acústico Normado (Cuerpo)", type: "equipo", unit: "Día", unitCost: 5.0 }
];

// Define a programmatic generator for the 20-day synthetic dataset
const generate20DaysSyntheticReports = () => {
  const reports: any[] = [];
  const baseDate = new Date("2026-05-15");
  
  for (let day = 0; day < 20; day++) {
    const currentDate = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000);
    const dateString = currentDate.toISOString().split("T")[0];
    const dateStrShort = dateString.replace(/-/g, "");
    const idReporte = `REP-MFG-${dateStrShort}`;
    const supervisor = "Ing. Alejandro Rivas";
    const shift = "Mañana";
    
    let weatherMorning = "Soleado";
    let weatherAfternoon = "Nublado";
    let effectiveHours = 8;
    let conflicts = "Ninguno";
    let observations = "Avances conformes al programa diario de obra.";
    
    // Simular retraso por lluvia extrema en el Día 6
    if (day === 5) {
      weatherMorning = "Nublado";
      weatherAfternoon = "Lluvia";
      effectiveHours = 4;
      conflicts = "Lluvia torrencial en la tarde. Se paralizaron trabajos a las 14:00.";
      observations = "Parada parcial por tormenta. Personal evacuado a refugios.";
    } 
    // Simular horas extras de recuperación en los Días 7 al 12
    else if (day >= 6 && day <= 11) {
      effectiveHours = 9.5;
      conflicts = "Jornada extendida autorizada.";
      observations = "Se trabajaron 1.5 horas extras para recuperar avance de estructuras.";
    }
    
    const chapterWbsId = (day < 12) ? "EST" : "ARQ";
    
    // A. Registrar Seguridad (HSE)
    let totalStaff = Math.round(18 + Math.random() * 8);
    if (day >= 6 && day <= 11) totalStaff += 4; // Más operarios para horas extras
    
    let hseInspected = true;
    let hseDetails = "Inspección de EPPs y arneses conforme.";
    let safetyIncident = "Ninguno";
    
    if (day === 10) { // Día 11: Incidente leve
      hseDetails = "Revisión de cables de andamio con observaciones menores.";
      safetyIncident = "Resbalón de peón en rampa de acceso, atendido por primeros auxilios. Sin baja laboral.";
    }
    
    // B. Registrar Actividades Ejecutadas
    const dayActivities: any[] = [];
    if (day < 5) {
      dayActivities.push({ edtCode: "EST-01", name: "Obras Provisionales y Trabajos Preliminares", unit: "m2", plannedQty: 20, qtyExecuted: 15, notes: "Habilitación de almacenes" });
      dayActivities.push({ edtCode: "EST-02", name: "Movimiento de Tierras - Excavación masiva", unit: "m3", plannedQty: 100, qtyExecuted: 85, notes: "Excavación masiva de zanjas" });
    } else if (day === 5) { // Día de lluvia: producción baja
      dayActivities.push({ edtCode: "EST-02", name: "Movimiento de Tierras - Excavación masiva", unit: "m3", plannedQty: 100, qtyExecuted: 15, notes: "Parálisis por anegamiento" });
    } else if (day >= 6 && day < 12) {
      const colQty = (day === 6 || day === 7) ? 25 : 18;
      const beamQty = (day >= 8) ? 35 : 0;
      dayActivities.push({ edtCode: "EST-03", name: "Concreto de Columnas y Placas (f'c=280 kg/cm2)", unit: "m3", plannedQty: 40, qtyExecuted: colQty, notes: "Vaciado continuo de concreto f'c=280" });
      if (beamQty > 0) {
        dayActivities.push({ edtCode: "EST-04", name: "Concreto de Vigas y Losas Aligeradas", unit: "m3", plannedQty: 45, qtyExecuted: beamQty, notes: "Encofrado e instalación de acero" });
      }
    } else { // Fase de Arquitectura
      const wallQty = 120 - (day - 12) * 5;
      const plasterQty = (day >= 15) ? 140 : 0;
      dayActivities.push({ edtCode: "ARQ-01", name: "Muros de Albañilería de Ladrillo KK", unit: "m2", plannedQty: 150, qtyExecuted: wallQty, notes: "Asentado de muros en primer nivel" });
      if (plasterQty > 0) {
        dayActivities.push({ edtCode: "ARQ-02", name: "Tarrajeo Frotachado en Interiores", unit: "m2", plannedQty: 180, qtyExecuted: plasterQty, notes: "Tarrajeo liso en muros internos" });
      }
    }
    
    // C. Registrar Recursos Consumidos
    const manoObra = [
      { resourceId: "LH-CAP", name: "Capataz de Edificación", hoursWorked: effectiveHours, edtGroupCode: chapterWbsId },
      { resourceId: "LH-OPE", name: "Operario Civil", hoursWorked: effectiveHours * 4, edtGroupCode: chapterWbsId },
      { resourceId: "LH-PEO", name: "Peón de Construcción", hoursWorked: effectiveHours * 8, edtGroupCode: chapterWbsId }
    ];
    
    const materials: any[] = [];
    const equipos: any[] = [];
    
    if (day < 5) {
      equipos.push({ resourceId: "EQ-RET", name: "Retroexcavadora Oruga CAT 320", qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "EST" });
    } else if (day === 5) {
      equipos.push({ resourceId: "EQ-RET", name: "Retroexcavadora Oruga CAT 320", qtyUsed: 3, unit: "Hora Máquina", edtGroupCode: "EST" });
    } else if (day >= 6 && day < 12) {
      equipos.push({ resourceId: "EQ-MEZ", name: "Mezcladora de Concreto Trompo 9p3", qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "EST" });
      const cementUsed = (day >= 8) ? 90 : 45;
      materials.push({ resourceId: "MAT-CEM", name: "Cemento Portland Tipo I (Bolsa 42.5kg)", qtyConsumed: cementUsed, unit: "Bolsa", edtGroupCode: "EST" });
    } else { // Arquitectura
      materials.push({ resourceId: "MAT-CEM", name: "Cemento Portland Tipo I (Bolsa 42.5kg)", qtyConsumed: 22, unit: "Bolsa", edtGroupCode: "ARQ" });
      materials.push({ resourceId: "MAT-LAD", name: "Ladrillo King Kong Arcilla Cocida 18H", qtyConsumed: 2.1, unit: "Millar", edtGroupCode: "ARQ" });
    }
    
    reports.push({
      id: idReporte,
      projectCode: "MFG-01",
      date: dateString,
      shift,
      effectiveHours,
      supervisor,
      weatherMorning,
      weatherAfternoon,
      activities: dayActivities,
      manoObra,
      materials,
      equipos,
      totalStaff,
      safetyInspected: hseInspected,
      safetyDetails: hseDetails,
      incidents: safetyIncident,
      conflicts,
      plannedNextDay: "Preparar encofrado y control de calidad de materiales.",
      generalNotes: observations,
      signatureUrlLocal: "",
      photoUrlsLocal: [],
      signatureBase64: "",
      photoBase64s: [],
      createdAt: new Date().toISOString()
    });
  }
  
  return reports;
};

// Load submitted reports from disk or start empty
let submittedReports: any[] = [];
if (fs.existsSync(REPORTS_FILE)) {
  try {
    const rawData = fs.readFileSync(REPORTS_FILE, "utf-8");
    submittedReports = JSON.parse(rawData);
    // If it has fewer than 20 reports, let's regenerate it to have the full 20 days of data!
    if (submittedReports.length < 20) {
      console.log(`[RDO BACKEND] Sincronizando base de datos local a un set completo de 20 días.`);
      submittedReports = generate20DaysSyntheticReports();
      fs.writeFileSync(REPORTS_FILE, JSON.stringify(submittedReports, null, 2));
    }
  } catch (err) {
    console.error("Error reading reports JSON, resetting database:", err);
    submittedReports = generate20DaysSyntheticReports();
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(submittedReports, null, 2));
  }
} else {
  submittedReports = generate20DaysSyntheticReports();
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(submittedReports, null, 2));
}

// REST Client API Endpoints

// 1. Get List of active projects
app.get("/api/projects", (req, res) => {
  res.json(REAL_PROJECTS.length > 0 ? REAL_PROJECTS : DEFAULT_PROJECTS);
});


// 2. Get master data (EDT, Planned Value, Resource Catalog, BAC)
app.get("/api/master-data", (req, res) => {
  // BAC = suma de presupuestos de capítulos Nivel 1 (totalBudgetQty cuando unitPrice===0)
  const chapters = DEFAULT_EDT.filter((e: any) => e.parentId === null);
  const bac = chapters.reduce((sum: number, ch: any) => sum + (ch.totalBudgetQty || 0), 0);
  res.json({
    bac,
    edt: DEFAULT_EDT,
    plannedValues: DEFAULT_PV,
    resources: REAL_RESOURCES.length > 0 ? REAL_RESOURCES : DEFAULT_RESOURCES
  });
});

// 2b. Get resources catalog
app.get("/api/resources", (req, res) => {
  res.json(REAL_RESOURCES.length > 0 ? REAL_RESOURCES : DEFAULT_RESOURCES);
});

// 3. Get PV Curve data (Curva S from BD_Metrados_Planificados)
app.get("/api/pv-curve", (req, res) => {
  if (REAL_PV_CURVE.length > 0) {
    res.json(REAL_PV_CURVE);
  } else {
    // Generate fallback PV curve data from DEFAULT_PV
    const pvByDate: Record<string, number> = {};
    const edtLookup: Record<string, any> = {};
    DEFAULT_EDT.forEach(e => { if (e.parentId !== null) edtLookup[e.code] = e; });
    
    DEFAULT_PV.forEach(pv => {
      if (!pvByDate[pv.date]) pvByDate[pv.date] = 0;
      const edt = edtLookup[pv.edtCode];
      pvByDate[pv.date] += pv.plannedQty * (edt?.unitPrice || 1);
    });
    
    const sortedDates = Object.keys(pvByDate).sort();
    let acum = 0;
    const curve = sortedDates.map(date => {
      acum += pvByDate[date];
      return { date, pvDaily: Math.round(pvByDate[date] * 100) / 100, pvCumulative: Math.round(acum * 100) / 100 };
    });
    res.json(curve);
  }
});

// 4. Get PV by chapter data
app.get("/api/pv-chapter", (req, res) => {
  if (REAL_PV_BY_CHAPTER.length > 0) {
    res.json(REAL_PV_BY_CHAPTER);
  } else {
    res.json([]);
  }
});

// 5. Get all submitted reports
app.get("/api/reports", (req, res) => {
  res.json(submittedReports);
});

// 5. Save a new report
app.post("/api/reports", (req, res) => {
  const data = req.body;
  if (!data.date || !data.projectCode || !data.supervisor) {
    return res.status(400).json({ status: "error", message: "Faltan campos obligatorios" });
  }

  // Generate unique ID in the format requested REP-YYYYMMDD-HHMMSS
  const now = new Date();
  const formatNum = (n: number) => n.toString().padStart(2, "0");
  const dateStrShort = `${now.getFullYear()}${formatNum(now.getMonth() + 1)}${formatNum(now.getDate())}`;
  const timeStrShort = `${formatNum(now.getHours())}${formatNum(now.getMinutes())}${formatNum(now.getSeconds())}`;
  const reportId = `REP-${dateStrShort}-${timeStrShort}`;

  // Processing Base64 Files: Signature (Firma)
  let signatureUrlLocal = "";
  if (data.signatureBase64 && data.signatureBase64.includes("base64,")) {
    const base64Data = data.signatureBase64.split(",")[1];
    const fileName = `${reportId}-signature.png`;
    const filePath = path.join(SIGS_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
    signatureUrlLocal = `/data/signatures/${fileName}`;
  }

  // Processing Base64 Files: Construction Progress Photos (Fotos de avance)
  const photoUrlsLocal: string[] = [];
  if (data.photoBase64s && Array.isArray(data.photoBase64s)) {
    data.photoBase64s.forEach((photoBase64: string, index: number) => {
      if (photoBase64 && photoBase64.includes("base64,")) {
        const base64Data = photoBase64.split(",")[1];
        const fileName = `${reportId}-photo-${index + 1}.png`;
        const filePath = path.join(PHOTOS_DIR, fileName);
        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
        photoUrlsLocal.push(`/data/photos/${fileName}`);
      }
    });
  }

  const newReport = {
    ...data,
    id: reportId,
    signatureUrlLocal,
    photoUrlsLocal,
    photoBase64s: [], // clear heavy data to save disk space
    createdAt: new Date().toISOString()
  };

  submittedReports.push(newReport);

  // Write database updates
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(submittedReports, null, 2));

  res.json({
    status: "success",
    reportId: reportId,
    report: newReport
  });
});

// Provide access to saved sign and photo files
app.use("/data/signatures", express.static(SIGS_DIR));
app.use("/data/photos", express.static(PHOTOS_DIR));

// Serve PV curve JSON as static file (for GitHub Pages compat in dev mode)
const PUBLIC_DIR = path.join(process.cwd(), "public");
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

// 6. Smart Project Control Specialist Gemini endpoint
app.post("/api/gemini/analyze", async (req, res) => {
  const { currentReport, projectCode, targetDate } = req.body;
  
  if (!currentReport || !projectCode) {
    return res.status(400).json({ error: "Faltan datos del reporte para realizar el análisis" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    // If key is not configured, send a elegant error message that guides user
    return res.status(200).json({
      notConfigured: true,
      analysis: `El asistente de IA EVM necesita la clave de API de Gemini para funcionar.
      
Para habilitarlo de verdad:
1. Abre el panel de **Secrets** / **Settings** en la esquina superior/inferior de Google AI Studio.
2. Agrega la variable \`GEMINI_API_KEY\` con tu clave de API correspondiente.
3. El asistente analizará en tiempo real tus indicadores de Valor Ganado (SV, CV, SPI, CPI).
      
*(Mientras tanto, te ofrecemos este cálculo automatizado basado en fórmulas locales):*`
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // We build a detailed prompt with the report context and master list so Gemini can act as a real AI controller
    const metricSummary = currentReport.metrics;
    const prompt = `Actúa como un Ingeniero de Control de Proyectos Senior y Especialista en Metodología del Valor Ganado (EVM) para la construcción.
Analiza el siguiente Reporte Diario de Obra (RDO) y sus métricas acumuladas de la fecha ${currentReport.date}:

INFORMACIÓN GENERAL:
- Proyecto: ${projectCode}
- Supervisor: ${currentReport.supervisor}
- Jornada: ${currentReport.shift} (Horas efectivas: ${currentReport.effectiveHours})
- Clima Mañana: ${currentReport.weatherMorning} | Llovizna/Lluvia Tarde: ${currentReport.weatherAfternoon}
- Personal en Obra: ${currentReport.totalStaff} obreros.

MÉTRICAS EVM CALCULADAS DEL REPORTE:
- Valor Planificado (PV): $${metricSummary.plannedValue.toFixed(2)} USD (Meta programada para hoy)
- Valor Ganado (EV): $${metricSummary.earnedValue.toFixed(2)} USD (Trabajo realmente ejecutado valuado a precios de presupuesto)
- Costo Real (AC): $${metricSummary.actualCost.toFixed(2)} USD (Costo real de mano de obra + materiales consumidos + maquinaria)
- Schedule Variance (SV): $${metricSummary.sv.toFixed(2)} USD (Varianza de Cronograma)
- Cost Variance (CV): $${metricSummary.cv.toFixed(2)} USD (Varianza de Costo)
- Schedule Performance Index (SPI): ${metricSummary.spi.toFixed(3)} (Eficiencia de Plazo)
- Cost Performance Index (CPI): ${metricSummary.cpi.toFixed(3)} (Eficiencia de Costo)

DETALLE DE ACTIVIDADES EJECUTADAS HOY:
${JSON.stringify(currentReport.activities, null, 2)}

DETALLE DE RECURSOS CONSUMIDOS HOY:
- Mano de Obra: ${JSON.stringify(currentReport.manoObra, null, 2)}
- Materiales: ${JSON.stringify(currentReport.materials, null, 2)}
- Equipos: ${JSON.stringify(currentReport.equipos, null, 2)}

CONTROL Y SEGURIDAD:
- Inspección realizada: ${currentReport.safetyInspected ? 'SÍ' : 'NO'} (${currentReport.safetyDetails})
- Incidentes: ${currentReport.incidents}

DIAGNÓSTICO Y PLANIFICACIÓN DE CAMPO:
- Restricciones/Conflictos: ${currentReport.conflicts}
- Trabajo programado para mañana: ${currentReport.plannedNextDay}
- Notas generales: ${currentReport.generalNotes}

Por favor, elabora un análisis constructivo súper detallado, ejecutivo y ordenado que contenga:
1. **Diagnóstico del Estado del Proyecto (Plazo y Costo)**: Explica de forma concisa qué significan los números de CPI y SPI actuales. ¿Estamos adelantados o retrasados? ¿Gastando más o menos del presupuesto?
2. **Análisis de Causas**: Relaciona el rendimiento (bajo o alto) con el clima, recursos (horas hombre), restricciones reportadas, materiales y equipos utilizados.
3. **Planes de Acción y Mitigación**: Propón 3 recomendaciones realistas de obra para nivelar o mejorar la productividad mañana, considerando el plan del día siguiente y las restricciones identificadas.
4. **Alerta de Seguridad**: Breve comentario sobre el estado preventivo en obra basado en las notas de seguridad e incidentes.

Redacta de manera profesional en español con formato Markdown limpio y elegante. ¡Sé preciso y ve al grano en tus comentarios!`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Eres un Ingeniero Principal de Control de Proyectos con foco en Costos y Cronogramas utilizando Earned Value Management (EVM). Escribes con tono claro, analítico, y ejecutivo.",
        temperature: 0.7,
      }
    });

    res.json({
      status: "success",
      analysis: response.text
    });
  } catch (err: any) {
    console.error("Gemini API Call error:", err);
    res.status(500).json({ error: "Fallo de conexión o límites excedidos al consultar el servicio de IA de Gemini: " + err.message });
  }
});

// Serve Vite or static assets depending on environment
const startServer = async () => {
  if (process.env.NODE_ENV === "production") {
    // Production mode: serve pre-built frontend
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[RDO BACKEND] Servidor Express corriendo en el puerto ${PORT}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[RDO BACKEND] Modo desarrollo: inicia Vite aparte con "npx vite" en otra terminal (puerto 5173)`);
    }
  });
};

startServer();
