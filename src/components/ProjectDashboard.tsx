import React, { useState } from "react";
import { DailyReport, EvmMetrics, EdtItem } from "../types";
import { 
  TrendingUp, TrendingDown, Clock, Shield, Calendar, Image as ImageIcon, 
  UserCheck, AlertTriangle, Cpu, ArrowRight, Table, FileText, CheckCircle2, 
  Cloud, RefreshCw, BarChart3, Info, HardHat
} from "lucide-react";

// Standard Resource Catalog rates for live AC calculations
const RESOURCE_COSTS: { [id: string]: number } = {
  "LH-CAP": 28.0,
  "LH-OPE": 22.5,
  "LH-OFI": 18.0,
  "LH-PEO": 14.5,
  "MAT-CEM": 8.9,
  "MAT-ARE": 24.0,
  "MAT-LAD": 320.0,
  "EQ-MEZ": 12.0,
  "EQ-RET": 48.0
};

interface ProjectDashboardProps {
  reports: DailyReport[];
  edtList: EdtItem[];
  projectName: string;
  onRefresh?: () => void;
  isSheetsConnected?: boolean;
}

export function ProjectDashboard({ 
  reports, 
  edtList, 
  projectName, 
  onRefresh, 
  isSheetsConnected = false 
}: ProjectDashboardProps) {
  
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports.length > 0 ? reports[reports.length - 1].id : null
  );
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<{ [reportId: string]: string }>({});
  const [loadingAi, setLoadingAi] = useState<string | null>(null);

  // Parse chronological reports
  const sortedReports = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 1. Enrich reports with mathematically exact live EVM calculations
  const enrichedReports = sortedReports.map(r => {
    let pv = 0;
    let ev = 0;
    let ac = 0;

    // Calculate PV & EV from Metrados
    r.activities?.forEach(act => {
      const edt = edtList.find(e => e.code === act.edtCode);
      if (edt) {
        pv += (act.plannedQty || 0) * edt.unitPrice;
        ev += (act.qtyExecuted || 0) * edt.unitPrice;
      }
    });

    // Calculate AC from resource log
    r.manoObra?.forEach(mo => {
      const cost = RESOURCE_COSTS[mo.resourceId] || 20.0;
      ac += (mo.hoursWorked || 0) * cost;
    });

    r.materials?.forEach(mat => {
      const cost = RESOURCE_COSTS[mat.resourceId] || 10.0;
      ac += (mat.qtyConsumed || 0) * cost;
    });

    r.equipos?.forEach(eq => {
      const cost = RESOURCE_COSTS[eq.resourceId] || 30.0;
      ac += (eq.qtyUsed || 0) * cost;
    });

    // Fallback to pre-calculated metrics if details are empty
    if (pv === 0 && ev === 0 && ac === 0 && r.metrics) {
      pv = r.metrics.plannedValue || 0;
      ev = r.metrics.earnedValue || 0;
      ac = r.metrics.actualCost || 0;
    }

    // If it's a safety-only report with no production metrics, keep them at zero
    const sv = ev - pv;
    const cv = ev - ac;
    const spi = pv > 0 ? ev / pv : 1.0;
    const cpi = ac > 0 ? ev / ac : 1.0;

    return {
      ...r,
      computedMetrics: {
        plannedValue: pv,
        earnedValue: ev,
        actualCost: ac,
        sv,
        cv,
        spi,
        cpi
      }
    };
  });

  // 2. Generate cumulative series for the S-Curve SVG Plot
  const generateChartData = () => {
    let cumulativePv = 0;
    let cumulativeEv = 0;
    let cumulativeAc = 0;

    return enrichedReports.map((r, index) => {
      const metrics = r.computedMetrics;
      
      cumulativePv += metrics.plannedValue;
      cumulativeEv += metrics.earnedValue;
      cumulativeAc += metrics.actualCost;

      return {
        date: r.date,
        dayLabel: `Día ${index + 1}`,
        pv: cumulativePv,
        ev: cumulativeEv,
        ac: cumulativeAc,
        raw: metrics
      };
    });
  };

  const chartData = generateChartData();

  // Get current active cumulative values (totals at the last day)
  let latestPv = 0;
  let latestEv = 0;
  let latestAc = 0;

  chartData.forEach(d => {
    latestPv = d.pv;
    latestEv = d.ev;
    latestAc = d.ac;
  });

  const latestSv = latestEv - latestPv;
  const latestCv = latestEv - latestAc;
  const latestSpi = latestPv > 0 ? latestEv / latestPv : 1;
  const latestCpi = latestAc > 0 ? latestEv / latestAc : 1;

  // 3. Generate EDT/WBS Chapter Breakdown (Estructuras vs Arquitectura)
  const generateChaptersData = () => {
    return edtList.filter(e => e.parentId === null).map(ch => {
      let chPv = 0;
      let chEv = 0;
      let chAc = 0;

      enrichedReports.forEach(r => {
        // Metas y avances de metrado
        r.activities?.forEach(act => {
          const edt = edtList.find(e => e.code === act.edtCode);
          if (edt && (edt.code === ch.code || edt.parentId === ch.code)) {
            chPv += (act.plannedQty || 0) * edt.unitPrice;
            chEv += (act.qtyExecuted || 0) * edt.unitPrice;
          }
        });

        // Recursos cargados a este capítulo
        r.manoObra?.forEach(mo => {
          if (mo.edtGroupCode === ch.code) {
            chAc += (mo.hoursWorked || 0) * (RESOURCE_COSTS[mo.resourceId] || 20.0);
          }
        });

        r.materials?.forEach(mat => {
          if (mat.edtGroupCode === ch.code) {
            chAc += (mat.qtyConsumed || 0) * (RESOURCE_COSTS[mat.resourceId] || 10.0);
          }
        });

        r.equipos?.forEach(eq => {
          if (eq.edtGroupCode === ch.code) {
            chAc += (eq.qtyUsed || 0) * (RESOURCE_COSTS[eq.resourceId] || 30.0);
          }
        });
      });

      const chSv = chEv - chPv;
      const chCv = chEv - chAc;
      const chSpi = chPv > 0 ? chEv / chPv : 1.0;
      const chCpi = chAc > 0 ? chEv / chAc : 1.0;

      return {
        code: ch.code,
        name: ch.name,
        pv: chPv,
        ev: chEv,
        ac: chAc,
        sv: chSv,
        cv: chCv,
        spi: chSpi,
        cpi: chCpi
      };
    });
  };

  const chaptersData = generateChaptersData();

  // Handle live sheets refresh trigger
  const handleSync = async () => {
    if (!onRefresh) return;
    setIsSyncing(true);
    try {
      await onRefresh();
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString());
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Render Cumulative S-Curve SVG Chart
  const renderSvgChart = () => {
    if (chartData.length === 0) return null;

    const width = 800;
    const height = 300;
    const paddingLeft = 70;
    const paddingRight = 30;
    const paddingTop = 40;
    const paddingBottom = 40;

    const allValues = chartData.flatMap(d => [d.pv, d.ev, d.ac]);
    const maxVal = Math.max(...allValues, 1000) * 1.15; // 15% margin
    const minVal = 0;

    const getX = (index: number) => {
      if (chartData.length <= 1) return paddingLeft + (width - paddingLeft - paddingRight) / 2;
      return paddingLeft + (index / (chartData.length - 1)) * (width - paddingLeft - paddingRight);
    };

    const getY = (val: number) => {
      const scale = (height - paddingTop - paddingBottom) / (maxVal - minVal);
      return height - paddingBottom - (val - minVal) * scale;
    };

    let pvPath = "";
    let evPath = "";
    let acPath = "";

    chartData.forEach((d, i) => {
      const x = getX(i);
      const yPv = getY(d.pv);
      const yEv = getY(d.ev);
      const yAc = getY(d.ac);

      if (i === 0) {
        pvPath = `M ${x} ${yPv}`;
        evPath = `M ${x} ${yEv}`;
        acPath = `M ${x} ${yAc}`;
      } else {
        pvPath += ` L ${x} ${yPv}`;
        evPath += ` L ${x} ${yEv}`;
        acPath += ` L ${x} ${yAc}`;
      }
    });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none font-sans">
        {/* Draw subtle grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const yVal = minVal + (maxVal - minVal) * p;
          const y = getY(yVal);
          return (
            <g key={i}>
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={width - paddingRight} 
                y2={y} 
                stroke="#334155" 
                strokeWidth={1} 
                strokeDasharray="4,4" 
                opacity="0.3"
              />
              <text 
                x={paddingLeft - 10} 
                y={y + 3} 
                className="text-[10px] font-mono font-extrabold fill-slate-400"
                textAnchor="end"
              >
                ${Math.round(yVal).toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Draw X Axis Dates */}
        {chartData.map((d, i) => {
          if (chartData.length > 10 && i % 2 !== 0 && i !== chartData.length - 1) return null; // reduce clutter
          const x = getX(i);
          return (
            <g key={i}>
              <line 
                x1={x} 
                y1={paddingTop} 
                x2={x} 
                y2={height - paddingBottom} 
                stroke="#334155" 
                strokeWidth={1} 
                opacity="0.15"
              />
              <text 
                x={x} 
                y={height - paddingBottom + 18} 
                className="text-[9px] font-bold fill-slate-400"
                textAnchor="middle"
              >
                {d.date.slice(5)}
              </text>
            </g>
          );
        })}

        {/* Curves paths */}
        <path d={pvPath} fill="none" stroke="#0ea5e9" strokeWidth={3} strokeDasharray="5,5" /> 
        <path d={evPath} fill="none" stroke="#10b981" strokeWidth={3.5} /> 
        <path d={acPath} fill="none" stroke="#f43f5e" strokeWidth={3.5} /> 

        {/* Dot Markers for current points */}
        {chartData.map((d, i) => {
          const x = getX(i);
          return (
            <g key={i} className="cursor-pointer group">
              <circle cx={x} cy={getY(d.pv)} r={4} className="fill-sky-500 stroke-slate-900 stroke-2 hover:r-5 transition-all" />
              <circle cx={x} cy={getY(d.ev)} r={4} className="fill-emerald-500 stroke-slate-900 stroke-2 hover:r-5 transition-all" />
              <circle cx={x} cy={getY(d.ac)} r={4} className="fill-rose-500 stroke-slate-900 stroke-2 hover:r-5 transition-all" />
            </g>
          );
        })}
      </svg>
    );
  };

  // Run server-side Gemini RDO Audit
  const handleGenerateAiAudit = async (report: DailyReport) => {
    setLoadingAi(report.id);
    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentReport: report,
          projectCode: "MFG-01"
        })
      });
      const data = await response.json();
      setAiAnalysis(prev => ({
        ...prev,
        [report.id]: data.analysis
      }));
    } catch (err: any) {
      console.error(err);
      setAiAnalysis(prev => ({
        ...prev,
        [report.id]: "Error consultando al servicio de IA. El servidor local Express está inactivo, pero tu base de datos de Sheets está al 100% sincronizada."
      }));
    } finally {
      setLoadingAi(null);
    }
  };

  const selectedReport = enrichedReports.find(r => r.id === selectedReportId);

  return (
    <div className="space-y-6 select-none text-slate-200 bg-slate-900 p-1 sm:p-4 rounded-3xl min-h-screen">
      
      {/* 1. TOP HEADER PANEL */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-sky-500/10 text-sky-400 px-3 py-0.5 rounded-full text-xxs font-extrabold uppercase border border-sky-500/20 tracking-wider">
              Control Técnico de Proyectos (PMO)
            </span>
            {isSheetsConnected ? (
              <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/25 flex items-center gap-1">
                <Cloud className="w-3 h-3" /> Sheets Conectado
              </span>
            ) : (
              <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/25 flex items-center gap-1">
                <Info className="w-3 h-3" /> Solo Local Fallback
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-2 font-sans">
            Dashboard Corporativo: {projectName}
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase font-mono tracking-wider">
            Proyecto Único: <span className="text-sky-300">MFG-01</span> | {reports.length} reportes consolidados en la base de datos
          </p>
        </div>

        {/* Live sync actions */}
        <div className="flex flex-wrap items-center gap-4">
          {onRefresh && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing || !isSheetsConnected}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSheetsConnected 
                    ? "bg-sky-500 text-slate-950 hover:bg-sky-400" 
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Sincronizando..." : "Sincronizar Sheets"}
              </button>
              <div className="text-right pr-2">
                <span className="text-[9px] text-slate-550 block font-bold uppercase">Sincronización</span>
                <span className="text-[10px] font-mono text-slate-350 block">
                  {lastSyncTime ? `Hoy, ${lastSyncTime}` : "No sincronizado"}
                </span>
              </div>
            </div>
          )}

          {/* Core Performance gauges */}
          <div className="flex gap-3">
            <div className={`border rounded-xl p-3 text-center min-w-[95px] ${
              latestSpi >= 1 
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/5 border-rose-500/20 text-rose-400"
            }`}>
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">SPI (Plazo)</span>
              <span className="text-xl font-black font-mono block mt-0.5">{latestSpi.toFixed(2)}</span>
              <span className="text-[9px] block font-bold uppercase mt-0.5">
                {latestSpi >= 1 ? "Adelantado" : "Retrasado"}
              </span>
            </div>

            <div className={`border rounded-xl p-3 text-center min-w-[95px] ${
              latestCpi >= 1 
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/5 border-rose-500/20 text-rose-400"
            }`}>
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">CPI (Costo)</span>
              <span className="text-xl font-black font-mono block mt-0.5">{latestCpi.toFixed(2)}</span>
              <span className="text-[9px] block font-bold uppercase mt-0.5">
                {latestCpi >= 1 ? "Ahorro" : "Sobrecosto"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CUMULATIVE NUMERICAL METRICS PANEL */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] text-slate-450 block font-bold uppercase tracking-wider">Valor Planificado (PV)</span>
          <span className="text-lg font-black font-mono text-sky-400 block mt-1">${latestPv.toLocaleString()}</span>
          <span className="text-[9px] text-slate-500 block mt-0.5">Presupuesto programado</span>
        </div>

        <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] text-slate-450 block font-bold uppercase tracking-wider">Valor Ganado (EV)</span>
          <span className="text-lg font-black font-mono text-emerald-400 block mt-1">${latestEv.toLocaleString()}</span>
          <span className="text-[9px] text-slate-500 block mt-0.5">Trabajo físico valorizado</span>
        </div>

        <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] text-slate-450 block font-bold uppercase tracking-wider">Costo Real (AC)</span>
          <span className="text-lg font-black font-mono text-rose-400 block mt-1">${latestAc.toLocaleString()}</span>
          <span className="text-[9px] text-slate-500 block mt-0.5">Costo acumulado incurrido</span>
        </div>

        <div className={`p-4 rounded-xl border ${
          latestSv >= 0 
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/5 border-rose-500/20 text-rose-400"
        }`}>
          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Varianza de Plazo (SV)</span>
          <span className="text-lg font-black font-mono block mt-1">
            {latestSv >= 0 ? `+$${latestSv.toLocaleString()}` : `-$${Math.abs(latestSv).toLocaleString()}`}
          </span>
          <span className="text-[9px] block mt-0.5 font-semibold">
            {latestSv >= 0 ? "Adelanto en dinero" : "Atraso en dinero"}
          </span>
        </div>

        <div className={`p-4 rounded-xl border ${
          latestCv >= 0 
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/5 border-rose-500/20 text-rose-400"
        }`}>
          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Varianza de Costo (CV)</span>
          <span className="text-lg font-black font-mono block mt-1">
            {latestCv >= 0 ? `+$${latestCv.toLocaleString()}` : `-$${Math.abs(latestCv).toLocaleString()}`}
          </span>
          <span className="text-[9px] block mt-0.5 font-semibold">
            {latestCv >= 0 ? "Bajo presupuesto" : "Pérdida/Sobrecosto"}
          </span>
        </div>

        <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-[10px] text-slate-450 block font-bold uppercase tracking-wider">Metrado Restante</span>
          <span className="text-sm font-bold font-mono text-slate-300 block mt-1">
            {(latestPv > 0 ? (100 - (latestEv/latestPv)*100).toFixed(1) : 0)}% por ejecutar
          </span>
          <span className="text-[9px] text-slate-500 block mt-0.5">Avance estimado total</span>
        </div>
      </div>

      {/* 3. CORE CHARTS & HISTORY GRID (PC LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: LARGE S-CURVE GRAPH (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-4 gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              <TrendingUp className="w-5 h-5 text-sky-400" />
              Curva S de Rendimiento EVM Acumulado (Línea Base vs Real)
            </h2>
            
            <div className="flex gap-4 text-xxs font-extrabold tracking-wider">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 border-t-2 border-sky-400 border-dashed inline-block"></span> PROGRAMADO (PV)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-emerald-500 inline-block rounded-full"></span> FISICO REAL (EV)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-rose-500 inline-block rounded-full"></span> COSTO INCURRIDO (AC)</span>
            </div>
          </div>

          <div className="flex-1 min-h-[280px] bg-slate-900/40 rounded-xl p-3 border border-slate-850 flex items-center justify-center relative">
            {chartData.length > 0 ? (
              renderSvgChart()
            ) : (
              <div className="text-xs text-slate-500 italic flex flex-col items-center gap-2">
                <BarChart3 className="w-8 h-8 text-slate-700 animate-pulse" />
                No hay datos suficientes para graficar la curva S de obra. Genera reportes o datos sintéticos.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RDO CHRONOLOGICAL HISTORY LIST (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col">
          <h2 className="text-base font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-4 mb-4">
            Historial Cronológico de RDOs
          </h2>
          
          <div className="flex-1 overflow-y-auto max-h-[320px] pr-1 space-y-2.5 scrollbar-thin">
            {enrichedReports.map((r, index) => {
              const isSelected = r.id === selectedReportId;
              const metrics = r.computedMetrics;
              const hasProduction = metrics.plannedValue > 0 || metrics.earnedValue > 0 || metrics.actualCost > 0;
              
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? "bg-slate-100 border-white text-slate-950 shadow-lg shadow-white/5"
                      : "bg-slate-900/60 hover:bg-slate-900 border-slate-850 text-slate-350"
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider block">
                      Día {index + 1} - {r.date}
                    </span>
                    <span className={`text-[9px] font-bold block mt-0.5 ${isSelected ? "text-slate-700" : "text-slate-450"}`}>
                      Responsable: {r.supervisor}
                    </span>
                    <span className={`text-[9px] block mt-0.5 italic ${isSelected ? "text-slate-600" : "text-slate-500"}`}>
                      {r.shift} | Clima: {r.weatherMorning}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    {hasProduction ? (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-black ${
                        metrics.spi >= 1 
                          ? (isSelected ? 'bg-emerald-250 text-emerald-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/35') 
                          : (isSelected ? 'bg-rose-250 text-rose-800' : 'bg-rose-950 text-rose-400 border border-rose-800/35')
                      }`}>
                        SPI: {metrics.spi.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400 border border-slate-700/50">
                        HSE SOLO
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {reports.length === 0 && (
              <p className="text-xs italic text-slate-550 text-center py-20">No se encontraron reportes cargados en la base de datos.</p>
            )}
          </div>
        </div>

      </div>

      {/* 4. EDT CHAPTERS ANALYTICAL CONTROL BREAKDOWN TABLE */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center gap-2 uppercase tracking-wider border-b border-slate-800 pb-4 mb-4">
          <Table className="w-5 h-5 text-sky-400" />
          Control Analítico de Valor Ganado por Capítulos EDT (WBS)
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-350 border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                <th className="p-3">Código EDT</th>
                <th className="p-3">Nombre del Capítulo</th>
                <th className="p-3 text-right">Valor Planificado (PV)</th>
                <th className="p-3 text-right">Valor Ganado (EV)</th>
                <th className="p-3 text-right">Costo Real (AC)</th>
                <th className="p-3 text-right">Varianza Plazo (SV)</th>
                <th className="p-3 text-right">Varianza Costo (CV)</th>
                <th className="p-3 text-right">Índice SPI</th>
                <th className="p-3 text-right">Índice CPI</th>
                <th className="p-3 text-center">Estado del Capítulo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {chaptersData.map((ch, idx) => {
                const chPercent = ch.pv > 0 ? (ch.ev / ch.pv) * 100 : 0;
                
                return (
                  <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-sky-400">{ch.code}</td>
                    <td className="p-3 font-bold text-slate-100">{ch.name}</td>
                    <td className="p-3 text-right font-mono font-semibold">${ch.pv.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-400">${ch.ev.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-semibold text-rose-400">${ch.ac.toLocaleString()}</td>
                    
                    <td className={`p-3 text-right font-mono font-bold ${ch.sv >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {ch.sv >= 0 ? `+$${ch.sv.toLocaleString()}` : `-$${Math.abs(ch.sv).toLocaleString()}`}
                    </td>
                    
                    <td className={`p-3 text-right font-mono font-bold ${ch.cv >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {ch.cv >= 0 ? `+$${ch.cv.toLocaleString()}` : `-$${Math.abs(ch.cv).toLocaleString()}`}
                    </td>
                    
                    <td className={`p-3 text-right font-mono font-extrabold ${ch.spi >= 1 ? "text-emerald-400" : "text-rose-400"}`}>
                      {ch.spi.toFixed(2)}
                    </td>
                    
                    <td className={`p-3 text-right font-mono font-extrabold ${ch.cpi >= 1 ? "text-emerald-400" : "text-rose-400"}`}>
                      {ch.cpi.toFixed(2)}
                    </td>

                    <td className="p-3 text-center">
                      {ch.pv === 0 ? (
                        <span className="bg-slate-800 text-slate-400 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
                          Sin iniciar
                        </span>
                      ) : ch.spi >= 1 && ch.cpi >= 1 ? (
                        <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          Saludable
                        </span>
                      ) : (
                        <span className="bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-rose-500/20 animate-pulse">
                          Desviado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. SELECTED REPORT DETAILED FIELD LOG NOTEBOOK */}
      {selectedReport && (
        <div id="selected-report-workspace" className="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden grid grid-cols-1 xl:grid-cols-12">
          
          {/* Work report summary columns & details (xl:col-span-8) */}
          <div className="p-6 xl:col-span-8 border-r border-slate-850 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-850 pb-4 gap-3">
              <div>
                <span className="text-xxs uppercase font-mono text-sky-400 font-black tracking-widest">{selectedReport.id}</span>
                <h3 className="text-lg font-black text-white mt-1">Cuaderno de Obra de Campo</h3>
              </div>
              <span className="text-xs bg-slate-900 text-slate-350 font-bold font-mono px-3.5 py-1 rounded-full border border-slate-800">
                Fecha del RDO: {selectedReport.date}
              </span>
            </div>

            {/* Weather and Shift details bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs text-slate-300">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Turno de Obra</span>
                <span className="font-extrabold text-sm text-slate-200 mt-1 block">{selectedReport.shift}</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Horas Efectivas</span>
                <span className="font-extrabold text-sm text-slate-200 mt-1 block">{selectedReport.effectiveHours || 0} hrs</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Clima Mañana</span>
                <span className="font-extrabold text-sm text-slate-200 mt-1 block">☀️ {selectedReport.weatherMorning}</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Clima Tarde</span>
                <span className="font-extrabold text-sm text-slate-200 mt-1 block">☁️ {selectedReport.weatherAfternoon}</span>
              </div>
            </div>

            {/* Activities Table */}
            {selectedReport.activities && selectedReport.activities.length > 0 ? (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">1. Avance Físico Registrado (Earned Value):</span>
                <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/30">
                  <table className="w-full text-left text-xs text-slate-350 border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                        <th className="p-3">Código EDT</th>
                        <th className="p-3">Actividad de Partida</th>
                        <th className="p-3 text-right">Meta Planificada</th>
                        <th className="p-3 text-right">Metrado Ejecutado</th>
                        <th className="p-3">Detalle / Notas de Campo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {selectedReport.activities.map((act, index) => {
                        return (
                          <tr key={index} className="hover:bg-slate-900/20">
                            <td className="p-3 font-mono font-bold text-sky-400">{act.edtCode}</td>
                            <td className="p-3 font-bold text-slate-200">{act.name || "Actividad del RDO"}</td>
                            <td className="p-3 text-right font-mono text-slate-400">{act.plannedQty || 0} {act.unit}</td>
                            <td className="p-3 text-right font-mono font-extrabold text-emerald-400">{act.qtyExecuted} {act.unit}</td>
                            <td className="p-3 italic text-slate-450 text-[11px]">{act.notes || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/20 border border-slate-850 rounded-xl p-6 text-center text-xs italic text-slate-500">
                Este reporte no registra avances físicos de producción (Reporte de tipo HSE o Seguridad).
              </div>
            )}

            {/* Resources breakdown columns */}
            {selectedReport.manoObra && selectedReport.manoObra.length > 0 ? (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">2. Consumos y Costos Reales de Recursos (Actual Cost):</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Labor logs */}
                  <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2">
                    <span className="text-[10px] text-sky-400 block font-black uppercase tracking-wider">Mano de Obra</span>
                    <ul className="space-y-1.5 text-slate-350 text-[11px]">
                      {selectedReport.manoObra.map((mo, i) => (
                        <li key={i} className="flex justify-between border-b border-slate-850 pb-1">
                          <span>{mo.name || mo.resourceId}</span>
                          <span className="font-mono font-bold text-slate-100">{mo.hoursWorked} hrs</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Materials logs */}
                  <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2">
                    <span className="text-[10px] text-emerald-400 block font-black uppercase tracking-wider">Materiales</span>
                    {selectedReport.materials && selectedReport.materials.length > 0 ? (
                      <ul className="space-y-1.5 text-slate-350 text-[11px]">
                        {selectedReport.materials.map((mat, i) => (
                          <li key={i} className="flex justify-between border-b border-slate-850 pb-1">
                            <span>{mat.name || mat.resourceId}</span>
                            <span className="font-mono font-bold text-slate-100">{mat.qtyConsumed} {mat.unit}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-[10px] italic text-slate-550 block">Sin consumos de materiales.</span>
                    )}
                  </div>

                  {/* Equipment logs */}
                  <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2">
                    <span className="text-[10px] text-rose-400 block font-black uppercase tracking-wider">Equipos & Maquinaria</span>
                    {selectedReport.equipos && selectedReport.equipos.length > 0 ? (
                      <ul className="space-y-1.5 text-slate-350 text-[11px]">
                        {selectedReport.equipos.map((eq, i) => (
                          <li key={i} className="flex justify-between border-b border-slate-850 pb-1">
                            <span>{eq.name || eq.resourceId}</span>
                            <span className="font-mono font-bold text-slate-100">{eq.qtyUsed} {eq.unit || "H-M"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-[10px] italic text-slate-550 block">Sin equipos registrados.</span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Safety & Incident details text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-900/30 space-y-1.5">
                <span className="font-black text-emerald-400 uppercase text-[10px] tracking-wider flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  Charlas y Control HSE (Seguridad en Sitio)
                </span>
                <p className="font-bold text-slate-100">
                  Inspección Diaria: {selectedReport.safetyInspected ? "SÍ REALIZADO (CONFORME)" : "NO REALIZADO / DETALLES Pendientes"}
                </p>
                <p className="text-slate-400 italic text-[11px] leading-relaxed">
                  {selectedReport.safetyDetails || "Sin reportes de inspección de EPP o charlas específicas cargados hoy."}
                </p>
                <p className="text-[10px] font-bold text-sky-400 pt-1 border-t border-emerald-900/20 mt-2">
                  Personal en Obra (Fuerza Laboral Censada): {selectedReport.totalStaff || 0} personas.
                </p>
              </div>

              <div className="bg-rose-950/20 p-4 rounded-xl border border-rose-900/30 space-y-1.5">
                <span className="font-black text-rose-400 uppercase text-[10px] tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Incidentes y Restricciones
                </span>
                <p className="font-bold text-slate-100">Restricciones de Obra:</p>
                <p className="text-slate-400 italic text-[11px] leading-relaxed">
                  {selectedReport.conflicts || "Operación regular sin interferencias."}
                </p>
                <div className="border-t border-rose-900/20 pt-1.5 mt-2 space-y-0.5">
                  <span className="block font-black text-[9px] text-rose-400 uppercase">Accidentes / Lesiones:</span>
                  <p className="text-rose-350 italic font-bold text-[11px]">{selectedReport.incidents || "Ninguno reportado."}</p>
                </div>
              </div>
            </div>

            {/* Photos & Signatures */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-900 pt-4">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">Fotografías de Avance Adjuntas</span>
                {selectedReport.photoUrlsLocal && selectedReport.photoUrlsLocal.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedReport.photoUrlsLocal.map((url, i) => (
                      <div key={i} className="aspect-video rounded-lg border border-slate-800 overflow-hidden relative shadow-inner">
                        <img
                          src={url}
                          alt="Avance físico"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] italic text-slate-600 p-4 border border-dashed border-slate-800 rounded-xl text-center">
                    No se subieron fotografías para este reporte diario de obra.
                  </p>
                )}
              </div>

              <div className="space-y-2 flex flex-col justify-between">
                <span className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">Firma Digital del Supervisor Autorizado</span>
                {selectedReport.signatureUrlLocal ? (
                  <div className="border border-slate-850 bg-slate-900/20 rounded-xl overflow-hidden shadow-inner flex-1 p-2 flex items-center justify-center max-h-[110px]">
                    <img 
                      src={selectedReport.signatureUrlLocal} 
                      alt="Firma del Responsable" 
                      className="max-h-[85px] object-contain invert brightness-200"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-850 rounded-xl text-center p-6 text-[11px] italic text-slate-600">
                    Firma registrada sin trazado digital (Aprobación por credenciales del supervisor).
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI SPECIALIST PMO ROBOT WORKSPACE (xl:col-span-4) */}
          <div className="p-6 xl:col-span-4 bg-gradient-to-br from-slate-950 to-slate-900 text-slate-300 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-sky-400" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Auditor de IA: PMO Gemini</h4>
                </div>
                <span className="bg-sky-500/10 text-sky-300 font-mono text-[9px] px-2 py-0.5 rounded-full font-bold border border-sky-500/20">
                  gemini-3.5
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Analiza en tiempo real variaciones de rendimiento físico (SV) y costos financieros (CV) para dictar planes de mitigación de obra inmediatos.
              </p>

              {aiAnalysis[selectedReport.id] ? (
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850/80 text-[11px] text-slate-350 leading-relaxed font-mono overflow-y-auto max-h-[300px] scrollbar-thin whitespace-pre-line text-left">
                  {aiAnalysis[selectedReport.id]}
                </div>
              ) : (
                <div className="border-t border-slate-850/60 pt-4">
                  <button
                    type="button"
                    onClick={() => handleGenerateAiAudit(selectedReport)}
                    disabled={loadingAi !== null}
                    className="w-full bg-sky-500 hover:bg-sky-400 transition text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-sky-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {loadingAi === selectedReport.id ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        Auditando métricas RDO...
                      </>
                    ) : (
                      <>
                        <Cpu className="w-4 h-4 text-slate-950" />
                        Auditar Reporte con IA
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-500 text-center italic border-t border-slate-850/50 pt-4 select-none">
              *Audita desvíos acumulados, incidentes climáticos y consumos reales (AC) contra metas planificadas.
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
