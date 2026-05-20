import React, { useState, useEffect } from "react";
import { SmartMockup } from "./components/SmartMockup";
import { ReportForm } from "./components/ReportForm";
import { ProjectDashboard } from "./components/ProjectDashboard";
import { GoogleScriptDocs } from "./components/GoogleScriptDocs";
import { Project, EdtItem, PlannedValue, ResourceItem, DailyReport, EvmMetrics } from "./types";
import { 
  Building2, LineChart, FileText, ChevronRight, Loader2, Info, HardHat, Compass, ServerCrash, ExternalLink, Settings2
} from "lucide-react";

// Backup fallback structures if server fetch fails or is slow
const BACKUP_PROJECTS: Project[] = [
  { id: "PRJ-001", name: "Edificio Multifamiliar Girasoles", code: "MFG-01", location: "Lima, San Isidro", manager: "Ing. Alejandro Rivas" },
  { id: "PRJ-002", name: "Condominio de Playa Las Brisas", code: "CPLB-02", location: "Asia, KM 98", manager: "Ing. Claudia Mendoza" }
];

const BACKUP_EDT: EdtItem[] = [
  { code: "EST", parentId: null, name: "Estructuras", unit: "Global", totalBudgetQty: 1, unitPrice: 0 },
  { code: "ARQ", parentId: null, name: "Arquitectura", unit: "Global", totalBudgetQty: 1, unitPrice: 0 },
  { code: "MEP", parentId: null, name: "Instalaciones MEP", unit: "Global", totalBudgetQty: 1, unitPrice: 0 },
  { code: "EST-01", parentId: "EST", name: "Obras Provisionales y Trabajos Preliminares", unit: "m2", totalBudgetQty: 250, unitPrice: 25 },
  { code: "EST-02", parentId: "EST", name: "Movimiento de Tierras - Excavación masiva", unit: "m3", totalBudgetQty: 1200, unitPrice: 18 },
  { code: "EST-03", parentId: "EST", name: "Concreto de Columnas y Placas (f'c=280 kg/cm2)", unit: "m3", totalBudgetQty: 480, unitPrice: 135 },
  { code: "EST-04", parentId: "EST", name: "Concreto de Vigas y Losas Aligeradas", unit: "m3", totalBudgetQty: 550, unitPrice: 120 },
  { code: "ARQ-01", parentId: "ARQ", name: "Muros de Albañilería de Ladrillo KK", unit: "m2", totalBudgetQty: 1800, unitPrice: 16 },
  { code: "ARQ-02", parentId: "ARQ", name: "Tarrajeo Frotachado en Interiores", unit: "m2", totalBudgetQty: 3200, unitPrice: 8.5 }
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

export default function App() {
  const [activeTab, setActiveTab] = useState<"campo" | "control" | "sheets">("control");
  const [projects, setProjects] = useState<Project[]>(BACKUP_PROJECTS);
  const [edtList, setEdtList] = useState<EdtItem[]>(BACKUP_EDT);
  const [plannedValues, setPlannedValues] = useState<PlannedValue[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>(BACKUP_RESOURCES);
  const [reports, setReports] = useState<DailyReport[]>([]);
  
  // Custom Apps script link string saved in localstorage
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Sync / Load Initial database from Express Server API or Local fallback
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const pRes = await fetch("/api/projects");
      const pData = await pRes.json();
      setProjects(pData);

      const mRes = await fetch("/api/master-data");
      const mData = await mRes.json();
      setEdtList(mData.edt);
      setPlannedValues(mData.plannedValues);
      setResources(mData.resources);

      const rRes = await fetch("/api/reports");
      const rData = await rRes.json();
      setReports(rData);

      setIsOfflineMode(false);
    } catch (err) {
      console.warn("Express API Server is booting or offline, loading resilient static fallback variables:", err);
      // Fallback: seed planned values for backup timeline
      const mockPv: PlannedValue[] = [];
      const todayStr = new Date().toISOString().split("T")[0];
      BACKUP_EDT.forEach(edt => {
        mockPv.push({ date: todayStr, edtCode: edt.code, plannedQty: 25 });
      });
      setPlannedValues(mockPv);
      setIsOfflineMode(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Load custom webhook URL from storage
    const storedUrl = localStorage.getItem("RDO_APPS_SCRIPT_WEBHOOK");
    if (storedUrl) {
      setAppsScriptUrl(storedUrl);
    }
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
              projectName={projects.length > 0 ? projects[0].name : "Edificio Girasoles"}
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
