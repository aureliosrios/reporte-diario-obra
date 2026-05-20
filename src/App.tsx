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
  { id: "PRJ-001", name: "Edificio Multifamiliar Girasoles", code: "MFG-01", location: "Lima, San Isidro", manager: "Ing. Alejandro Rivas" },
  { id: "PRJ-002", name: "Condominio de Playa Las Brisas", code: "CPLB-02", location: "Asia, KM 98", manager: "Ing. Claudia Mendoza" }
];

// BACKUP_EDT: usado SOLO si tanto el servidor Express como el archivo estático
// /data/pv-edt-data.json fallan. Refleja la estructura real del proyecto.
const BACKUP_EDT: EdtItem[] = [
  // Capítulos Nivel 1 (7 capítulos del proyecto real)
  { code: "OBR-PRE", parentId: null, name: "Obras Preliminares",  unit: "Global", totalBudgetQty: 41500,   unitPrice: 0 },
  { code: "CIM",     parentId: null, name: "Cimentación",          unit: "Global", totalBudgetQty: 249700,  unitPrice: 0 },
  { code: "EST",     parentId: null, name: "Estructura",           unit: "Global", totalBudgetQty: 424200,  unitPrice: 0 },
  { code: "ALB",     parentId: null, name: "Albañilería",           unit: "Global", totalBudgetQty: 125500,  unitPrice: 0 },
  { code: "INS",     parentId: null, name: "Instalaciones",         unit: "Global", totalBudgetQty: 95700,   unitPrice: 0 },
  { code: "ACA",     parentId: null, name: "Acabados",              unit: "Global", totalBudgetQty: 170100,  unitPrice: 0 },
  { code: "OBR-EXT", parentId: null, name: "Obras Exteriores",      unit: "Global", totalBudgetQty: 66200,   unitPrice: 0 },
];

const BACKUP_RESOURCES: ResourceItem[] = [
  { id: "LH-CAP", name: "Capataz de Edificación", type: "mano_obra", unit: "Hora Hombre", unitCost: 28.0 },
  { id: "LH-OPE", name: "Operario Civil", type: "mano_obra", unit: "Hora Hombre", unitCost: 22.5 },
  { id: "LH-OFI", name: "Oficial Carpintero/Fierrero", type: "mano_obra", unit: "Hora Hombre", unitCost: 18.0 },
  { id: "LH-PEO", name: "Peón de Construcción", type: "mano_obra", unit: "Hora Hombre", unitCost: 14.5 },
  { id: "MAT-CEM", name: "Cemento Portland Tipo I (Bolsa 42.5kg)", type: "material", unit: "Bolsa", unitCost: 8.9 },
  { id: "MAT-ARE", name: "Arena Gruesa", type: "material", unit: "m3", unitCost: 24.0 },
  { id: "MAT-LAD", name: "Ladrillo King Kong Arcilla Cocida 18H", type: "material", unit: "Millar", unitCost: 320.0 },
  { id: "EQ-MEZ", name: "Mezcladora de Concreto Trompo 9p3", type: "equipo", unit: "Hora Máquina", unitCost: 12.0 },
  { id: "EQ-RET", name: "Retroexcavadora Oruga CAT 320", type: "equipo", unit: "Hora Máquina", unitCost: 48.0 }
];

const generateBackupPlannedValues = (): PlannedValue[] => {
  const values: PlannedValue[] = [];
  const baseDate = new Date("2026-05-15");
  
  for (let i = 0; i < 20; i++) {
    const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
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

const generate20DaysSyntheticReports = (): DailyReport[] => {
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
        dayActivities.push({ edtCode: "EST-03", name: "Concreto de columnas", unit: "m3", plannedQty: 30, qtyExecuted: 25 + (dEst - 3) * 2, notes: "Vaciado concreto f\'c=280 kg/cm2" });
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
        materials.push({ resourceId: "MAT-ACE", name: "Fierro Corrugado Grade 60 1/2\"", qtyConsumed: 28, unit: "Varilla", edtGroupCode: "CIM" });
      }
    } else {
      equipos.push({ resourceId: "EQ-MEZ", name: "Mezcladora de Concreto Trompo 9p3",   qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "EST" });
      equipos.push({ resourceId: "EQ-VIB", name: "Vibradora de Concreto Naftera 2\"",   qtyUsed: effectiveHours, unit: "Hora Máquina", edtGroupCode: "EST" });
      materials.push({ resourceId: "MAT-CEM", name: "Cemento Portland Tipo I",           qtyConsumed: day >= 13 ? 90 : 45, unit: "Bolsa",   edtGroupCode: "EST" });
      materials.push({ resourceId: "MAT-ACE", name: "Fierro Corrugado Grade 60 1/2\"",  qtyConsumed: 18,                  unit: "Varilla", edtGroupCode: "EST" });
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
          const data = await response.json();
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
        console.warn("[RDO] Usando BACKUP_EDT de emergencia (7 capítulos aproximados)");
        setEdtList(BACKUP_EDT);
        setPlannedValues(generateBackupPlannedValues());
      }

      // ── Intento 2: Cargar recursos desde JSON estático ──
      try {
        const rRes = await fetch("/data/resources.json");
        if (rRes.ok) {
          setResources(await rRes.json());
        }
      } catch {
        // queda BACKUP_RESOURCES del estado inicial
      }

      // ── Intento 3: Curva S acumulada del proyecto ──
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

      // ── Intento 4: PV por capítulo ──
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
