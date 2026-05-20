import React, { useState } from "react";
import { DailyReport, EvmMetrics, EdtItem } from "../types";
import { 
  TrendingUp, TrendingDown, Clock, Shield, Calendar, Image as ImageIcon, 
  UserCheck, AlertTriangle, Cpu, HelpCircle, ArrowRight, Table, FileText, CheckCircle2, Cloud
} from "lucide-react";

interface ProjectDashboardProps {
  reports: DailyReport[];
  edtList: EdtItem[];
  projectName: string;
}

export function ProjectDashboard({ reports, edtList, projectName }: ProjectDashboardProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports.length > 0 ? reports[reports.length - 1].id : null
  );
  
  // AI analysis state for individual reports
  const [aiAnalysis, setAiAnalysis] = useState<{ [reportId: string]: string }>({});
  const [loadingAi, setLoadingAi] = useState<string | null>(null);

  // Parse chronological reports
  const sortedReports = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculates cumulative EVM metrics across all dates for the S-Curve plot
  const generateChartData = () => {
    let cumulativePv = 0;
    let cumulativeEv = 0;
    let cumulativeAc = 0;

    return sortedReports.map((r, index) => {
      // Calculate local EVM metrics for this single report
      const metrics = r.metrics || { plannedValue: 2000, earnedValue: 2200, actualCost: 2100 };
      
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

  // Get current active metrics (last day totals)
  let latestPv = 0;
  let latestEv = 0;
  let latestAc = 0;

  chartData.forEach(d => {
    latestPv = d.pv;
    latestEv = d.ev;
    latestAc = d.ac;
  });

  const latestMo = latestAc; // simulated AC tracking
  
  const latestSv = latestEv - latestPv;
  const latestCv = latestEv - latestAc;
  const latestSpi = latestPv > 0 ? latestEv / latestPv : 1;
  const latestCpi = latestAc > 0 ? latestEv / latestAc : 1;

  // Render SVG Cumulative lines gracefully
  const renderSvgChart = () => {
    if (chartData.length === 0) return null;

    const width = 500;
    const height = 240;
    const padding = 45;

    // Find max values across arrays
    const allValues = chartData.flatMap(d => [d.pv, d.ev, d.ac]);
    const maxVal = Math.max(...allValues, 1000) * 1.1; // 10% ceiling
    const minVal = 0;

    const getX = (index: number) => {
      if (chartData.length <= 1) return padding + (width - padding * 2) / 2;
      return padding + (index / (chartData.length - 1)) * (width - padding * 2);
    };

    const getY = (val: number) => {
      const scale = (height - padding * 2) / (maxVal - minVal);
      return height - padding - (val - minVal) * scale;
    };

    // Build SVG paths
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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
        {/* Draw subtle grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const yVal = minVal + (maxVal - minVal) * p;
          const y = getY(yVal);
          return (
            <g key={i}>
              <line 
                x1={padding} 
                y1={y} 
                x2={width - padding} 
                y2={y} 
                stroke="#e2e8f0" 
                strokeWidth={1} 
                strokeDasharray="4,4" 
              />
              <text 
                x={padding - 8} 
                y={y + 3} 
                className="text-[9px] font-mono font-bold text-slate-400 text-right fill-current"
                textAnchor="end"
              >
                ${Math.round(yVal)}
              </text>
            </g>
          );
        })}

        {/* Draw X Axis Dates */}
        {chartData.map((d, i) => {
          const x = getX(i);
          return (
            <g key={i}>
              <line 
                x1={x} 
                y1={padding} 
                x2={x} 
                y2={height - padding} 
                stroke="#f1f5f9" 
                strokeWidth={1} 
              />
              <text 
                x={x} 
                y={height - padding + 15} 
                className="text-[8px] font-semibold text-slate-400 fill-current text-center"
                textAnchor="middle"
              >
                {d.date.slice(5)}
              </text>
            </g>
          );
        })}

        {/* Draw Curves paths */}
        <path d={pvPath} fill="none" stroke="#0ea5e9" strokeWidth={2.5} strokeDasharray="3,3" /> {/* Blue dotted PV */}
        <path d={evPath} fill="none" stroke="#22c55e" strokeWidth={3} /> {/* Green EV */}
        <path d={acPath} fill="none" stroke="#ef4444" strokeWidth={3} /> {/* Red AC */}

        {/* Dot Markers */}
        {chartData.map((d, i) => {
          const x = getX(i);
          return (
            <g key={i}>
              <circle cx={x} cy={getY(d.pv)} r={3.5} className="fill-sky-500 stroke-white stroke-2" />
              <circle cx={x} cy={getY(d.ev)} r={3.5} className="fill-green-500 stroke-white stroke-2" />
              <circle cx={x} cy={getY(d.ac)} r={3.5} className="fill-red-500 stroke-white stroke-2" />
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
          projectCode: report.projectCode
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
        [report.id]: "Disculpas, ocurrió un error consultando al robot de IA de Gemini. Verifica la conexión o el Secret de clave."
      }));
    } finally {
      setLoadingAi(null);
    }
  };

  const selectedReport = reports.find(r => r.id === selectedReportId);

  return (
    <div className="p-4 sm:p-6 space-y-6 font-sans select-none text-slate-800 bg-slate-50 min-h-screen">
      
      {/* Overview Card header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <span className="bg-sky-50 text-sky-700 px-3 py-1 rounded-full text-xxs font-extrabold uppercase border border-sky-150 inline-block">
            Oficina de Control Técnico (PMO)
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-2 font-sans">
            Curva S de Control EVM: {projectName}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium scale-y-100 uppercase">
            Proyecto Activo: {selectedReport?.projectCode || "GENERAL"} | {reports.length} reportes procesados
          </p>
        </div>

        {/* Global Performance indexes tags */}
        <div className="flex gap-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center min-w-[90px]">
            <span className="text-[10px] text-emerald-600 block uppercase font-bold tracking-wide">SPI (Plazo)</span>
            <span className="text-lg font-black font-mono text-emerald-800">{latestSpi.toFixed(2)}</span>
            <span className="text-[9px] text-emerald-600 block font-medium mt-0.5">
              {latestSpi >= 1 ? "A tiempo / Adelanto" : "Retraso"}
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center min-w-[90px]">
            <span className="text-[10px] text-amber-600 block uppercase font-bold tracking-wide">CPI (Costo)</span>
            <span className="text-lg font-black font-mono text-amber-800">{latestCpi.toFixed(2)}</span>
            <span className="text-[9px] text-amber-600 block font-medium mt-0.5">
              {latestCpi >= 1 ? "Bajo Presupuesto" : "Sobrecosto"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN: S-CURVE METRICS CHART */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              Curva S de Rendimiento de Producción (Acumulado)
            </h2>
            {/* Chart Legend */}
            <div className="flex gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 border-t-2 border-sky-500 border-dashed inline-block" /> PV</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-green-500 inline-block" /> EV</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-red-500 inline-block" /> AC</span>
            </div>
          </div>

          <div className="h-[240px] flex items-center justify-center p-1 bg-slate-50/50 rounded-xl border border-slate-100">
            {chartData.length > 0 ? (
              renderSvgChart()
            ) : (
              <div className="text-xs text-slate-400 italic">No hay datos suficientes para graficar la curva S. Ingrese reportes.</div>
            )}
          </div>

          {/* Core Values grid */}
          <div className="grid grid-cols-4 gap-3 text-center select-none pt-2">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wide">Total PV</span>
              <span className="text-xs font-bold font-mono text-slate-700">${latestPv.toLocaleString()}</span>
            </div>
            <div className="bg-green-50/50 p-2.5 rounded-xl border border-green-100">
              <span className="text-[9px] font-bold text-green-600 block uppercase tracking-wide">Total EV</span>
              <span className="text-xs font-extrabold font-mono text-green-700">${latestEv.toLocaleString()}</span>
            </div>
            <div className="bg-red-50/50 p-2.5 rounded-xl border border-red-100">
              <span className="text-[9px] font-bold text-red-600 block uppercase tracking-wide">Total AC</span>
              <span className="text-xs font-bold font-mono text-red-700">${latestAc.toLocaleString()}</span>
            </div>
            <div className={`p-2.5 rounded-xl border ${latestSv >= 0 ? "bg-emerald-50/30 border-emerald-100 text-emerald-800" : "bg-rose-50/30 border-rose-100 text-rose-800"}`}>
              <span className="text-[9px] font-bold block uppercase tracking-wide">SV Varianza</span>
              <span className="text-xs font-extrabold font-mono block">
                {latestSv >= 0 ? `+$${latestSv.toLocaleString()}` : `-$${Math.abs(latestSv).toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIST OF REPORTS HISTORY */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3 flex-1 overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
              Historial de RDOs Enviados
            </h2>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {sortedReports.map((r, index) => {
                const isSelected = r.id === selectedReportId;
                const metrics = r.metrics || { spi: 1, cpi: 1 };
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReportId(r.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-center justify-between ${
                      isSelected
                        ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-tight block">
                        Día {index + 1} - {r.date}
                      </span>
                      <span className={`text-[9px] mt-0.5 font-medium ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                        Por: {r.supervisor}
                      </span>
                    </div>

                    <div className="text-right flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        metrics.spi >= 1 
                          ? (isSelected ? 'bg-emerald-600/50 text-emerald-300' : 'bg-emerald-100 text-emerald-800') 
                          : (isSelected ? 'bg-rose-600/50 text-rose-300' : 'bg-rose-100 text-rose-800')
                      }`}>
                        SPI: {metrics.spi.toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
              {reports.length === 0 && (
                <p className="text-xs italic text-slate-400 text-center py-10">Ningún reporte guardado todavía.</p>
              )}
            </div>
          </div>
          
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-4 text-[11px] text-slate-500 font-medium">
            💡 Haz clic en cualquier reporte de la lista para ver el cuaderno de campo y auditar los datos de producción en tiempo real.
          </div>
        </div>

      </div>

      {/* DETAILED ACTIVE REPORT SELECTOR VIEW */}
      {selectedReport && (
        <div id="selected-report-workspace" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-3">
          
          {/* Work report summary columns & signature */}
          <div className="p-5 md:col-span-2 border-r border-slate-200/50 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xxs uppercase font-mono text-sky-600 font-extrabold tracking-widest">{selectedReport.id}</span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">Cuaderno de Obra de Campo</h3>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 font-bold font-mono px-3 py-1 rounded-full">
                Fecha de Ejecución: {selectedReport.date}
              </span>
            </div>

            {/* Weather and Shift details bar */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs text-slate-600">
              <div className="bg-slate-50 p-2 rounded-xl">
                <span className="text-[9px] text-slate-400 block font-bold">Turno</span>
                <span className="font-semibold">{selectedReport.shift}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl">
                <span className="text-[9px] text-slate-400 block font-bold">Horas</span>
                <span className="font-semibold">{selectedReport.effectiveHours} hrs</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl">
                <span className="text-[9px] text-slate-400 block font-bold">Clima Mañana</span>
                <span className="font-semibold">☀️ {selectedReport.weatherMorning}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl">
                <span className="text-[9px] text-slate-400 block font-bold">Clima Tarde</span>
                <span className="font-semibold">☁️ {selectedReport.weatherAfternoon}</span>
              </div>
            </div>

            {/* Activities Table */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block uppercase">1. Metas y avances de producción ejecutados hoje:</span>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50 shadow-inner">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="p-2.5">EDT</th>
                      <th className="p-2.5">Actividad Partida</th>
                      <th className="p-2.5 text-right">Cantidad</th>
                      <th className="p-2.5 text-right">Avance (%)</th>
                      <th className="p-2.5">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {selectedReport.activities.map((act, index) => {
                      const matchEdt = edtList.find(e => e.code === act.edtCode);
                      const percent = matchEdt ? (act.qtyExecuted / matchEdt.totalBudgetQty) * 100 : 0;
                      return (
                        <tr key={index} className="hover:bg-white transition-colors">
                          <td className="p-2.5 font-mono font-bold text-sky-600">{act.edtCode}</td>
                          <td className="p-2.5 font-medium">{matchEdt?.name || "Desconocida"}</td>
                          <td className="p-2.5 text-right font-mono font-semibold">{act.qtyExecuted} {matchEdt?.unit}</td>
                          <td className="p-2.5 text-right font-mono text-slate-500">{percent.toFixed(1)}%</td>
                          <td className="p-2.5 italic text-slate-400 text-xxs">{act.notes || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Safety & Incident details text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100 space-y-1">
                <span className="font-bold text-emerald-800 uppercase text-[10px]">Cuidado de Personal y Seguridad</span>
                <p className="font-medium text-emerald-950">
                  Inspección: {selectedReport.safetyInspected ? "SÍ CONFORME" : "NO REALIZADO"}
                </p>
                <p className="text-slate-600 italic text-xxs leading-relaxed">
                  {selectedReport.safetyDetails || "Sin detalles específicos de prevención registrados."}
                </p>
                <p className="text-[10px] font-bold text-slate-500 pt-1">
                  Trabajadores censados en obra: {selectedReport.totalStaff} obreros.
                </p>
              </div>

              <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-100 space-y-1">
                <span className="font-bold text-amber-800 uppercase text-[10px]">Restricciones e Incidentes</span>
                <p className="font-medium text-amber-950">Conflictos identificados:</p>
                <p className="text-slate-600 italic text-xxs truncate hover:text-clip">
                  {selectedReport.conflicts || "Sin comentarios de interferencia."}
                </p>
                <div className="border-t border-amber-200/50 pt-1.5 mt-1.5 space-y-0.5">
                  <span className="block font-bold text-[9px] text-sky-700 uppercase">Frenos / Accidentes:</span>
                  <p className="text-red-700 italic text-xxs font-medium">{selectedReport.incidents || "Ninguno registrado."}</p>
                </div>
              </div>
            </div>

            {/* Photos of progress and digital sign wrapper */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              {/* Captured Photos */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Fotografías Adjuntas de Campo (Avance)</span>
                {selectedReport.photoUrlsLocal && selectedReport.photoUrlsLocal.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedReport.photoUrlsLocal.map((url, i) => (
                      <div key={i} className="aspect-video rounded-lg border border-slate-100 overflow-hidden shadow-inner relative">
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
                  <p className="text-xxs italic text-slate-400 p-4 border border-dashed border-slate-200 rounded-xl text-center">
                    No se adjuntaron fotos de avance en el envío original.
                  </p>
                )}
              </div>

              {/* Verified sign */}
              <div className="space-y-2 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Firma Digital del Supervisor</span>
                {selectedReport.signatureUrlLocal ? (
                  <div className="border border-slate-200 bg-slate-50/50 rounded-xl overflow-hidden shadow-inner flex-1 p-2 flex items-center justify-center max-h-[110px]">
                    <img 
                      src={selectedReport.signatureUrlLocal} 
                      alt="Firma del Responsable" 
                      className="max-h-[85px] object-contain scale-x-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-200 rounded-xl text-center p-6 text-xxs italic text-slate-400">
                    Firma autorizada localmente sin trazo digital registrado.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI SPECIALIST PMO ROBOT WORKSPACE */}
          <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-sky-400 shrink-0" />
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">Asistente de IA: PMO Gemini</h4>
              </div>
              <span className="bg-sky-450/10 text-sky-300 font-mono text-[9px] px-2 py-0.5 rounded-full font-bold border border-sky-500/20">
                gemini-3.5
              </span>
            </div>

            <p className="text-[11px] text-slate-350 leading-relaxed font-sans">
              Analiza en tiempo real zanjas, retrasos por lluvia, consumos de personal y desvíos de presupuesto contra los índices EVM.
            </p>

            {aiAnalysis[selectedReport.id] ? (
              <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80 text-[11px] text-slate-300 leading-relaxed select-all overflow-y-auto max-h-[320px] font-mono scrollbar-thin whitespace-pre-line text-left">
                {aiAnalysis[selectedReport.id]}
              </div>
            ) : (
              <div className="border-t border-slate-850 pt-3">
                <button
                  type="button"
                  onClick={() => handleGenerateAiAudit(selectedReport)}
                  disabled={loadingAi !== null}
                  className="w-full bg-sky-500 hover:bg-sky-600 transition text-slate-950 font-sans font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-sky-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loadingAi === selectedReport.id ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      Analizando datos EVM...
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

            <div className="text-[10px] text-slate-400 text-center select-none italic">
              *El diagnóstico audita SV, CV, CPI, SPI e introduce planes correctivos en un informe ejecutivo instantáneo.
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
