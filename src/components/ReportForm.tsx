import React, { useState, useEffect, useRef } from "react";
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
  const [shift, setShift] = useState<'Mañana' | 'Tarde' | 'Noche' | 'Continuo'>("Mañana");
  const [effectiveHours, setEffectiveHours] = useState<number>(8);
  const [weatherMorning, setWeatherMorning] = useState<'Soleado' | 'Nublado' | 'Lluvia' | 'Viento'>("Soleado");
  const [weatherAfternoon, setWeatherAfternoon] = useState<'Soleado' | 'Nublado' | 'Lluvia' | 'Viento'>("Soleado");

  // Historic auto-completions
  const [supervisorHistory, setSupervisorHistory] = useState<string[]>([]);
  
  // Capítulo EDT seleccionado (1 capítulo por reporte)
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

  // Section 7: Problemas y Planificación
  const [conflicts, setConflicts] = useState<string>("");
  const [plannedNextDay, setPlannedNextDay] = useState<string>("");
  const [generalNotes, setGeneralNotes] = useState<string>("");

  // Section 8: Drawing Canvas signature
  const [signatureData, setSignatureData] = useState<string>("");

  // Status and logs
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [isDraftLoadedToast, setIsDraftLoadedToast] = useState(false);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  // Today date validation (reject future dates)
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
        if (draft.signatureBase64) setSignatureData(draft.signatureBase64);
        
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
      generalNotes,
      signatureBase64: signatureData
    };

    const interval = setInterval(() => {
      localStorage.setItem("RDO_FORM_DRAFT", JSON.stringify(draftPayload));
    }, 15000); // 15 seconds for aggressive offline backup in construction sites!

    return () => clearInterval(interval);
  }, [
    selectedProjectCode, reportDate, supervisorName, shift, effectiveHours,
    weatherMorning, weatherAfternoon, activities, manoObra, materials,
    equipos, totalStaff, safetyInspected, safetyDetails, incidents,
    conflicts, plannedNextDay, generalNotes, signatureData
  ]);

  // Dynamic progress bar calculation based on core input completion
  useEffect(() => {
    let completedPoints = 0;
    const maxPoints = 7;

    if (selectedProjectCode) completedPoints++;
    if (reportDate) completedPoints++;
    if (supervisorName.trim().length > 1) completedPoints++;
    if (selectedEdtChapter) completedPoints++;
    if (manoObra.length > 0) completedPoints++;
    if (totalStaff > 0) completedPoints++;
    if (signatureData) completedPoints++;
    setProgressPercent(Math.round((completedPoints / maxPoints) * 100));
  }, [
    selectedProjectCode, reportDate, supervisorName, selectedEdtChapter,
    manoObra, totalStaff, signatureData
  ]);

  // Handle tactile canvas drawing (Signature)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Line styles for physical look
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a"; // Deep Charcoal-blue Ink

    // Set background once if empty
    if (!signatureData) {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Re-draw loaded base64 on render
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = signatureData;
    }
  }, [canvasRef, signatureData]);

  // Pen commands
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Check if TouchEvent vs MouseEvent
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      const { x, y } = getCoordinates(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      const { x, y } = getCoordinates(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const endDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      const base64 = canvas.toDataURL("image/png");
      setSignatureData(base64);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setSignatureData("");
    }
  };

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
    // Pre-select first resource item of type mano_obra
    const firstMo = resources.find(r => r.type === "mano_obra");
    setManoObra([...manoObra, { 
      resourceId: firstMo ? firstMo.id : "", 
      hoursWorked: 8, 
      edtGroupCode: "EST" 
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
      edtGroupCode: "EST" 
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
      edtGroupCode: "EST" 
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
      generalNotes,
      signatureBase64: signatureData
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
        ac += mo.hoursWorked * matchRes.unitCost;
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
      ["CLIMA MAÑANA", weatherMorning],
      ["CLIMA TARDE", weatherAfternoon],
      ["TOTAL PERSONAL EN OBRA", totalStaff],
      ["SEGURIDAD REVISADA", safetyInspected ? "SÍ" : "NO"],
      ["DETALLE SEGURIDAD", safetyDetails],
      ["INCIDENTES", incidents],
      ["CONFLICTOS/RESTRICCIONES", conflicts],
      ["TRABAJOS PLANIFICADOS SIG. DÍA", plannedNextDay],
      ["OBSERVACIONES GENERALES", generalNotes],
      [""],
      ["RESUMEN DE METODOLOGÍA VALOR GANADO (EVM)"],
      ["INDICADOR", "VALOR ($ USD)", "DESCRIPCIÓN"],
      ["Valor Planificado (PV)", metrics.plannedValue, "Presupuesto programado hoy"],
      ["Valor Ganado (EV)", metrics.earnedValue, "Presupuesto de lo realmente avanzado hoy"],
      ["Costo Real (AC)", metrics.actualCost, "Mano de Obra + Materiales + Equipos consumidos"],
      ["Variaza Cronograma (SV)", metrics.sv, "EV - PV (Negativo = Retraso)"],
      ["Varianza Costos (CV)", metrics.cv, "EV - AC (Negativo = Pérdida)"],
      ["Índice Plazo (SPI)", metrics.spi, "EV / PV (Menor que 1 = Retrasado)"],
      ["Índice Costo (CPI)", metrics.cpi, "EV / AC (Menor que 1 = Sobrecosto)"],
    ];
    const wsMeta = XLSX.utils.aoa_to_sheet(metaData);
    XLSX.utils.book_append_sheet(wb, wsMeta, "Resumen General");

    // 2. Activities Sheet
    const actRows = activities.map(act => {
      const edtInfo = getEdtItemNameAndUnit(act.edtCode);
      return {
        "Código EDT": act.edtCode,
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
        "Descripción": resMatch?.name || "",
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
        "Descripción": resMatch?.name || "",
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
        "Descripción": resMatch?.name || "",
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
    if (!selectedEdtChapter) {
      setSubmitMessage({ type: 'error', text: 'Seleccione un capítulo EDT antes de enviar el reporte.' });
      return;
    }
    if (activities.length === 0) {
      setSubmitMessage({ type: 'error', text: 'No hay actividades para el capítulo seleccionado en esta fecha.' });
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
      signatureBase64: signatureData,
      createdAt: ""
    };

    const finalPayload = {
      ...payload,
      metrics: calculatedMetrics
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
        // Also send to Google Apps Script Web App in background if user has it configured!
        if (appsScriptUrl && appsScriptUrl.startsWith("http")) {
          fetch(appsScriptUrl, {
            method: "POST",
            mode: "no-cors", // Apps Script Web App redirection CORS fallback
            headers: { "Content-Type": "text/plain" }, // prevent CORS pre-flights
            body: JSON.stringify(finalPayload)
          }).catch(err => console.warn("Google Apps Script sync warning (often harmless CORS redirect):", err));
        }

        setSubmitMessage({ 
          type: 'success', 
          text: `¡Reporte registrado correctamente! ID asignado: ${resData.reportId}` 
        });

        // Trigger callback to update dashboard metrics
        onReportSubmitted(resData.report, calculatedMetrics);

        // Clear draft & canvas
        localStorage.removeItem("RDO_FORM_DRAFT");
        clearCanvas();
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
      setSubmitMessage({ 
        type: 'error', 
        text: `Error de red o conexión: Se guardó un respaldo local offline. Detalles: ${err.message}` 
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col font-sans select-none pb-8 text-slate-800 bg-slate-50">
      
      {/* Mobile Top Header Banner */}
      <div className="bg-slate-900 text-white px-5 py-4 shadow-md shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-sky-500 p-1.5 rounded-xl text-slate-950 font-bold shadow-sm">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">REPORTE DE CAMPO (RDO)</h1>
            <p className="text-[10px] text-slate-300 font-medium">Control de Avances y Metodología EVM</p>
          </div>
        </div>

        {/* Dynamic score level */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono text-slate-400">Progreso</span>
          <span className="text-xs font-extrabold text-sky-400 font-mono">{progressPercent}%</span>
        </div>
      </div>

      {/* Progress percentage slider */}
      <div className="w-full bg-slate-800 h-1.5 shrink-0">
        <div 
          className="bg-sky-400 h-full transition-all duration-500 ease-out" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="p-4 space-y-5 flex-1 select-none overflow-y-auto">

        {/* Floating Draft Loaded Notification */}
        {isDraftLoadedToast && (
          <div id="draft-toast" className="bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-xl flex items-center gap-2 shadow-lg animate-bounce text-xs">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Se restauró un borrador previo guardado automáticamente en el dispositivo.</span>
          </div>
        )}

        {/* Notification block */}
        {submitMessage && (
          <div id="submit-alert" className={`p-4 rounded-2xl flex items-start gap-2.5 text-xs border ${
            submitMessage.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="font-medium">{submitMessage.text}</div>
          </div>
        )}

        {/* SECTION 1: CABECERA DEL REPORTE */}
        <div id="sec-cabecera" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Layers className="w-4 h-4 text-sky-500" />
            <h2 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">1. Cabecera del Reporte</h2>
          </div>

          <div className="space-y-3 text-xs">
            {/* Proyecto */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">PROYECTO ACTIVO</label>
              <select
                value={selectedProjectCode}
                onChange={(e) => setSelectedProjectCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 transition-all outline-none font-medium"
              >
                {projects.map(p => (
                  <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            {/* Fecha Reporte */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex justify-between">
                <span>FECHA DE OPERACIÓN</span>
                <span className="text-[10px] text-amber-500 font-medium">No fechas futuras</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  max={maxDateStr}
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 transition-all outline-none font-medium"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Supervisor Autocomplete */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">SUPERVISOR RESPONSABLE</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 transition-all outline-none font-medium font-sans"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              {/* Autocomplete history bullets */}
              {supervisorHistory.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[8px] text-slate-400 font-semibold uppercase mt-1">Historial del celular:</span>
                  {supervisorHistory.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSupervisorName(name)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[9px] border border-slate-200 tracking-tight transition"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Turno y Horas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">TURNO JORNADA</label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-sky-500 transition-all outline-none font-medium"
                >
                  <option value="Mañana">Mañana</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Noche">Noche</option>
                  <option value="Continuo">Continuo</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">HORAS JORNADA</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={effectiveHours}
                    onChange={(e) => setEffectiveHours(parseInt(e.target.value) || 8)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 transition-all outline-none font-medium font-mono"
                  />
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Climas */}
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">CLIMA MAÑANA</label>
                <div className="relative">
                  <select
                    value={weatherMorning}
                    onChange={(e) => setWeatherMorning(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-sky-500 transition-all outline-none font-medium"
                  >
                    <option value="Soleado">☀️ Soleado</option>
                    <option value="Nublado">☁️ Nublado</option>
                    <option value="Lluvia">🌧️ Lluvia</option>
                    <option value="Viento">💨 Viento</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">CLIMA TARDE</label>
                <div className="relative">
                  <select
                    value={weatherAfternoon}
                    onChange={(e) => setWeatherAfternoon(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-sky-500 transition-all outline-none font-medium"
                  >
                    <option value="Soleado">☀️ Soleado</option>
                    <option value="Nublado">☁️ Nublado</option>
                    <option value="Lluvia">🌧️ Lluvia</option>
                    <option value="Viento">💨 Viento</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* SECTION 2: ACTIVIDADES EJECUTADAS (EV) */}
        <div id="sec-actividades" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Plus className="w-4 h-4 text-sky-500" />
            <h2 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">2. Actividades Ejecutadas (EV)</h2>
          </div>

          {/* Selector de capítulo EDT (1 capítulo por reporte) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">SELECCIONAR CAPÍTULO EDT</label>
            <select
              value={selectedEdtChapter}
              onChange={(e) => setSelectedEdtChapter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 transition-all outline-none font-bold"
            >
              <option value="">-- Seleccionar capítulo --</option>
              {edtList.filter(e => e.parentId === null).map(ch => (
                <option key={ch.code} value={ch.code}>
                  [{ch.code}] {ch.name}
                </option>
              ))}
            </select>
          </div>

          {selectedEdtChapter && (
            <div className="space-y-2">
              {/* Add activity button */}
              <button
                type="button"
                onClick={addActivity}
                className="w-full flex items-center justify-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 border-dashed font-bold py-2 rounded-xl text-[11px] transition"
              >
                + Agregar Actividad
              </button>

              {activities.map((act, index) => {
                const edtInfo = getEdtItemNameAndUnit(act.edtCode);
                const plannedQty = getPlannedProduction(act.edtCode);
                const chapterActivities = edtList.filter(e => e.parentId === selectedEdtChapter);
                // Cheat: convert 0 back to empty string so user can type freely
                const displayQty = act.qtyExecuted === 0 ? "" : String(act.qtyExecuted);

                return (
                  <div key={index} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2 text-xs relative">
                    {/* Delete button */}
                    {activities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeActivity(index)}
                        className="absolute right-2 top-2 text-rose-500 hover:text-rose-700 p-0.5"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Activity selector filtered by chapter */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">SELECCIONAR ACTIVIDAD</label>
                      <select
                        value={act.edtCode}
                        onChange={(e) => updateActivityField(index, "edtCode", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] focus:ring-1 focus:ring-sky-500 outline-none font-bold"
                      >
                        <option value="">-- Elija actividad --</option>
                        {chapterActivities.map(item => (
                          <option key={item.code} value={item.code}>
                            [{item.code}] {item.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {act.edtCode && (
                      <>
                        <div className="grid grid-cols-2 gap-3 bg-white p-2 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400">Metrado programado (BD_PV_Diario):</span>
                            <span className="block font-mono font-bold text-slate-700 text-sm">{plannedQty} {edtInfo.unit}</span>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-sky-600">AVANCE REAL (EV)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={displayQty}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9.]/g, "");
                                updateActivityField(index, "qtyExecuted", raw === "" || raw === "." ? 0 : parseFloat(raw));
                              }}
                              className="w-full bg-white border border-sky-200 rounded-lg px-2 py-1.5 text-[11px] focus:ring-1 focus:ring-sky-500 outline-none font-mono font-bold mt-0.5"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-sky-600">OBSERVACIONES</label>
                          <input
                            type="text"
                            placeholder="Ubicación, ejes, observaciones…"
                            value={act.notes}
                            onChange={(e) => updateActivityField(index, "notes", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] focus:ring-1 focus:ring-sky-500 outline-none font-sans"
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: PERSONAL DE MANO DE OBRA (AC) */}
        <div id="sec-mano-obra" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-sky-500" />
              <h2 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">3. Mano de Obra (AC)</h2>
            </div>
            <button
              type="button"
              onClick={addManoObra}
              className="bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 font-bold px-2 py-1 rounded-lg text-[10px] transition flex items-center gap-1"
            >
              Asociar Obrero
            </button>
          </div>

          <div className="space-y-3">
            {manoObra.map((mo, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                {/* Resource item */}
                <div className="col-span-11 space-y-1 text-xs">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase">RECURSO DE MANO DE OBRA</span>
                      <select
                        value={mo.resourceId}
                        onChange={(e) => {
                          const updated = [...manoObra];
                          updated[i].resourceId = e.target.value;
                          setManoObra(updated);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[10.5px] outline-none font-semibold"
                      >
                        {resources.filter(r => r.type === "mano_obra").map(r => (
                          <option key={r.id} value={r.id}>{r.name} (${r.unitCost}/hr)</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase">FRENTE CIVIL (EDT 1)</span>
                      <select
                        value={mo.edtGroupCode}
                        onChange={(e) => {
                          const updated = [...manoObra];
                          updated[i].edtGroupCode = e.target.value;
                          setManoObra(updated);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[10.5px] outline-none font-semibold"
                      >
                        <option value="EST">Estructuras (EST)</option>
                        <option value="ARQ">Arquitectura (ARQ)</option>
                        <option value="MEP">Instalaciones (MEP)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase mr-1">Horas Trabajadas Hoy:</span>
                    <input
                      type="number"
                      value={mo.hoursWorked}
                      onChange={(e) => {
                        const updated = [...manoObra];
                        updated[i].hoursWorked = parseFloat(e.target.value) || 0;
                        setManoObra(updated);
                      }}
                      className="inline-block w-16 bg-white border border-slate-200 rounded-lg p-0.5 text-center font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-500 ml-1.5">hrs</span>
                  </div>
                </div>

                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeManoObra(i)}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {manoObra.length === 0 && (
              <p className="text-[10px] text-slate-400 italic text-center py-2">
                Ningún jornal de mano de obra asociado hoy. Haga clic en "Asociar Obrero".
              </p>
            )}
          </div>
        </div>

        {/* SECTION 4: MATERIALES CONSUMIDOS (AC) */}
        <div id="sec-materiales" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-sky-500" />
              <h2 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">4. Materiales Consumidos (AC)</h2>
            </div>
            <button
              type="button"
              onClick={addMaterial}
              className="bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 font-bold px-2 py-1 rounded-lg text-[10px] transition flex items-center gap-1"
            >
              Consumir Material
            </button>
          </div>

          <div className="space-y-3">
            {materials.map((mat, i) => {
              const rInfo = resources.find(r => r.id === mat.resourceId);
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                  <div className="col-span-11 space-y-1 text-xs">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase">CATÁLOGO MATERIAL</span>
                        <select
                          value={mat.resourceId}
                          onChange={(e) => {
                            const updated = [...materials];
                            updated[i].resourceId = e.target.value;
                            setMaterials(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[10px] outline-none font-semibold"
                        >
                          {resources.filter(r => r.type === "material").map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase">ASOCIAR CAPÍTULO</span>
                        <select
                          value={mat.edtGroupCode}
                          onChange={(e) => {
                            const updated = [...materials];
                            updated[i].edtGroupCode = e.target.value;
                            setMaterials(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[10px] outline-none font-semibold"
                        >
                          <option value="EST">Estructuras (EST)</option>
                          <option value="ARQ">Arquitectura (ARQ)</option>
                          <option value="MEP">Instalaciones (MEP)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase mr-1">Cant. Consumida Hoy:</span>
                      <input
                        type="number"
                        step="any"
                        value={mat.qtyConsumed}
                        onChange={(e) => {
                          const updated = [...materials];
                          updated[i].qtyConsumed = parseFloat(e.target.value) || 0;
                          setMaterials(updated);
                        }}
                        className="inline-block w-16 bg-white border border-slate-200 rounded-lg p-0.5 text-center font-mono font-bold"
                      />
                      <span className="text-[10px] text-slate-500 ml-1.5">{rInfo?.unit || "unidades"}</span>
                    </div>
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeMaterial(i)}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {materials.length === 0 && (
              <p className="text-[10px] text-slate-400 italic text-center py-2">
                Ningún material consumido reportado hoy.
              </p>
            )}
          </div>
        </div>

        {/* SECTION 5: EQUIPOS UTILIZADOS (AC) */}
        <div id="sec-equipos" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-sky-500" />
              <h2 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">5. Equipos Utilizados (AC)</h2>
            </div>
            <button
              type="button"
              onClick={addEquipo}
              className="bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 font-bold px-2 py-1 rounded-lg text-[10px] transition flex items-center gap-1"
            >
              Registrar Maquinaria
            </button>
          </div>

          <div className="space-y-3">
            {equipos.map((eq, i) => {
              const rInfo = resources.find(r => r.id === eq.resourceId);
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                  <div className="col-span-11 space-y-1 text-xs">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase">CATÁLOGO EQUIPO</span>
                        <select
                          value={eq.resourceId}
                          onChange={(e) => {
                            const updated = [...equipos];
                            updated[i].resourceId = e.target.value;
                            setEquipos(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[10px] outline-none font-semibold"
                        >
                          {resources.filter(r => r.type === "equipo").map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase">ASOCIAR CAPÍTULO</span>
                        <select
                          value={eq.edtGroupCode}
                          onChange={(e) => {
                            const updated = [...equipos];
                            updated[i].edtGroupCode = e.target.value;
                            setEquipos(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1 text-[10px] outline-none font-semibold"
                        >
                          <option value="EST">Estructuras (EST)</option>
                          <option value="ARQ">Arquitectura (ARQ)</option>
                          <option value="MEP">Instalaciones (MEP)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase mr-1">Uso reportado:</span>
                      <input
                        type="number"
                        step="any"
                        value={eq.qtyUsed}
                        onChange={(e) => {
                          const updated = [...equipos];
                          updated[i].qtyUsed = parseFloat(e.target.value) || 0;
                          setEquipos(updated);
                        }}
                        className="inline-block w-16 bg-white border border-slate-200 rounded-lg p-0.5 text-center font-mono font-bold"
                      />
                      <span className="text-[10px] text-slate-500 ml-1.5">{rInfo?.unit || "horas"}</span>
                    </div>
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeEquipo(i)}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {equipos.length === 0 && (
              <p className="text-[10px] text-slate-400 italic text-center py-2">
                Ningún equipo o andamio reportado hoy.
              </p>
            )}
          </div>
        </div>

        {/* SECTION 6: CONTROL, SEGURIDAD E INCIDENTES */}
        <div id="sec-seguridad" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">6. Seguridad e Incidentes</h2>
          </div>

          <div className="space-y-3 text-xs">
            {/* Personal Total */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">CENSO TOTAL DE OPERARIOS EN CAMPO</label>
              <input
                type="number"
                value={totalStaff}
                onChange={(e) => setTotalStaff(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none font-mono font-bold"
              />
            </div>

            {/* InspecciónCheckbox */}
            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <input
                type="checkbox"
                id="safe-check"
                checked={safetyInspected}
                onChange={(e) => setSafetyInspected(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="safe-check" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                ¿Charla e Inspección de Seguridad Realizada?
              </label>
            </div>

            {/* Detalles Seguridad */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">DETALLES DE PREVENCIÓN / EPPS</label>
              <textarea
                rows={2}
                placeholder="Inspección de andamios, charla de 5 minutos dictada, arneses revisados."
                value={safetyDetails}
                onChange={(e) => setSafetyDetails(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none font-sans"
              />
            </div>

            {/* Incidentes */}
            <div>
              <label className="block text-[11px] font-semibold text-red-500 mb-1">REGISTRO DE ACCIDENTES O INCIDENTES</label>
              <textarea
                rows={2}
                placeholder="Escribe 'Ninguno' o detalla cualquier golpe, corte o re-trabajo."
                value={incidents}
                onChange={(e) => setIncidents(e.target.value)}
                className="w-full bg-slate-50 border border-red-100 rounded-xl px-3 py-2 text-[11px] focus:ring-1 focus:ring-red-500 outline-none font-sans"
              />
            </div>
          </div>
        </div>

        {/* SECTION 7: PROBLEMAS Y PLANIFICACIÓN */}
        <div id="sec-planificacion" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">7. Restricciones e Interferencias</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">CONFLICTOS, RESTRICCIONES Y RETRASOS</label>
              <textarea
                rows={2}
                placeholder="Carencia de planos definitivos de MEP, llegada tardía de mixer de concreto, lluvias."
                value={conflicts}
                onChange={(e) => setConflicts(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-sky-600 mb-1">TRABAJOS PLANIFICADOS PARA EL DÍA SIGUIENTE</label>
              <textarea
                rows={2}
                placeholder="Vaciado de concreto en zapatas de eje C-3 a C-8, tarrajeo en fachada posterior."
                value={plannedNextDay}
                onChange={(e) => setPlannedNextDay(e.target.value)}
                className="w-full bg-sky-50/20 border border-sky-100 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">OBSERVACIONES GENERALES</label>
              <textarea
                rows={2}
                placeholder="Visita de supervisión técnica sin anotaciones negativas en cuaderno de obra."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 8: FIRMA DIGITAL CANVAS */}
        <div id="sec-firma" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-sky-500" />
              <h2 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">8. Firma de Conformidad</h2>
            </div>
            <button
              type="button"
              onClick={clearCanvas}
              className="text-slate-500 hover:text-slate-800 font-bold text-[10px] uppercase tracking-tight"
            >
              Limpiar Firma
            </button>
          </div>

          <div className="space-y-2">
            <span className="block text-[10px] text-slate-400 font-medium">Firma directamente en el recuadro grisáceo:</span>
            
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 shadow-inner h-[130px]">
              <canvas
                ref={canvasRef}
                width={360}
                height={130}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={endDrawing}
                className="w-full h-full cursor-crosshair touch-none block"
              />
            </div>
          </div>
        </div>

        {/* EXCEL / DISPATCH WEBHOOK CONFIGURATION */}
        <div className="bg-slate-900 text-slate-300 p-4 rounded-2xl border border-slate-800 shadow-inner space-y-3 text-xs">
          <span className="font-extrabold text-white block uppercase tracking-wider text-[10px]">Ajustes de Sincronización</span>
          
          <div>
            <label className="block text-[9px] text-slate-400 font-semibold mb-0.5 uppercase">API Webhook de Apps Script / Server URL</label>
            <input
              type="text"
              placeholder="https://script.google.com/macros/s/..."
              value={appsScriptUrl}
              onChange={(e) => setAppsScriptUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-sky-400 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
        </div>

      </div>

      {/* FIXED BASE ACTION FOOTER BUTTONS FOR RESILIENCY & EXPORT */}
      <div className="bg-white border-t border-slate-200/80 px-4 py-3 shrink-0 grid grid-cols-3 gap-2 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] z-40 select-none">
        <button
          type="button"
          onClick={saveDraftManually}
          className="flex flex-col items-center justify-center bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl border border-slate-200 transition text-[10px] font-bold text-slate-700 select-all"
        >
          <Save className="w-4 h-4 text-slate-500 mb-0.5 shrink-0" />
          Guardar Borrador
        </button>

        <button
          type="button"
          onClick={downloadExcel}
          className="flex flex-col items-center justify-center bg-amber-50 hover:bg-amber-100 py-2.5 rounded-xl border border-amber-200 transition text-[10px] font-bold text-amber-800"
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-500 mb-0.5 shrink-0" />
          Descargar XLSX
        </button>

        <button
          type="submit"
          disabled={submitting}
          className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition text-[10px] font-bold text-white shadow-md select-none ${
            submitting 
              ? 'bg-slate-400 border-slate-400 shadow-none cursor-not-allowed' 
              : 'bg-sky-500 hover:bg-sky-600 border border-sky-600 hover:border-sky-700 shadow-sky-500/10'
          }`}
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mb-0.5" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 text-white mb-0.5 shrink-0" />
              Enviar Reporte
            </>
          )}
        </button>
      </div>

    </form>
  );
}
