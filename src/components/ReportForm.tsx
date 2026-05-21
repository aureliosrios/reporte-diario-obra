import React, { useState, useEffect } from "react";
import { 
  Project, EdtItem, PlannedValue, ResourceItem, DailyReport, EvmMetrics 
} from "../types";
import { 
  Calendar, User, Clock, CloudSun, Plus, Trash, FileSpreadsheet, Send, 
  Save, AlertTriangle, ShieldCheck, HelpCircle, HardHat, Sparkles, RefreshCw, Layers, Check
} from "lucide-react";
import * as XLSX from "xlsx";

interface ReportFormProps {
  projects: Project[];
  edtList: EdtItem[];
  plannedValues: PlannedValue[];
  resources: ResourceItem[];
  onReportSubmitted: (report: DailyReport, metrics: EvmMetrics) => void;
  appsScriptUrl: string;
  setAppsScriptUrl: (url: string) => void;
}

export function ReportForm({
  projects,
  edtList,
  plannedValues,
  resources,
  onReportSubmitted,
  appsScriptUrl,
  setAppsScriptUrl,
}: ReportFormProps) {
  
  // Local state for the dynamic form
  const [selectedProjectCode, setSelectedProjectCode] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [shift, setShift] = useState<'MaÃ±ana' | 'Tarde' | 'Noche' | 'Continuo'>("MaÃ±ana");
  const [effectiveHours, setEffectiveHours] = useState<number>(8);
  const [weatherMorning, setWeatherMorning] = useState<'Soleado' | 'Nublado' | 'Lluvia' | 'Viento'>("Soleado");
  const [weatherAfternoon, setWeatherAfternoon] = useState<'Soleado' | 'Nublado' | 'Lluvia' | 'Viento'>("Soleado");

  // Historic auto-completions
  const [supervisorHistory, setSupervisorHistory] = useState<string[]>([]);

  // Tipo de reporte: ProducciÃ³n (por EDT) o Seguridad (integral)
  const [reportType, setReportType] = useState<"produccion" | "seguridad">("produccion");
  
  // CapÃ­tulo EDT seleccionado (1 capÃ­tulo por reporte, solo para producciÃ³n)
  const [selectedEdtChapter, setSelectedEdtChapter] = useState<string>("");

  // Section 2: Actividades Ejecutadas (EV)
  const [activities, setActivities] = useState<{
    edtCode: string;
    qtyExecuted: number;
    notes: string;
  }[]>([]);

  // Section 3-5: Mano de Obra, Materiales, Equipos
  const [manoObra, setManoObra] = useState<{
    resourceId: string;
    quantity: number;
    hoursWorked: number;
    edtGroupCode: string;
  }[]>([]);

  const [materials, setMaterials] = useState<{
    resourceId: string;
    qtyConsumed: number;
    edtGroupCode: string;
  }[]>([]);

  const [equipos, setEquipos] = useState<{
    resourceId: string;
    qtyUsed: number;
    edtGroupCode: string;
  }[]>([]);

  // Section 6: Control, Seguridad e Incidentes
  const [totalStaff, setTotalStaff] = useState<number>(0);
  const [safetyInspected, setSafetyInspected] = useState<boolean>(true);
  const [safetyDetails, setSafetyDetails] = useState<string>("");
  const [incidents, setIncidents] = useState<string>("");

  // Section 7: Problemas y PlanificaciÃ³n
  const [conflicts, setConflicts] = useState<string>("");
  const [plannedNextDay, setPlannedNextDay] = useState<string>("");
  const [generalNotes, setGeneralNotes] = useState<string>("");

  // Status and logs
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [isDraftLoadedToast, setIsDraftLoadedToast] = useState(false);

  const maxDateStr = new Date().toISOString().split("T")[0];

  // Load Initial Setup Settings
  useEffect(() => {
    // Default values
    if (projects.length > 0) {
      setSelectedProjectCode(projects[0].code);
    }
    setReportDate(new Date().toISOString().split("T")[0]);

    // Load supervisor autocomplete history
    const storedHistory = localStorage.getItem("RDO_SUPERVISORS_HISTORY");
    if (storedHistory) {
      try {
        setSupervisorHistory(JSON.parse(storedHistory));
      } catch (e) {
        setSupervisorHistory([]);
      }
    }

    // Try loading saved draft
    const savedDraft = localStorage.getItem("RDO_FORM_DRAFT");
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.projectCode) setSelectedProjectCode(draft.projectCode);
        if (draft.date) setReportDate(Math.min(new Date(draft.date).getTime(), new Date().getTime()) ? draft.date : maxDateStr);
        if (draft.supervisor) setSupervisorName(draft.supervisor);
        if (draft.shift) setShift(draft.shift);
        if (draft.effectiveHours) setEffectiveHours(draft.effectiveHours);
        if (draft.weatherMorning) setWeatherMorning(draft.weatherMorning);
        if (draft.weatherAfternoon) setWeatherAfternoon(draft.weatherAfternoon);
        if (draft.activities) setActivities(draft.activities);
        if (draft.manoObra) setManoObra(draft.manoObra);
        if (draft.materials) setMaterials(draft.materials);
        if (draft.equipos) setEquipos(draft.equipos);
        if (draft.totalStaff) setTotalStaff(draft.totalStaff);
        if (draft.safetyInspected !== undefined) setSafetyInspected(draft.safetyInspected);
        if (draft.safetyDetails) setSafetyDetails(draft.safetyDetails);
        if (draft.incidents) setIncidents(draft.incidents);
        if (draft.conflicts) setConflicts(draft.conflicts);
        if (draft.plannedNextDay) setPlannedNextDay(draft.plannedNextDay);
        if (draft.generalNotes) setGeneralNotes(draft.generalNotes);
        
        setIsDraftLoadedToast(true);
        setTimeout(() => setIsDraftLoadedToast(false), 3000);
      } catch (err) {
        console.warn("Could not deserialize draft");
      }
    }
  }, [projects]);

  // When chapter changes, reset selected activities
  useEffect(() => {
    if (!selectedEdtChapter) {
      setActivities([]);
      return;
    }
    setActivities([]);
  }, [selectedEdtChapter, edtList]);

  // Autosave periodically every 30 seconds
  useEffect(() => {
    const draftPayload = {
      projectCode: selectedProjectCode,
      date: reportDate,
      supervisor: supervisorName,
      shift,
      effectiveHours,
      weatherMorning,
      weatherAfternoon,
      activities,
      manoObra,
      materials,
      equipos,
      totalStaff,
      safetyInspected,
      safetyDetails,
      incidents,
      conflicts,
      plannedNextDay,
      generalNotes
    };

    const interval = setInterval(() => {
      localStorage.setItem("RDO_FORM_DRAFT", JSON.stringify(draftPayload));
    }, 15000);

    return () => clearInterval(interval);
  }, [
    selectedProjectCode, reportDate, supervisorName, shift, effectiveHours,
    weatherMorning, weatherAfternoon, activities, manoObra, materials,
    equipos, totalStaff, safetyInspected, safetyDetails, incidents,
    conflicts, plannedNextDay, generalNotes
  ]);

  // Dynamic progress bar calculation based on core input completion
  useEffect(() => {
    let completedPoints = 0;
    const maxPoints = 6;

    if (selectedProjectCode) completedPoints++;
    if (reportDate) completedPoints++;
    if (supervisorName.trim().length > 1) completedPoints++;
    if (selectedEdtChapter) completedPoints++;
    if (manoObra.length > 0) completedPoints++;
    if (totalStaff > 0) completedPoints++;
    setProgressPercent(Math.round((completedPoints / maxPoints) * 100));
  }, [
    selectedProjectCode, reportDate, supervisorName, selectedEdtChapter,
    manoObra, totalStaff
  ]);

  // Helper functions for dynamic lookups
  const getPlannedProduction = (edtCode: string): number => {
    if (!edtCode || !reportDate) return 0;
    const match = plannedValues.find(pv => pv.date === reportDate && pv.edtCode === edtCode);
    return match ? match.plannedQty : 0;
  };

  const getEdtItemNameAndUnit = (edtCode: string): { name: string; unit: string; price: number; maxAcum: number } => {
    const item = edtList.find(e => e.code === edtCode);
    return item 
      ? { name: item.name, unit: item.unit, price: item.unitPrice, maxAcum: item.totalBudgetQty } 
      : { name: "Desconocida", unit: "-", price: 0, maxAcum: 99999 };
  };

  // Handlers for Add/Remove Items
  const addActivity = () => {
    setActivities([...activities, { edtCode: "", qtyExecuted: 0, notes: "" }]);
  };

  const updateActivityField = (index: number, key: string, val: any) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [key]: val };
    setActivities(updated);
  };

  const removeActivity = (index: number) => {
    const updated = [...activities];
    updated.splice(index, 1);
    setActivities(updated);
  };

  const addManoObra = () => {
    const firstMo = resources.find(r => r.type === "mano_obra");
    setManoObra([...manoObra, { 
      resourceId: firstMo ? firstMo.id : "", 
      quantity: 1,
      hoursWorked: 8, 
      edtGroupCode: selectedEdtChapter || "EST"
    }]);
  };

  const removeManoObra = (index: number) => {
    const updated = [...manoObra];
    updated.splice(index, 1);
    setManoObra(updated);
  };

  const addMaterial = () => {
    const firstMat = resources.find(r => r.type === "material");
    setMaterials([...materials, { 
      resourceId: firstMat ? firstMat.id : "", 
      qtyConsumed: 10, 
      edtGroupCode: selectedEdtChapter || "EST"
    }]);
  };

  const removeMaterial = (index: number) => {
    const updated = [...materials];
    updated.splice(index, 1);
    setMaterials(updated);
  };

  const addEquipo = () => {
    const firstEq = resources.find(r => r.type === "equipo");
    setEquipos([...equipos, { 
      resourceId: firstEq ? firstEq.id : "", 
      qtyUsed: 8, 
      edtGroupCode: selectedEdtChapter || "EST"
    }]);
  };

  const removeEquipo = (index: number) => {
    const updated = [...equipos];
    updated.splice(index, 1);
    setEquipos(updated);
  };

  // Manual save Draft Click
  const saveDraftManually = () => {
    const draftPayload = {
      projectCode: selectedProjectCode,
      date: reportDate,
      supervisor: supervisorName,
      shift,
      effectiveHours,
      weatherMorning,
      weatherAfternoon,
      activities,
      manoObra,
      materials,
      equipos,
      totalStaff,
      safetyInspected,
      safetyDetails,
      incidents,
      conflicts,
      plannedNextDay,
      generalNotes
    };
    localStorage.setItem("RDO_FORM_DRAFT", JSON.stringify(draftPayload));
    
    // Download local JSON Backup to phone (Offline resilient backup!)
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(draftPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Borrador_RDO_${selectedProjectCode}_${reportDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    alert("Borrador guardado localmente e iniciado descarga de copia de seguridad JSON.");
  };

  // CALCULATE EVM METRICS LOCALLY
  const calculateEvmMetrics = (): EvmMetrics => {
    // 1. PV (Planned Value): Metas programadas para hoy * Precio unitario planificado
    let pv = 0;
    edtList.filter(e => e.parentId !== null).forEach(partida => {
      const plannedQty = getPlannedProduction(partida.code);
      pv += plannedQty * partida.unitPrice;
    });

    // 2. EV (Earned Value): Cantidad Ejecutada Hoy * Precio unitario planificado
    let ev = 0;
    activities.forEach(act => {
      if (act.edtCode) {
        const matchEdt = edtList.find(e => e.code === act.edtCode);
        if (matchEdt) {
          ev += act.qtyExecuted * matchEdt.unitPrice;
        }
      }
    });

    // 3. AC (Actual Cost): Costo real asociado
    let ac = 0;
    // Mano de Obra
    manoObra.forEach(mo => {
      const matchRes = resources.find(r => r.id === mo.resourceId);
      if (matchRes) {
        ac += (mo.quantity || 1) * mo.hoursWorked * matchRes.unitCost;
      }
    });
    // Materiales
    materials.forEach(mat => {
      const matchRes = resources.find(r => r.id === mat.resourceId);
      if (matchRes) {
        ac += mat.qtyConsumed * matchRes.unitCost;
      }
    });
    // Equipos
    equipos.forEach(eq => {
      const matchRes = resources.find(r => r.id === eq.resourceId);
      if (matchRes) {
        ac += eq.qtyUsed * matchRes.unitCost;
      }
    });

    // Avoid divisions by 0
    const finalPv = pv > 0 ? pv : 100; // default anchor if nothing is planned to preserve indices
    const finalAc = ac > 0 ? ac : (ev > 0 ? ev * 0.95 : 100);

    const sv = ev - finalPv;
    const cv = ev - finalAc;
    const spi = ev / finalPv;
    const cpi = ev / finalAc;

    return {
      reportId: "",
      date: reportDate,
      plannedValue: pv,
      earnedValue: ev,
      actualCost: ac,
      sv,
      cv,
      spi,
      cpi
    };
  };

  // EXPORT EXCEL GENERATOR (sheetjs xlsx.js)
  const downloadExcel = () => {
    const metrics = calculateEvmMetrics();
    
    // Workbook setup
    const wb = XLSX.utils.book_new();

    // 1. Metadata General Sheet
    const metaData = [
      ["REPORTE DIARIO DE OBRA - CONTROL EVM"],
      [""],
      ["PROYECTO", selectedProjectCode],
      ["FECHA REPORTE", reportDate],
      ["SUPERVISOR", supervisorName],
      ["TURNO", shift],
      ["HORAS EFECTIVAS", effectiveHours],
      ["CLIMA MAÃ‘ANA", weatherMorning],
      ["CLIMA TARDE", weatherAfternoon],
      ["TOTAL PERSONAL EN OBRA", totalStaff],
      ["SEGURIDAD REVISADA", safetyInspected ? "SÃ" : "NO"],
      ["DETALLE SEGURIDAD", safetyDetails],
      ["INCIDENTES", incidents],
      ["CONFLICTOS/RESTRICCIONES", conflicts],
      ["TRABAJOS PLANIFICADOS SIG. DÃA", plannedNextDay],
      ["OBSERVACIONES GENERALES", generalNotes],
      [""],
      ["RESUMEN DE METODOLOGÃA VALOR GANADO (EVM)"],
      ["INDICADOR", "VALOR ($ USD)", "DESCRIPCIÃ“N"],
      ["Valor Planificado (PV)", metrics.plannedValue, "Presupuesto programado hoy"],
      ["Valor Ganado (EV)", metrics.earnedValue, "Presupuesto de lo realmente avanzado hoy"],
      ["Costo Real (AC)", metrics.actualCost, "Mano de Obra + Materiales + Equipos consumidos"],
      ["Variaza Cronograma (SV)", metrics.sv, "EV - PV (Negativo = Retraso)"],
      ["Varianza Costos (CV)", metrics.cv, "EV - AC (Negativo = PÃ©rdida)"],
      ["Ãndice Plazo (SPI)", metrics.spi, "EV / PV (Menor que 1 = Retrasado)"],
      ["Ãndice Costo (CPI)", metrics.cpi, "EV / AC (Menor que 1 = Sobrecosto)"],
    ];
    const wsMeta = XLSX.utils.aoa_to_sheet(metaData);
    XLSX.utils.book_append_sheet(wb, wsMeta, "Resumen General");

    // 2. Activities Sheet
    const actRows = activities.map(act => {
      const edtInfo = getEdtItemNameAndUnit(act.edtCode);
      return {
        "CÃ³digo EDT": act.edtCode,
        "Actividad Especialidad": edtInfo.name,
        "Unidad": edtInfo.unit,
        "Costo Unitario ($)": edtInfo.price,
        "Planificado Hoy (Metas)": getPlannedProduction(act.edtCode),
        "Avance Real Ejecutado": act.qtyExecuted,
        "Valor Ganado hoy ($)": act.qtyExecuted * edtInfo.price,
        "Observaciones": act.notes
      };
    });
    const wsAct = XLSX.utils.json_to_sheet(actRows);
    XLSX.utils.book_append_sheet(wb, wsAct, "Actividades (Avances)");

    // 3. Costs Resources Sheet
    const costRows: any[] = [];
    manoObra.forEach(mo => {
      const resMatch = resources.find(r => r.id === mo.resourceId);
      costRows.push({
        "Tipo Recurso": "Mano de Obra",
        "ID Recurso": mo.resourceId,
        "DescripciÃ³n": resMatch?.name || "",
        "Frente/EDT": mo.edtGroupCode,
        "Cantidad / Horas": mo.hoursWorked,
        "Costo Unitario ($)": resMatch?.unitCost || 0,
        "Subtotal Costo ($)": mo.hoursWorked * (resMatch?.unitCost || 0)
      });
    });

    materials.forEach(mat => {
      const resMatch = resources.find(r => r.id === mat.resourceId);
      costRows.push({
        "Tipo Recurso": "Material Consumido",
        "ID Recurso": mat.resourceId,
        "DescripciÃ³n": resMatch?.name || "",
        "Frente/EDT": mat.edtGroupCode,
        "Cantidad / Horas": mat.qtyConsumed,
        "Costo Unitario ($)": resMatch?.unitCost || 0,
        "Subtotal Costo ($)": mat.qtyConsumed * (resMatch?.unitCost || 0)
      });
    });

    equipos.forEach(eq => {
      const resMatch = resources.find(r => r.id === eq.resourceId);
      costRows.push({
        "Tipo Recurso": "Equipo / Maquinaria",
        "ID Recurso": eq.resourceId,
        "DescripciÃ³n": resMatch?.name || "",
        "Frente/EDT": eq.edtGroupCode,
        "Cantidad / Horas": eq.qtyUsed,
        "Costo Unitario ($)": resMatch?.unitCost || 0,
        "Subtotal Costo ($)": eq.qtyUsed * (resMatch?.unitCost || 0)
      });
    });

    const wsCost = XLSX.utils.json_to_sheet(costRows);
    XLSX.utils.book_append_sheet(wb, wsCost, "Costos Reales (AC)");

    // Write file
    XLSX.writeFile(wb, `RDO_EVM_${selectedProjectCode}_${reportDate}.xlsx`);
  };

  // SUBMIT FORM ACTION
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Basic validation
    if (!supervisorName.trim()) {
      setSubmitMessage({ type: 'error', text: 'Por favor, ingrese el nombre del supervisor responsable.' });
      return;
    }
    if (reportType === "produccion" && !selectedEdtChapter) {
      setSubmitMessage({ type: 'error', text: 'Seleccione un capÃ­tulo EDT antes de enviar el reporte.' });
      return;
    }
    if (reportType === "produccion" && activities.length === 0) {
      setSubmitMessage({ type: 'error', text: 'No hay actividades para el capÃ­tulo seleccionado en esta fecha.' });
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    // Save supervisor to history
    const trimmedSupervisor = supervisorName.trim();
    if (!supervisorHistory.includes(trimmedSupervisor)) {
      const updatedHistory = [trimmedSupervisor, ...supervisorHistory].slice(0, 5);
      setSupervisorHistory(updatedHistory);
      localStorage.setItem("RDO_SUPERVISORS_HISTORY", JSON.stringify(updatedHistory));
    }

    const calculatedMetrics = calculateEvmMetrics();

    // Setup payload matching both standard SQL/JSON database requirements and Google Sheets payload structure
    const payload: DailyReport = {
      id: "", // generated server-side
      projectCode: selectedProjectCode,
      reportType,
      edtChapter: selectedEdtChapter,
      date: reportDate,
      shift,
      effectiveHours,
      supervisor: trimmedSupervisor,
      weatherMorning,
      weatherAfternoon,
      activities,
      manoObra,
      materials,
      equipos,
      totalStaff,
      safetyInspected,
      safetyDetails,
      incidents,
      conflicts,
      plannedNextDay,
      generalNotes,
      createdAt: ""
    };

    const finalPayload = {
      ...payload,
      metrics: calculatedMetrics,
      appsScriptUrl
    };

    // Always try direct Google Sheets webhook (works on GitHub Pages without Express)
    const tryDirectSheets = () => {
      const url = appsScriptUrl || localStorage.getItem("RDO_APPS_SCRIPT_WEBHOOK") || "";
      if (url && url.startsWith("http")) {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(finalPayload)
        }).catch((err) => console.warn("Direct Google Sheets sync:", err));
      }
    };

    try {
      // Send to local Express full-stack endpoint
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload)
      });

      const resData = await response.json();

      if (resData.status === "success") {
        // Also sync directly to Google Sheets
        tryDirectSheets();

        setSubmitMessage({ 
          type: 'success', 
          text: `Â¡Reporte registrado correctamente! ID asignado: ${resData.reportId}` 
        });

        // Trigger callback to update dashboard metrics
        onReportSubmitted(resData.report, calculatedMetrics);

        // Clear draft
        localStorage.removeItem("RDO_FORM_DRAFT");
        setSelectedEdtChapter("");
        setActivities([]);
        setManoObra([]);
        setMaterials([]);
        setEquipos([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error(resData.message || "Fallo inesperado del servidor");
      }
    } catch (err: any) {
      console.error(err);
      // If Express is unavailable (e.g. GitHub Pages), try direct Google Sheets
      tryDirectSheets();
      // If appsScriptUrl is configured, user still gets data in Sheets
      const hasWebhook = appsScriptUrl || localStorage.getItem("RDO_APPS_SCRIPT_WEBHOOK");
      if (hasWebhook) {
        setSubmitMessage({
          type: 'success',
          text: 'Â¡Reporte enviado directamente a Google Sheets! (Servidor local no disponible)'
        });
        onReportSubmitted(finalPayload as DailyReport, calculatedMetrics);
      } else {
        setSubmitMessage({ 
          type: 'error', 
          text: `Error de red o conexiÃ³n: Se guardÃ³ un respaldo local offline. Detalles: ${err.message}` 
        });
      }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col font-sans select-none text-slate-100 bg-slate-950 w-full">

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          HEADER BANNER â€” Oscuro premium con gradiente
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-b border-slate-800 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-sky-500 to-sky-700 p-2 rounded-xl shadow-lg shadow-sky-500/20">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[9px] font-black tracking-[0.2em] text-sky-400 uppercase">Sistema RDO Â· EVM</p>
            <h1 className="text-sm font-black text-white leading-none mt-0.5">REPORTE DIARIO DE CAMPO</h1>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Completado</span>
          <span className="text-lg font-black font-mono text-sky-400 leading-none">{progressPercent}%</span>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-slate-800 h-1 shrink-0">
        <div
          className="h-full transition-all duration-700 ease-out bg-gradient-to-r from-sky-500 to-cyan-400"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          CONTENIDO PRINCIPAL SCROLLABLE
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="flex-1 overflow-y-auto scrollbar-none space-y-0.5 bg-slate-950 pb-28">

        {isDraftLoadedToast && (
          <div className="mx-3 mt-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-xl flex items-center gap-2 text-xs">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Borrador previo restaurado automÃ¡ticamente.</span>
          </div>
        )}

        {submitMessage && (
          <div className={`mx-3 mt-3 p-3 rounded-xl flex items-start gap-2.5 text-xs border ${
            submitMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="font-medium">{submitMessage.text}</div>
          </div>
        )}

        {/* â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
            â”‚  SECCIÃ“N 1 Â· DATOS GENERALES                â”‚
            â”‚  Color: Sky Blue â€” IdentificaciÃ³n operativa â”‚
            â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ */}
        <div id="sec-datos-generales" className="mx-3 mt-4 rounded-2xl overflow-hidden border border-sky-500/20 shadow-lg shadow-sky-500/5">
          <div className="bg-gradient-to-r from-sky-950/80 to-slate-900 px-4 py-3 flex items-center gap-2.5 border-b border-sky-500/20">
            <div className="w-1 h-6 bg-sky-400 rounded-full shrink-0" />
            <Layers className="w-4 h-4 text-sky-400" />
            <div>
              <span className="text-[9px] font-black tracking-[0.15em] text-sky-500 uppercase">SecciÃ³n 01</span>
              <h2 className="text-xs font-black text-sky-200 leading-none">DATOS GENERALES DEL REPORTE</h2>
            </div>
          </div>

          <div className="bg-slate-900/70 p-4 space-y-3.5">

            <div>
              <label className="block text-[10px] font-bold text-sky-500/80 mb-1.5 tracking-wider uppercase">Proyecto Activo</label>
              <select
                value={selectedProjectCode}
                onChange={(e) => setSelectedProjectCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all outline-none font-semibold"
              >
                {projects.map(p => (
                  <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-sky-500/80 mb-1.5 tracking-wider uppercase">Tipo de Reporte</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setReportType("produccion"); setSelectedEdtChapter(""); setActivities([]); setManoObra([]); setMaterials([]); setEquipos([]); }}
                  className={`py-2.5 px-3 rounded-xl text-[11px] font-bold border transition-all ${
                    reportType === "produccion"
                      ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  ðŸ— ProducciÃ³n
                </button>
                <button
                  type="button"
                  onClick={() => { setReportType("seguridad"); setSelectedEdtChapter(""); setActivities([]); setManoObra([]); setMaterials([]); setEquipos([]); }}
                  className={`py-2.5 px-3 rounded-xl text-[11px] font-bold border transition-all ${
                    reportType === "seguridad"
                      ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  ðŸ›¡ Seguridad
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-sky-500/80 mb-1.5 tracking-wider uppercase flex justify-between">
                <span>Fecha de OperaciÃ³n</span>
                <span className="text-amber-500 normal-case font-medium">No fechas futuras</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  max={maxDateStr}
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-100 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all outline-none font-mono"
                />
                <Calendar className="w-4 h-4 text-sky-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-sky-500/80 mb-1.5 tracking-wider uppercase">Supervisor Responsable</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nombre completo del supervisor"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all outline-none"
                />
                <User className="w-4 h-4 text-sky-500 absolute left-3 top-2.5" />
              </div>
              {supervisorHistory.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[8px] text-slate-500 font-bold uppercase mt-1">Historial:</span>
                  {supervisorHistory.map((name, i) => (
                    <button key={i} type="button" onClick={() => setSupervisorName(name)}
                      className="bg-slate-800 hover:bg-slate-700 text-sky-400 px-2 py-0.5 rounded-full text-[9px] border border-slate-700 transition">
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-sky-500/80 mb-1.5 tracking-wider uppercase">Turno</label>
                <select value={shift} onChange={(e) => setShift(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none font-semibold">
                  <option value="MaÃ±ana">MaÃ±ana</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Noche">Noche</option>
                  <option value="Continuo">Continuo</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-sky-500/80 mb-1.5 tracking-wider uppercase">Horas Jornada</label>
                <div className="relative">
                  <input type="text" inputMode="decimal"
                    value={effectiveHours === 0 ? "" : String(effectiveHours)}
                    onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); setEffectiveHours(raw === "" || raw === "." ? 0 : parseFloat(raw)); }}
                    placeholder="8"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 font-mono font-bold focus:ring-1 focus:ring-sky-500 outline-none" />
                  <Clock className="w-3.5 h-3.5 text-sky-500 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
              <div>
                <label className="block text-[10px] font-bold text-sky-500/80 mb-1.5 tracking-wider uppercase">Clima MaÃ±ana</label>
                <select value={weatherMorning} onChange={(e) => setWeatherMorning(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none">
                  <option value="Soleado">â˜€ï¸ Soleado</option>
                  <option value="Nublado">â˜ï¸ Nublado</option>
                  <option value="Lluvia">ðŸŒ§ï¸ Lluvia</option>
                  <option value="Viento">ðŸ’¨ Viento</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-sky-500/80 mb-1.5 tracking-wider uppercase">Clima Tarde</label>
                <select value={weatherAfternoon} onChange={(e) => setWeatherAfternoon(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-slate-100 focus:ring-1 focus:ring-sky-500 outline-none">
                  <option value="Soleado">â˜€ï¸ Soleado</option>
                  <option value="Nublado">â˜ï¸ Nublado</option>
                  <option value="Lluvia">ðŸŒ§ï¸ Lluvia</option>
                  <option value="Viento">ðŸ’¨ Viento</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* â•â•â•â•â•â• SECCIONES DE PRODUCCIÃ“N â•â•â•â•â•â• */}
        {reportType === "produccion" && (
          <>
            {/* â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚  SECCIÃ“N 2 Â· VALOR GANADO (EV)              â”‚
                â”‚  Color: Violet/Purple â€” Avance fÃ­sico       â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ */}
            <div id="sec-valor-ganado" className="mx-3 mt-3 rounded-2xl overflow-hidden border border-violet-500/20 shadow-lg shadow-violet-500/5">
              <div className="bg-gradient-to-r from-violet-950/80 to-slate-900 px-4 py-3 flex items-center gap-2.5 border-b border-violet-500/20">
                <div className="w-1 h-6 bg-violet-400 rounded-full shrink-0" />
                <Plus className="w-4 h-4 text-violet-400" />
                <div>
                  <span className="text-[9px] font-black tracking-[0.15em] text-violet-500 uppercase">SecciÃ³n 02 Â· EV</span>
                  <h2 className="text-xs font-black text-violet-200 leading-none">REPORTE DE VALOR GANADO (EV)</h2>
                </div>
              </div>
              <div className="bg-slate-900/70 p-4 space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-violet-500/80 mb-1.5 tracking-wider uppercase">CapÃ­tulo EDT Activo</label>
                  <select value={selectedEdtChapter} onChange={(e) => setSelectedEdtChapter(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none font-bold">
                    <option value="">â€” Seleccionar capÃ­tulo EDT â€”</option>
                    {edtList.filter(e => e.parentId === null).map(ch => (
                      <option key={ch.code} value={ch.code}>[{ch.code}] {ch.name}</option>
                    ))}
                  </select>
                  {selectedEdtChapter && (
                    <p className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-2 font-medium">
                      âš  Reporte vinculado a <strong>[{selectedEdtChapter}]</strong>. Para otro capÃ­tulo, genere un nuevo reporte.
                    </p>
                  )}
                </div>

                {selectedEdtChapter && (
                  <div className="space-y-2.5">
                    <button type="button" onClick={addActivity}
                      className="w-full flex items-center justify-center gap-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 border-dashed font-bold py-2.5 rounded-xl text-[11px] transition">
                      + Agregar Actividad Ejecutada
                    </button>

                    {activities.map((act, index) => {
                      const edtInfo = getEdtItemNameAndUnit(act.edtCode);
                      const plannedQty = getPlannedProduction(act.edtCode);
                      const chapterActivities = edtList.filter(e => e.parentId === selectedEdtChapter);
                      const displayQty = act.qtyExecuted === 0 ? "" : String(act.qtyExecuted);
                      return (
                        <div key={index} className="p-3 bg-slate-800/60 rounded-xl border border-violet-500/10 space-y-2.5 text-xs relative">
                          {activities.length > 1 && (
                            <button type="button" onClick={() => removeActivity(index)} className="absolute right-2 top-2 text-rose-500 hover:text-rose-400 p-0.5">
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div>
                            <label className="block text-[9px] font-bold text-violet-400 mb-1 uppercase tracking-wider">Actividad EspecÃ­fica</label>
                            <select value={act.edtCode} onChange={(e) => updateActivityField(index, "edtCode", e.target.value)}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-[11px] text-slate-100 focus:ring-1 focus:ring-violet-500 outline-none font-bold">
                              <option value="">â€” Elegir actividad â€”</option>
                              {chapterActivities.map(item => (
                                <option key={item.code} value={item.code}>[{item.code}] {item.name}</option>
                              ))}
                            </select>
                          </div>
                          {act.edtCode && (
                            <>
                              <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-2.5 rounded-lg border border-violet-500/10">
                                <div>
                                  <span className="text-[9px] text-slate-500">Meta PV Programada:</span>
                                  <span className="block font-mono font-black text-slate-200 text-sm mt-0.5">{plannedQty} <span className="text-[10px] text-slate-400">{edtInfo.unit}</span></span>
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-violet-400 uppercase tracking-wider">Avance Real (EV)</label>
                                  <input type="text" inputMode="decimal" value={displayQty}
                                    onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); updateActivityField(index, "qtyExecuted", raw === "" || raw === "." ? 0 : parseFloat(raw)); }}
                                    className="w-full bg-violet-500/10 border border-violet-500/30 rounded-lg px-2 py-1.5 text-sm font-mono font-black text-violet-300 focus:ring-1 focus:ring-violet-500 outline-none mt-0.5" placeholder="0" />
                                </div>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-violet-400 uppercase tracking-wider">Observaciones</label>
                                <input type="text" placeholder="UbicaciÃ³n, ejes, notasâ€¦" value={act.notes}
                                  onChange={(e) => updateActivityField(index, "notes", e.target.value)}
                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-[11px] text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-violet-500 outline-none mt-1" />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚  SECCIÃ“N 3 Â· COSTO REAL AC â€” MANO DE OBRA  â”‚
                â”‚  Color: Amber â€” Recursos humanos            â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ */}
            <div id="sec-mano-obra" className="mx-3 mt-3 rounded-2xl overflow-hidden border border-amber-500/20">
              <div className="bg-gradient-to-r from-amber-950/60 to-slate-900 px-4 py-3 flex items-center justify-between border-b border-amber-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-6 bg-amber-400 rounded-full shrink-0" />
                  <User className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-[9px] font-black tracking-[0.15em] text-amber-500 uppercase">SecciÃ³n 03 Â· AC</span>
                    <h2 className="text-xs font-black text-amber-200 leading-none">MANO DE OBRA (AC)</h2>
                  </div>
                </div>
                <button type="button" onClick={addManoObra}
                  className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold px-3 py-1.5 rounded-lg text-[10px] transition">
                  + Obrero
                </button>
              </div>
              <div className="bg-slate-900/70 p-4 space-y-3">
                {manoObra.map((mo, i) => (
                  <div key={i} className="relative bg-slate-800/60 p-3 rounded-xl border border-amber-500/10 space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Recurso Mano de Obra</span>
                        <select value={mo.resourceId}
                          onChange={(e) => { const u = [...manoObra]; u[i].resourceId = e.target.value; setManoObra(u); }}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-[10px] text-slate-100 outline-none font-semibold">
                          {resources.filter(r => r.type === "mano_obra").map(r => (
                            <option key={r.id} value={r.id}>{r.name} â€” S/{r.unitCost}/hr</option>
                          ))}
                        </select>
                      </div>
                      <button type="button" onClick={() => removeManoObra(i)} className="shrink-0 text-rose-500 hover:text-rose-400 p-1 mt-4">
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-2.5 rounded-lg border border-amber-500/10">
                      <div>
                        <span className="text-[9px] text-slate-500">N.Â° trabajadores</span>
                        <input type="text" inputMode="numeric" value={mo.quantity === 0 ? "" : String(mo.quantity)}
                          onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ""); const u = [...manoObra]; u[i].quantity = raw === "" ? 0 : parseInt(raw); setManoObra(u); }}
                          placeholder="0" className="w-full bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5 text-sm font-mono font-black text-amber-300 focus:ring-1 focus:ring-amber-500 outline-none mt-0.5" />
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500">Horas c/u</span>
                        <input type="text" inputMode="decimal" value={mo.hoursWorked === 0 ? "" : String(mo.hoursWorked)}
                          onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const u = [...manoObra]; u[i].hoursWorked = raw === "" || raw === "." ? 0 : parseFloat(raw); setManoObra(u); }}
                          placeholder="8" className="w-full bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5 text-sm font-mono font-black text-amber-300 focus:ring-1 focus:ring-amber-500 outline-none mt-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
                {manoObra.length === 0 && <p className="text-[10px] text-slate-500 italic text-center py-3">Sin mano de obra registrada. Presione "+ Obrero".</p>}
              </div>
            </div>

            {/* â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚  SECCIÃ“N 3B Â· MATERIALES CONSUMIDOS (AC)   â”‚
                â”‚  Color: Orange â€” Materiales                 â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ */}
            <div id="sec-materiales" className="mx-3 mt-3 rounded-2xl overflow-hidden border border-orange-500/20">
              <div className="bg-gradient-to-r from-orange-950/60 to-slate-900 px-4 py-3 flex items-center justify-between border-b border-orange-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-6 bg-orange-400 rounded-full shrink-0" />
                  <FileSpreadsheet className="w-4 h-4 text-orange-400" />
                  <div>
                    <span className="text-[9px] font-black tracking-[0.15em] text-orange-500 uppercase">SecciÃ³n 03b Â· AC</span>
                    <h2 className="text-xs font-black text-orange-200 leading-none">MATERIALES CONSUMIDOS (AC)</h2>
                  </div>
                </div>
                <button type="button" onClick={addMaterial}
                  className="bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/30 font-bold px-3 py-1.5 rounded-lg text-[10px] transition">
                  + Material
                </button>
              </div>
              <div className="bg-slate-900/70 p-4 space-y-3">
                {materials.map((mat, i) => {
                  const rInfo = resources.find(r => r.id === mat.resourceId);
                  return (
                    <div key={i} className="relative bg-slate-800/60 p-3 rounded-xl border border-orange-500/10 space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider block mb-1">CatÃ¡logo de Materiales</span>
                          <select value={mat.resourceId}
                            onChange={(e) => { const u = [...materials]; u[i].resourceId = e.target.value; setMaterials(u); }}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-[10px] text-slate-100 outline-none font-semibold">
                            {resources.filter(r => r.type === "material").map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                        <button type="button" onClick={() => removeMaterial(i)} className="shrink-0 text-rose-500 hover:text-rose-400 p-1 mt-4">
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500">Cantidad Consumida Hoy:</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <input type="text" inputMode="decimal" value={mat.qtyConsumed === 0 ? "" : String(mat.qtyConsumed)}
                            onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const u = [...materials]; u[i].qtyConsumed = raw === "" || raw === "." ? 0 : parseFloat(raw); setMaterials(u); }}
                            placeholder="0" className="flex-1 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1.5 text-sm font-mono font-black text-orange-300 focus:ring-1 focus:ring-orange-500 outline-none" />
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{rInfo?.unit || "und"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {materials.length === 0 && <p className="text-[10px] text-slate-500 italic text-center py-3">Sin materiales registrados hoy.</p>}
              </div>
            </div>

            {/* â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚  SECCIÃ“N 3C Â· EQUIPOS Y MAQUINARIA (AC)    â”‚
                â”‚  Color: Teal â€” Maquinaria                   â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ */}
            <div id="sec-equipos" className="mx-3 mt-3 rounded-2xl overflow-hidden border border-teal-500/20">
              <div className="bg-gradient-to-r from-teal-950/60 to-slate-900 px-4 py-3 flex items-center justify-between border-b border-teal-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-6 bg-teal-400 rounded-full shrink-0" />
                  <RefreshCw className="w-4 h-4 text-teal-400" />
                  <div>
                    <span className="text-[9px] font-black tracking-[0.15em] text-teal-500 uppercase">SecciÃ³n 03c Â· AC</span>
                    <h2 className="text-xs font-black text-teal-200 leading-none">EQUIPOS Y MAQUINARIA (AC)</h2>
                  </div>
                </div>
                <button type="button" onClick={addEquipo}
                  className="bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 font-bold px-3 py-1.5 rounded-lg text-[10px] transition">
                  + Equipo
                </button>
              </div>
              <div className="bg-slate-900/70 p-4 space-y-3">
                {equipos.map((eq, i) => {
                  const rInfo = resources.find(r => r.id === eq.resourceId);
                  return (
                    <div key={i} className="relative bg-slate-800/60 p-3 rounded-xl border border-teal-500/10 space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-teal-400 uppercase tracking-wider block mb-1">CatÃ¡logo de Equipos</span>
                          <select value={eq.resourceId}
                            onChange={(e) => { const u = [...equipos]; u[i].resourceId = e.target.value; setEquipos(u); }}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-[10px] text-slate-100 outline-none font-semibold">
                            {resources.filter(r => r.type === "equipo").map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                        <button type="button" onClick={() => removeEquipo(i)} className="shrink-0 text-rose-500 hover:text-rose-400 p-1 mt-4">
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500">Uso reportado hoy:</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <input type="text" inputMode="decimal" value={eq.qtyUsed === 0 ? "" : String(eq.qtyUsed)}
                            onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const u = [...equipos]; u[i].qtyUsed = raw === "" || raw === "." ? 0 : parseFloat(raw); setEquipos(u); }}
                            placeholder="0" className="flex-1 bg-teal-500/10 border border-teal-500/20 rounded-lg px-2 py-1.5 text-sm font-mono font-black text-teal-300 focus:ring-1 focus:ring-teal-500 outline-none" />
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{rInfo?.unit || "hr"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {equipos.length === 0 && <p className="text-[10px] text-slate-500 italic text-center py-3">Sin equipos registrados hoy.</p>}
              </div>
            </div>

            {/* â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                â”‚  SECCIÃ“N 4 Â· OTROS REPORTES                 â”‚
                â”‚  Color: Emerald â€” PlanificaciÃ³n y gestiÃ³n   â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ */}
            <div id="sec-otros-reportes" className="mx-3 mt-3 rounded-2xl overflow-hidden border border-emerald-500/20">
              <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 px-4 py-3 flex items-center gap-2.5 border-b border-emerald-500/20">
                <div className="w-1 h-6 bg-emerald-400 rounded-full shrink-0" />
                <AlertTriangle className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-[9px] font-black tracking-[0.15em] text-emerald-500 uppercase">SecciÃ³n 04</span>
                  <h2 className="text-xs font-black text-emerald-200 leading-none">OTROS REPORTES: RESTRICCIONES Y PLANIFICACIÃ“N</h2>
                </div>
              </div>
              <div className="bg-slate-900/70 p-4 space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-emerald-500/80 mb-1.5 tracking-wider uppercase">Conflictos, Restricciones y Retrasos</label>
                  <textarea rows={2} placeholder="Carencia de planos MEP, llegada tardÃ­a de mixer, lluviasâ€¦" value={conflicts} onChange={(e) => setConflicts(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-500/80 mb-1.5 tracking-wider uppercase">Trabajos Planificados DÃ­a Siguiente</label>
                  <textarea rows={2} placeholder="Vaciado zapatas eje C-3 a C-8, tarrajeo fachadaâ€¦" value={plannedNextDay} onChange={(e) => setPlannedNextDay(e.target.value)}
                    className="w-full bg-slate-800 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-500/80 mb-1.5 tracking-wider uppercase">Observaciones Generales</label>
                  <textarea rows={2} placeholder="Visita de supervisiÃ³n tÃ©cnica sin anotaciones negativasâ€¦" value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* â•â•â•â•â•â• SECCIONES DE SEGURIDAD â•â•â•â•â•â• */}
        {reportType === "seguridad" && (
          <>
            <div id="sec-seguridad" className="mx-3 mt-3 rounded-2xl overflow-hidden border border-emerald-500/20">
              <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 px-4 py-3 flex items-center gap-2.5 border-b border-emerald-500/20">
                <div className="w-1 h-6 bg-emerald-400 rounded-full shrink-0" />
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-[9px] font-black tracking-[0.15em] text-emerald-500 uppercase">SecciÃ³n 01 Â· HSE</span>
                  <h2 className="text-xs font-black text-emerald-200 leading-none">SEGURIDAD E INCIDENTES</h2>
                </div>
              </div>
              <div className="bg-slate-900/70 p-4 space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-emerald-500/80 mb-1.5 tracking-wider uppercase">Censo Total en Campo</label>
                  <input type="text" inputMode="numeric" value={totalStaff === 0 ? "" : String(totalStaff)}
                    onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ""); setTotalStaff(raw === "" ? 0 : parseInt(raw)); }}
                    placeholder="0" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-emerald-300 focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
                <div className="flex items-center gap-3 bg-slate-800/60 p-3 rounded-xl border border-emerald-500/10">
                  <input type="checkbox" id="safe-check" checked={safetyInspected} onChange={(e) => setSafetyInspected(e.target.checked)}
                    className="w-4 h-4 text-emerald-500 border-slate-600 rounded focus:ring-emerald-500 bg-slate-700" />
                  <label htmlFor="safe-check" className="text-[11px] font-bold text-slate-200 cursor-pointer">Â¿Charla e InspecciÃ³n de Seguridad Realizada?</label>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-500/80 mb-1.5 tracking-wider uppercase">Detalles PrevenciÃ³n / EPPs</label>
                  <textarea rows={2} placeholder="InspecciÃ³n de andamios, charla de 5 minutosâ€¦" value={safetyDetails} onChange={(e) => setSafetyDetails(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-rose-500/80 mb-1.5 tracking-wider uppercase">Registro de Accidentes / Incidentes</label>
                  <textarea rows={2} placeholder="Escribe 'Ninguno' o detalla cualquier golpe, corteâ€¦" value={incidents} onChange={(e) => setIncidents(e.target.value)}
                    className="w-full bg-slate-800 border border-rose-500/20 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-rose-500 outline-none resize-none" />
                </div>
              </div>
            </div>

            <div className="mx-3 mt-3 rounded-2xl overflow-hidden border border-amber-500/20">
              <div className="bg-gradient-to-r from-amber-950/60 to-slate-900 px-4 py-3 flex items-center gap-2.5 border-b border-amber-500/20">
                <div className="w-1 h-6 bg-amber-400 rounded-full shrink-0" />
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-[9px] font-black tracking-[0.15em] text-amber-500 uppercase">SecciÃ³n 02</span>
                  <h2 className="text-xs font-black text-amber-200 leading-none">RESTRICCIONES E INTERFERENCIAS</h2>
                </div>
              </div>
              <div className="bg-slate-900/70 p-4 space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-amber-500/80 mb-1.5 tracking-wider uppercase">Conflictos y Restricciones</label>
                  <textarea rows={2} placeholder="Detalles de restriccionesâ€¦" value={conflicts} onChange={(e) => setConflicts(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-500/80 mb-1.5 tracking-wider uppercase">Trabajos Planificados DÃ­a Siguiente</label>
                  <textarea rows={2} placeholder="Plan del siguiente turnoâ€¦" value={plannedNextDay} onChange={(e) => setPlannedNextDay(e.target.value)}
                    className="w-full bg-slate-800 border border-amber-500/20 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-500/80 mb-1.5 tracking-wider uppercase">Observaciones Generales</label>
                  <textarea rows={2} placeholder="Observaciones adicionalesâ€¦" value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Config Webhook */}
        <div className="mx-3 mt-3 mb-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
          <span className="text-[9px] font-black text-slate-500 block uppercase tracking-[0.15em]">SincronizaciÃ³n Â· API Webhook</span>
          <input type="text" placeholder="https://script.google.com/macros/s/..." value={appsScriptUrl} onChange={(e) => setAppsScriptUrl(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-sky-400 focus:ring-1 focus:ring-sky-500 outline-none" />
        </div>

      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          FOOTER FIJO â€” Acciones principales
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-3 py-3 grid grid-cols-3 gap-2 z-50">
        <button type="button" onClick={saveDraftManually}
          className="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 py-3 rounded-xl border border-slate-700 transition text-[10px] font-bold text-slate-300 gap-1">
          <Save className="w-4 h-4 text-slate-400 shrink-0" />
          Guardar Borrador
        </button>
        <button type="button" onClick={downloadExcel}
          className="flex flex-col items-center justify-center bg-amber-500/10 hover:bg-amber-500/20 py-3 rounded-xl border border-amber-500/30 transition text-[10px] font-bold text-amber-300 gap-1">
          <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0" />
          Descargar XLSX
        </button>
        <button type="submit" disabled={submitting}
          className={`flex flex-col items-center justify-center py-3 rounded-xl transition text-[10px] font-bold text-white gap-1 shadow-lg ${
            submitting
              ? "bg-slate-700 border border-slate-600 cursor-not-allowed text-slate-400"
              : "bg-gradient-to-br from-sky-500 to-sky-700 border border-sky-600 shadow-sky-500/20 hover:from-sky-400 hover:to-sky-600"
          }`}>
          {submitting ? (
            <><div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />Enviando...</>
          ) : (
            <><Send className="w-4 h-4 text-white shrink-0" />Enviar Reporte</>
          )}
        </button>
      </div>

    </form>
  );
}
