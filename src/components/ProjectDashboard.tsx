import React, { useState, useEffect } from "react";
import { DailyReport, EvmMetrics, EdtItem, ResourceItem, PlannedValue } from "../types";
import { 
  TrendingUp, TrendingDown, Clock, Shield, CalendarDays, Image as ImageIcon, 
  UserCheck, AlertTriangle, ArrowRight, Table, FileText, CheckCircle2, 
  Cloud, RefreshCw, BarChart3, Info, HardHat, ChevronLeft, ChevronRight
} from "lucide-react";

// Standard Resource Catalog rates for live AC calculations
// Used as fallback when resource data from BD_RRHH is not loaded
const FALLBACK_RESOURCE_COSTS: { [id: string]: number } = {
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

interface PvCurvePoint {
  date: string;
  pvDaily: number;
  pvCumulative: number;
}

interface PvChapterPoint {
  code: string;
  totalBudget: number;
  points: { date: string; pvCumulative: number }[];
}

interface ProjectDashboardProps {
  reports: DailyReport[];
  edtList: EdtItem[];
  projectName: string;
  onRefresh?: () => void;
  isSheetsConnected?: boolean;
  pvCurveData?: PvCurvePoint[];
  pvByChapter?: PvChapterPoint[];
  resources?: ResourceItem[];
  /** BAC total proveniente de pv-edt-data.json */
  bac?: number;
  plannedValues?: PlannedValue[];
}

export function ProjectDashboard({ 
  reports, 
  edtList, 
  projectName, 
  onRefresh, 
  isSheetsConnected = false,
  pvCurveData = [],
  pvByChapter = [],
  resources = [],
  bac: bacFromProps,
  plannedValues = []
}: ProjectDashboardProps) {
  
  // Build resource cost lookup from BD_RRHH data, fall back to hardcoded defaults
  const RESOURCE_COSTS: { [id: string]: number } = { ...FALLBACK_RESOURCE_COSTS };
  resources.forEach(r => {
    if (r.unitCost) RESOURCE_COSTS[r.id] = r.unitCost;
  });
  
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports.length > 0 ? reports[reports.length - 1].id : null
  );

  const [cutoffDate, setCutoffDate] = useState<string>("");
  const [prevReportsLength, setPrevReportsLength] = useState(reports.length);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Sync state on mount/fetch or when new reports are added
  useEffect(() => {
    if (reports.length > 0) {
      if (!selectedReportId || reports.length > prevReportsLength) {
        const sorted = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastReport = sorted[sorted.length - 1];
        setSelectedReportId(lastReport.id);
        setCutoffDate(lastReport.date);
      } else if (!cutoffDate) {
        const sorted = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastReport = sorted[sorted.length - 1];
        setCutoffDate(lastReport.date);
      }
    }
    setPrevReportsLength(reports.length);
  }, [reports, pvCurveData]);

  // Parse chronological reports
  const sortedReports = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Determine the active cutoff date, falling back to today or last report date
  const defaultToday = new Date().toISOString().split('T')[0];
  let activeCutoffDate = cutoffDate || defaultToday;

  // Find the absolute range of dates available in the system (minimum/maximum of both reports and S-curve)
  let minAllowedDate = sortedReports.length > 0 ? sortedReports[0].date : "";
  let maxAllowedDate = sortedReports.length > 0 ? sortedReports[sortedReports.length - 1].date : "";

  if (pvCurveData.length > 0) {
    const pvStart = pvCurveData[0].date;
    const pvEnd = pvCurveData[pvCurveData.length - 1].date;
    
    if (!minAllowedDate || pvStart < minAllowedDate) minAllowedDate = pvStart;
    if (!maxAllowedDate || pvEnd > maxAllowedDate) maxAllowedDate = pvEnd;
  }

  // Clamp activeCutoffDate to the absolute allowed range
  if (minAllowedDate && activeCutoffDate < minAllowedDate) activeCutoffDate = minAllowedDate;
  if (maxAllowedDate && activeCutoffDate > maxAllowedDate) activeCutoffDate = maxAllowedDate;

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

  // Find the selected report to determine the "Status Date" (Fecha de Corte)
  const selectedReport = enrichedReports.find(r => r.id === selectedReportId) || enrichedReports[enrichedReports.length - 1];

  // Merge planned activities for this date (from plannedValues) and executed activities (from the report)
  const mergedActivities = (() => {
    const targetDate = activeCutoffDate;
    
    // Get planned values for this date
    const dayPlanned = (plannedValues || []).filter(pv => pv.date === targetDate && pv.plannedQty > 0);
    
    // Create map of edtCode -> activities
    const map = new Map<string, {
      edtCode: string;
      name: string;
      unit: string;
      plannedQty: number;
      qtyExecuted: number;
      notes: string;
    }>();
    
    // Populate planned values
    dayPlanned.forEach(pv => {
      const edt = edtList.find(e => e.code === pv.edtCode);
      if (edt) {
        map.set(pv.edtCode, {
          edtCode: pv.edtCode,
          name: edt.name,
          unit: edt.unit,
          plannedQty: pv.plannedQty,
          qtyExecuted: 0,
          notes: ""
        });
      }
    });
    
    // Only merge actual activities if a report actually exists FOR THIS EXACT DATE
    const reportedActs = (selectedReport && selectedReport.date === targetDate) 
      ? (selectedReport.activities || []) 
      : [];
      
    // Populate or merge executed activities from report
    reportedActs.forEach(act => {
      const existing = map.get(act.edtCode);
      if (existing) {
        existing.qtyExecuted = act.qtyExecuted;
        existing.notes = act.notes || "";
      } else {
        const edt = edtList.find(e => e.code === act.edtCode);
        map.set(act.edtCode, {
          edtCode: act.edtCode,
          name: act.name || (edt ? edt.name : ""),
          unit: act.unit || (edt ? edt.unit : ""),
          plannedQty: act.plannedQty || 0,
          qtyExecuted: act.qtyExecuted,
          notes: act.notes || ""
        });
      }
    });
    
    return Array.from(map.values());
  })();

  // 2. Generate cumulative series for the S-Curve SVG Plot
  // PV = full project baseline from PV.xlsx (177 dates)
  // EV & AC = accumulated from reports up to selected status date
  const generateChartData = () => {
    const statusDate = activeCutoffDate;
    const statusDateTime = new Date(statusDate).getTime();

    // Build cumulative EV and AC from reports
    const reportCumulatives: { date: string; dateTime: number; ev: number; ac: number }[] = [];
    let cumEv = 0;
    let cumAc = 0;
    enrichedReports.forEach(r => {
      cumEv += r.computedMetrics.earnedValue;
      cumAc += r.computedMetrics.actualCost;
      reportCumulatives.push({
        date: r.date,
        dateTime: new Date(r.date).getTime(),
        ev: cumEv,
        ac: cumAc
      });
    });

    // Use PV curve data as the base timeline (full project schedule)
    if (pvCurveData.length > 0) {
      return pvCurveData.map(p => {
        const pDateTime = new Date(p.date).getTime();
        const isBeforeOrAtStatus = pDateTime <= statusDateTime;

        // Find last known cumulative EV/AC up to this date
        let lastEv = 0;
        let lastAc = 0;
        for (const rc of reportCumulatives) {
          if (rc.dateTime <= pDateTime) {
            lastEv = rc.ev;
            lastAc = rc.ac;
          } else {
            break;
          }
        }

        return {
          date: p.date,
          pv: p.pvCumulative,
          ev: isBeforeOrAtStatus ? lastEv : undefined,
          ac: isBeforeOrAtStatus ? lastAc : undefined,
        };
      });
    }

    // Fallback: use report data only if no PV curve loaded
    let cumulativePv = 0;
    let cumulativeEv = 0;
    let cumulativeAc = 0;

    return enrichedReports.map((r, index) => {
      const metrics = r.computedMetrics;
      const reportDateTime = new Date(r.date).getTime();
      cumulativePv += metrics.plannedValue;
      const isBeforeOrAtStatusDate = reportDateTime <= statusDateTime;
      if (isBeforeOrAtStatusDate) {
        cumulativeEv += metrics.earnedValue;
        cumulativeAc += metrics.actualCost;
      }
      return {
        date: r.date,
        pv: cumulativePv,
        ev: isBeforeOrAtStatusDate ? cumulativeEv : undefined,
        ac: isBeforeOrAtStatusDate ? cumulativeAc : undefined,
      };
    });
  };

  const chartData = generateChartData();

  // Get current active cumulative values (totals at the selected status date)
  let latestPv = 0;
  let latestEv = 0;
  let latestAc = 0;

  // 1. Calculate cumulative EV and AC directly from reports up to activeCutoffDate
  let cumEv = 0;
  let cumAc = 0;
  enrichedReports.forEach(r => {
    if (r.date <= activeCutoffDate) {
      cumEv += r.computedMetrics.earnedValue;
      cumAc += r.computedMetrics.actualCost;
      latestEv = cumEv;
      latestAc = cumAc;
    }
  });

  // 2. Calculate cumulative PV up to activeCutoffDate from S-curve or fallback reports
  if (pvCurveData.length > 0) {
    let closestPoint = pvCurveData.find(p => p.date === activeCutoffDate);
    if (!closestPoint) {
      for (const p of pvCurveData) {
        if (p.date <= activeCutoffDate) {
          closestPoint = p;
        } else {
          break;
        }
      }
    }
    latestPv = closestPoint ? closestPoint.pvCumulative : 0;
  } else {
    let cumPv = 0;
    enrichedReports.forEach(r => {
      if (r.date <= activeCutoffDate) {
        cumPv += r.computedMetrics.plannedValue;
        latestPv = cumPv;
      }
    });
  }

  // BAC = Budget at Completion (total PV del proyecto)
  // Prioridad: 1) prop bac (de pv-edt-data.json), 2) último punto de pvCurveData, 3) latestPv
  const bac = bacFromProps && bacFromProps > 0
    ? bacFromProps
    : pvCurveData.length > 0
      ? pvCurveData[pvCurveData.length - 1].pvCumulative
      : latestPv;

  const latestSv = latestEv - latestPv;
  const latestCv = latestEv - latestAc;
  const latestSpi = latestPv > 0 ? latestEv / latestPv : 1;
  const latestCpi = latestAc > 0 ? latestEv / latestAc : 1;
  const pctAvance = bac > 0 ? (latestEv / bac) * 100 : 0;
  const pctPv = bac > 0 ? (latestPv / bac) * 100 : 0;
  const pctEv = bac > 0 ? (latestEv / bac) * 100 : 0;
  const pctAc = bac > 0 ? (latestAc / bac) * 100 : 0;

  // 3. Desglose EVM por capítulos EDT/WBS
  // Reglas de buenas prácticas PMI-EVM:
  //   PV capítulo = del baseline real (pv-by-chapter.json) — NUNCA de metrados de campo
  //   EV capítulo = Σ (qty_ejecutado × unitPrice) acumulado hasta fecha de corte
  //   AC capítulo = Σ (recursos consumidos × costo unitario) acumulado
  //   SPI = EV / PV       CPI = EV / AC
  //   ETC = (BAC - EV) / CPI          (proyección al ritmo actual)
  //   EAC = AC + ETC                  (estimado a la terminación)
  const generateChaptersData = () => {
    const statusDate = activeCutoffDate;
    const statusDateTime = new Date(statusDate).getTime();

    // ── Lookup: código del capítulo → PV acumulado a la fecha de corte ──
    // CLAVE: usamos ch.code (ej. "OBR-PRE") que es el mismo código en pv-by-chapter.json
    const chapterPvAtCutoff: Record<string, number> = {};
    pvByChapter.forEach(ch => {
      let closest = 0;
      for (const pt of ch.points) {
        if (new Date(pt.date).getTime() <= statusDateTime) {
          closest = pt.pvCumulative;
        } else {
          break;
        }
      }
      // Indexar por código EDT (única clave sin ambigüedad)
      chapterPvAtCutoff[ch.code] = closest;
    });

    // BAC por capítulo: total del periodo completo (desde pv-by-chapter.json)
    const chapterBac: Record<string, number> = {};
    pvByChapter.forEach(ch => {
      const lastPoint = ch.points[ch.points.length - 1];
      chapterBac[ch.code] = lastPoint ? lastPoint.pvCumulative : (ch.totalBudget || 0);
    });

    return edtList.filter(e => e.parentId === null).map(ch => {
      let chEv = 0;
      let chAc = 0;

      // Solo considerar reportes hasta la fecha de corte
      enrichedReports.forEach(r => {
        if (new Date(r.date).getTime() > statusDateTime) return;

        // EV: avances físicos ejecutados en actividades de este capítulo
        r.activities?.forEach(act => {
          const edt = edtList.find(e => e.code === act.edtCode);
          if (edt && edt.parentId === ch.code) {
            chEv += (act.qtyExecuted || 0) * edt.unitPrice;
          }
        });

        // AC: recursos consumidos asignados a este capítulo
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

      // PV: SIEMPRE desde la curva S real por capítulo (lookup por código)
      const chPv  = chapterPvAtCutoff[ch.code] ?? 0;
      const chBac = chapterBac[ch.code] ?? ch.totalBudgetQty ?? 0;

      // Indicadores EVM estándar (PMI-PMBOK)
      const chSv  = chEv - chPv;
      const chCv  = chEv - chAc;
      const chSpi = chPv  > 0 ? chEv / chPv  : (chEv > 0 ? 1.0 : 0);
      const chCpi = chAc  > 0 ? chEv / chAc  : (chEv > 0 ? 1.0 : 0);
      // ETC = (BAC - EV) / CPI   → proyección costo restante al ritmo actual
      const chEtc = chCpi > 0 ? (chBac - chEv) / chCpi : (chBac - chEv);
      // EAC = AC + ETC            → estimado total a la terminación
      const chEac = chAc + chEtc;
      // TCPI = (BAC - EV) / (BAC - AC)  → eficiencia requerida para terminar en presupuesto
      const chTcpi = (chBac - chAc) > 0 ? (chBac - chEv) / (chBac - chAc) : 0;

      return {
        code:        ch.code,
        name:        ch.name,
        bac:         chBac,
        pv:          chPv,
        ev:          chEv,
        ac:          chAc,
        sv:          chSv,
        cv:          chCv,
        spi:         chSpi,
        cpi:         chCpi,
        etc:         chEtc,
        eac:         chEac,
        tcpi:        chTcpi,
        pctPv:       chBac > 0 ? (chPv / chBac) * 100 : 0,
        pctEv:       chBac > 0 ? (chEv / chBac) * 100 : 0,
      };
    });
  };

  const chaptersData = generateChaptersData();

  // Build PV curve lookup by date (for consistent SPI calculation vs BAC baseline)
  const pvCurveByDate: Record<string, number> = {};
  pvCurveData.forEach(p => { pvCurveByDate[p.date] = p.pvCumulative; });

  // Calendar date picker: find report closest to selected date
  const handleDateChange = (dateStr: string) => {
    setCutoffDate(dateStr);
    // Find the last report on or before the selected date
    let bestReport: typeof enrichedReports[0] | null = null;
    for (const r of enrichedReports) {
      if (r.date <= dateStr) {
        bestReport = r;
      } else {
        break;
      }
    }
    if (bestReport) {
      setSelectedReportId(bestReport.id);
    }
  };

  // Navigate days with arrow buttons
  const handlePrevDay = () => {
    if (!activeCutoffDate) return;
    const dateObj = new Date(`${activeCutoffDate}T12:00:00Z`);
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
    const newDateStr = dateObj.toISOString().split("T")[0];
    
    if (minAllowedDate && newDateStr < minAllowedDate) return;
    
    handleDateChange(newDateStr);
  };
  const handleNextDay = () => {
    if (!activeCutoffDate) return;
    const dateObj = new Date(`${activeCutoffDate}T12:00:00Z`);
    dateObj.setUTCDate(dateObj.getUTCDate() + 1);
    const newDateStr = dateObj.toISOString().split("T")[0];
    
    if (maxAllowedDate && newDateStr > maxAllowedDate) return;
    
    handleDateChange(newDateStr);
  };

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

    const width = 1000;
    const height = 400;
    const paddingLeft = 70;
    const paddingRight = 30;
    const paddingTop = 40;
    const paddingBottom = 40;

    const allValues = chartData.flatMap(d => [d.pv, d.ev !== undefined ? d.ev : 0, d.ac !== undefined ? d.ac : 0]);
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

      if (i === 0) {
        pvPath = `M ${x} ${yPv}`;
      } else {
        pvPath += ` L ${x} ${yPv}`;
      }

      if (d.ev !== undefined) {
        const yEv = getY(d.ev);
        if (evPath === "") evPath = `M ${x} ${yEv}`;
        else evPath += ` L ${x} ${yEv}`;
      }

      if (d.ac !== undefined) {
        const yAc = getY(d.ac);
        if (acPath === "") acPath = `M ${x} ${yAc}`;
        else acPath += ` L ${x} ${yAc}`;
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
          const isFirstOrLast = i === 0 || i === chartData.length - 1;
          const step = chartData.length > 60 ? 15 : (chartData.length > 30 ? 7 : 3);
          if (!isFirstOrLast && i % step !== 0) return null;
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

        {/* Cutoff date vertical line */}
        {(() => {
          const statusIdx = chartData.findIndex(d => d.date === activeCutoffDate);
          if (statusIdx >= 0) {
            const x = getX(statusIdx);
            return (
              <g>
                <line x1={x} y1={paddingTop} x2={x} y2={height - paddingBottom} stroke="#fbbf24" strokeWidth={2} strokeDasharray="6,3" opacity="0.7" />
                <text x={x} y={paddingTop - 5} className="text-[8px] font-bold fill-amber-400" textAnchor="middle">
                  CORTE
                </text>
              </g>
            );
          }
          return null;
        })()}

        {/* Curves paths */}
        <path d={pvPath} fill="none" stroke="#6366f1" strokeWidth={3.5} /> 
        {evPath && <path d={evPath} fill="none" stroke="#10b981" strokeWidth={3.5} />} 
        {acPath && <path d={acPath} fill="none" stroke="#f43f5e" strokeWidth={3.5} />} 

        {/* Dot Markers for current points */}
        {chartData.map((d, i) => {
          const x = getX(i);
          return (
            <g key={i} className="cursor-pointer group">
              {chartData.length > 50 && i % 5 !== 0 && i !== chartData.length - 1 ? null : (
                <circle cx={x} cy={getY(d.pv)} r={3} className="fill-indigo-500 stroke-slate-900 stroke-2 hover:r-5 transition-all" />
              )}
              {d.ev !== undefined && (
                <circle cx={x} cy={getY(d.ev)} r={3} className="fill-emerald-500 stroke-slate-900 stroke-2 hover:r-5 transition-all" />
              )}
              {d.ac !== undefined && (
                <circle cx={x} cy={getY(d.ac)} r={3} className="fill-rose-500 stroke-slate-900 stroke-2 hover:r-5 transition-all" />
              )}
            </g>
          );
        })}
      </svg>
    );
  };

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

        {/* Calendar + Live sync actions */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Calendar date picker */}
          {activeCutoffDate && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
              <button
                onClick={handlePrevDay}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Día anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <CalendarDays className="w-4 h-4 text-sky-400 shrink-0" />
                <input
                  type="date"
                  value={activeCutoffDate}
                  onChange={e => handleDateChange(e.target.value)}
                  min={minAllowedDate || undefined}
                  max={maxAllowedDate || undefined}
                  className="bg-transparent text-xs font-mono font-bold text-white border-none outline-none appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 w-[130px]"
                />
              </div>
              <button
                onClick={handleNextDay}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Día siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-[repeat(9,1fr)] gap-3">
        <div className="bg-sky-950/30 border border-sky-800 p-3 rounded-xl">
          <span className="text-[9px] text-sky-400 block font-bold uppercase tracking-wider">Presupuesto BAC</span>
          <span className="text-base font-black font-mono text-sky-300 block mt-1">${bac.toLocaleString()}</span>
          <span className="text-[8px] text-slate-500 block mt-0.5">Suma capítulos (col. I)</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl">
          <span className="text-[9px] text-slate-450 block font-bold uppercase tracking-wider">Valor Planificado</span>
          <span className="text-base font-black font-mono text-indigo-400 block mt-1">${latestPv.toLocaleString()}</span>
          <span className="text-[8px] text-slate-500 block mt-0.5">Avance programado</span>
        </div>

        <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl">
          <span className="text-[9px] text-slate-450 block font-bold uppercase tracking-wider">Valor Ganado</span>
          <span className="text-base font-black font-mono text-emerald-400 block mt-1">${latestEv.toLocaleString()}</span>
          <span className="text-[8px] text-slate-500 block mt-0.5">${pctEv.toFixed(1)}% ejecutado</span>
        </div>

        <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl">
          <span className="text-[9px] text-slate-450 block font-bold uppercase tracking-wider">Costo Real</span>
          <span className="text-base font-black font-mono text-rose-400 block mt-1">${latestAc.toLocaleString()}</span>
          <span className="text-[8px] text-slate-500 block mt-0.5">${pctAc.toFixed(1)}% del PV</span>
        </div>

        <div className={`p-3 rounded-xl border ${
          latestSv >= 0 
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/5 border-rose-500/20 text-rose-400"
        }`}>
          <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Varianza SV</span>
          <span className="text-base font-black font-mono block mt-1">
            {latestSv >= 0 ? `+$${latestSv.toLocaleString()}` : `-$${Math.abs(latestSv).toLocaleString()}`}
          </span>
          <span className="text-[8px] block mt-0.5 font-semibold">
            {latestSv >= 0 ? "Adelanto" : "Atraso"}
          </span>
        </div>

        <div className={`p-3 rounded-xl border ${
          latestCv >= 0 
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/5 border-rose-500/20 text-rose-400"
        }`}>
          <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Varianza CV</span>
          <span className="text-base font-black font-mono block mt-1">
            {latestCv >= 0 ? `+$${latestCv.toLocaleString()}` : `-$${Math.abs(latestCv).toLocaleString()}`}
          </span>
          <span className="text-[8px] block mt-0.5 font-semibold">
            {latestCv >= 0 ? "Ahorro" : "Pérdida"}
          </span>
        </div>

        <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl">
          <span className="text-[9px] text-slate-450 block font-bold uppercase tracking-wider">% Avance</span>
          <span className="text-base font-black font-mono text-white block mt-1">{pctAvance.toFixed(1)}%</span>
          <span className="text-[8px] text-slate-500 block mt-0.5">EV / BAC × 100</span>
        </div>

        <div className={`p-3 rounded-xl border ${
          latestSpi >= 1 
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/5 border-rose-500/20 text-rose-400"
        }`}>
          <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">SPI</span>
          <span className="text-base font-black font-mono block mt-1">{latestSpi.toFixed(2)}</span>
          <span className="text-[8px] block mt-0.5 font-semibold">
            {latestSpi >= 1 ? "Adelantado" : "Retrasado"}
          </span>
        </div>

        <div className={`p-3 rounded-xl border ${
          latestCpi >= 1 
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/5 border-rose-500/20 text-rose-400"
        }`}>
          <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">CPI</span>
          <span className="text-base font-black font-mono block mt-1">{latestCpi.toFixed(2)}</span>
          <span className="text-[8px] block mt-0.5 font-semibold">
            {latestCpi >= 1 ? "Ahorro" : "Sobrecosto"}
          </span>
        </div>
      </div>

      {/* 3. CORE CHARTS & HISTORY GRID (PC LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: LARGE S-CURVE GRAPH (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-4 gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2 uppercase tracking-wider">
              <TrendingUp className="w-5 h-5 text-sky-400" />
              Curva S de Rendimiento EVM
            </h2>
            <span className="text-[10px] font-mono text-slate-500 mt-1 block">
              Fecha de corte: <span className="text-sky-400 font-bold">{activeCutoffDate || '—'}</span> | 
              PV: proyecto completo ({pvCurveData.length} días) | 
              EV/AC: acumulado hasta la fecha
            </span>
            
            <div className="flex flex-wrap gap-3 text-xxs font-extrabold tracking-wider">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-indigo-500 inline-block rounded-full"></span> PV (LÍNEA BASE)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-emerald-500 inline-block rounded-full"></span> EV (VALOR GANADO)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-rose-500 inline-block rounded-full"></span> AC (COSTO REAL)</span>
            </div>
          </div>

          <div className="flex-1 min-h-[380px] bg-slate-900/40 rounded-xl p-3 border border-slate-850 flex items-center justify-center relative">
            {chartData.length > 0 ? (
              renderSvgChart()
            ) : (
              <div className="text-xs text-slate-500 italic flex flex-col items-center gap-2">
                <BarChart3 className="w-8 h-8 text-slate-700 animate-pulse" />
                No hay datos suficientes para graficar la curva S de obra. Genera reportes o datos sintéticos.
              </div>
            )}
          </div>

          {/* Progress bars: % Avance de PV, EV, AC contra BAC */}
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800">
              <div className="flex justify-between text-[10px] font-bold mb-1">
                <span className="text-indigo-400">PV</span>
                <span className="text-slate-400">{pctPv.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(pctPv, 100)}%` }} />
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800">
              <div className="flex justify-between text-[10px] font-bold mb-1">
                <span className="text-emerald-400">EV</span>
                <span className="text-slate-400">{pctEv.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(pctEv, 100)}%` }} />
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800">
              <div className="flex justify-between text-[10px] font-bold mb-1">
                <span className="text-rose-400">AC</span>
                <span className="text-slate-400">{pctAc.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(pctAc, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RDO CHRONOLOGICAL HISTORY LIST (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col">
          <h2 className="text-base font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-4 mb-4">
            Historial Cronológico de RDOs
          </h2>
          
          <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-2.5 scrollbar-thin">
            {(() => {
              // Pre-compute cumulative SPI per report using REAL PV curve (consistente con el header)
              let cumEv = 0;
              const reportCumulativeSpi = enrichedReports.map(r => {
                cumEv += r.computedMetrics.earnedValue;
                const realPvAtDate = pvCurveByDate[r.date] || cumEv;
                return realPvAtDate > 0 ? cumEv / realPvAtDate : 1;
              });
              return enrichedReports.map((r, index) => {
              const isSelected = r.id === selectedReportId;
              const metrics = r.computedMetrics;
              const hasProduction = metrics.plannedValue > 0 || metrics.earnedValue > 0 || metrics.actualCost > 0;
              const cumSpi = reportCumulativeSpi[index];
              
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedReportId(r.id);
                    setCutoffDate(r.date);
                  }}
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
                        cumSpi >= 1 
                          ? (isSelected ? 'bg-emerald-250 text-emerald-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/35') 
                          : (isSelected ? 'bg-rose-250 text-rose-800' : 'bg-rose-950 text-rose-400 border border-rose-800/35')
                      }`}>
                        SPI: {cumSpi.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400 border border-slate-700/50">
                        HSE SOLO
                      </span>
                    )}
                  </div>
                </button>
              );
              });
            })()}

            {reports.length === 0 && (
              <p className="text-xs italic text-slate-550 text-center py-20">No se encontraron reportes cargados en la base de datos.</p>
            )}
          </div>
        </div>

      </div>

      {/* 4. EDT CHAPTERS ANALYTICAL CONTROL BREAKDOWN TABLE */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-4 gap-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <Table className="w-5 h-5 text-sky-400" />
            Control Analítico de Valor Ganado por Capítulos EDT (WBS)
          </h2>
          {/* Alerta de coherencia: ΣPV capítulos vs PV integral */}
          {(() => {
            const sumPv = chaptersData.reduce((s, c) => s + c.pv, 0);
            const diff  = Math.abs(sumPv - latestPv);
            const pct   = latestPv > 0 ? (diff / latestPv) * 100 : 0;
            if (pvByChapter.length > 0 && pct > 0.5) {
              return (
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Σ PV capítulos difiere {pct.toFixed(1)}% del PV integral — revisa el Excel
                </span>
              );
            }
            return null;
          })()}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-350 border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                <th className="p-3">Código</th>
                <th className="p-3">Capítulo EDT</th>
                <th className="p-3 text-right">PV (Fecha Corte)</th>
                <th className="p-3 text-right">EV (Ganado)</th>
                <th className="p-3 text-right">AC (Real)</th>
                <th className="p-3 text-right">SV</th>
                <th className="p-3 text-right">CV</th>
                <th className="p-3 text-right">SPI</th>
                <th className="p-3 text-right">CPI</th>
                <th className="p-3 text-right">EAC</th>
                <th className="p-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {chaptersData.map((ch, idx) => {
                return (
                  <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-sky-400">{ch.code}</td>
                    <td className="p-3 font-bold text-slate-100">
                      <div>{ch.name}</div>
                      <div className="text-[10px] text-sky-500 font-mono mt-1 font-semibold">
                        BAC: S/ {ch.bac.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        {ch.pctPv > 0 && <span className="ml-2 text-indigo-400">PV: {ch.pctPv.toFixed(1)}%</span>}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">
                      S/ {ch.pv.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-400">
                      S/ {ch.ev.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-rose-400">
                      S/ {ch.ac.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </td>
                    
                    <td className={`p-3 text-right font-mono font-bold ${ch.sv >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {ch.sv >= 0 ? `+S/ ${ch.sv.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : `-S/ ${Math.abs(ch.sv).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}
                    </td>
                    
                    <td className={`p-3 text-right font-mono font-bold ${ch.cv >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {ch.cv >= 0 ? `+S/ ${ch.cv.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : `-S/ ${Math.abs(ch.cv).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}
                    </td>
                    
                    <td className={`p-3 text-right font-mono font-extrabold ${ch.spi >= 0.95 ? "text-emerald-400" : ch.spi >= 0.85 ? "text-amber-400" : "text-rose-400"}`}>
                      {ch.spi.toFixed(3)}
                    </td>
                    
                    <td className={`p-3 text-right font-mono font-extrabold ${ch.cpi >= 0.95 ? "text-emerald-400" : ch.cpi >= 0.85 ? "text-amber-400" : "text-rose-400"}`}>
                      {ch.cpi.toFixed(3)}
                    </td>

                    <td className="p-3 text-right font-mono text-slate-300">
                      S/ {ch.eac.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                      {ch.eac > ch.bac && ch.bac > 0 && (
                        <span className="text-rose-400 text-[8px] ml-1">▲ sobrecosto</span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      {ch.pv === 0 ? (
                        <span className="bg-slate-800 text-slate-400 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
                          Sin iniciar
                        </span>
                      ) : ch.spi >= 0.95 && ch.cpi >= 0.95 ? (
                        <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          Saludable
                        </span>
                      ) : ch.spi >= 0.85 || ch.cpi >= 0.85 ? (
                        <span className="bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-500/20">
                          Alerta
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
            {/* Fila de totales — debe coincidir con los indicadores integrales del header */}
            <tfoot>
              <tr className="bg-slate-900/80 border-t-2 border-slate-700 text-[10px] font-extrabold text-slate-200">
                <td className="p-3 font-mono text-sky-300" colSpan={2}>
                  <div>TOTAL PROYECTO</div>
                  <div className="text-[9px] text-sky-500 font-semibold mt-0.5">
                    BAC: S/ {chaptersData.reduce((s, c) => s + c.bac, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                  </div>
                </td>
                <td className="p-3 text-right font-mono text-slate-400">
                  S/ {chaptersData.reduce((s, c) => s + c.pv, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-right font-mono text-emerald-400">
                  S/ {chaptersData.reduce((s, c) => s + c.ev, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-right font-mono text-rose-400">
                  S/ {chaptersData.reduce((s, c) => s + c.ac, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                </td>
                <td className={`p-3 text-right font-mono ${latestSv >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {latestSv >= 0 ? `+S/ ${latestSv.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : `-S/ ${Math.abs(latestSv).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}
                </td>
                <td className={`p-3 text-right font-mono ${latestCv >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {latestCv >= 0 ? `+S/ ${latestCv.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : `-S/ ${Math.abs(latestCv).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}
                </td>
                <td className={`p-3 text-right font-mono ${latestSpi >= 0.95 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {latestSpi.toFixed(3)}
                </td>
                <td className={`p-3 text-right font-mono ${latestCpi >= 0.95 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {latestCpi.toFixed(3)}
                </td>
                <td className="p-3 text-right font-mono text-slate-300">
                  S/ {chaptersData.reduce((s, c) => s + c.eac, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-center">
                  <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    latestSpi >= 0.95 && latestCpi >= 0.95
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {latestSpi >= 0.95 && latestCpi >= 0.95 ? 'Proyecto Saludable' : 'Proyecto Desviado'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 5. SELECTED REPORT DETAILED FIELD LOG NOTEBOOK */}
      {selectedReport && (
        <div id="selected-report-workspace" className="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden grid grid-cols-1 xl:grid-cols-12">
          
          {/* Work report summary columns & details (full width) */}
          <div className="p-6 xl:col-span-12 space-y-6">
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

            {/* PV / EV / AC summary bar */}
            {(() => {
              const m = selectedReport.computedMetrics;
              const pvData = pvCurveData.find(p => p.date === selectedReport.date);
              const pvDaily = pvData ? pvData.pvDaily : 0;
              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-indigo-950/30 border border-indigo-800/40 p-3 rounded-xl text-center">
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">PV (Plan)</span>
                    <span className="text-base font-black font-mono text-indigo-300 block mt-1">
                      S/ {pvDaily.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[8px] text-slate-500 block mt-0.5">Actividades planeadas</span>
                  </div>
                  <div className="bg-emerald-950/30 border border-emerald-800/40 p-3 rounded-xl text-center">
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">EV (Ganado)</span>
                    <span className="text-base font-black font-mono text-emerald-300 block mt-1">
                      S/ {(m?.earnedValue || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[8px] text-slate-500 block mt-0.5">Actividades ejecutadas</span>
                  </div>
                  <div className="bg-rose-950/30 border border-rose-800/40 p-3 rounded-xl text-center">
                    <span className="text-[9px] text-rose-400 font-bold uppercase tracking-wider block">AC (Real)</span>
                    <span className="text-base font-black font-mono text-rose-300 block mt-1">
                      S/ {(m?.actualCost || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[8px] text-slate-500 block mt-0.5">Recursos consumidos</span>
                  </div>
                </div>
              );
            })()}

            {/* Activities Table */}
            {mergedActivities && mergedActivities.length > 0 ? (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">1. Avance Físico Registrado (Earned Value):</span>
                <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/30">
                  <table className="w-full text-left text-xs text-slate-350 border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                        <th className="p-3">Código EDT</th>
                        <th className="p-3">Actividad de Partida</th>
                        <th className="p-3 text-right">Und</th>
                        <th className="p-3 text-right">Meta</th>
                        <th className="p-3 text-right">Ejec.</th>
                        <th className="p-3 text-right">P.U. (S/)</th>
                        <th className="p-3 text-right">PV (S/)</th>
                        <th className="p-3 text-right">EV (S/)</th>
                        <th className="p-3">Detalle / Notas de Campo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {mergedActivities.map((act, index) => {
                        const edt = edtList.find(e => e.code === act.edtCode);
                        const pu = edt?.unitPrice || 0;
                        const pv = (act.plannedQty || 0) * pu;
                        const ev = (act.qtyExecuted || 0) * pu;
                        return (
                          <tr key={index} className="hover:bg-slate-900/20">
                            <td className="p-3 font-mono font-bold text-sky-400">{act.edtCode}</td>
                            <td className="p-3 font-bold text-slate-200">
                              {act.name || "Actividad del RDO"}
                              {act.plannedQty > 0 && act.qtyExecuted === 0 && (
                                <span className="ml-2 bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-indigo-500/20">Solo Programado</span>
                              )}
                              {act.plannedQty === 0 && act.qtyExecuted > 0 && (
                                <span className="ml-2 bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-500/20">No Planificado</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-500">{act.unit || "-"}</td>
                            <td className="p-3 text-right font-mono text-slate-400">{act.plannedQty || 0}</td>
                            <td className={`p-3 text-right font-mono font-extrabold ${act.qtyExecuted > 0 ? "text-emerald-400" : "text-slate-500"}`}>{act.qtyExecuted}</td>
                            <td className="p-3 text-right font-mono text-slate-400">S/ {pu}</td>
                            <td className="p-3 text-right font-mono text-indigo-400">
                              S/ {pv.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-400">
                              S/ {ev.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 italic text-slate-450 text-[11px]">{act.notes || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900/60 text-[10px] font-extrabold">
                        <td colSpan={3} className="p-3 text-right text-slate-300">TOTALES</td>
                        <td className="p-3 text-right font-mono text-slate-400">
                          {mergedActivities.reduce((s, a) => s + (a.plannedQty || 0), 0)}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-400">
                          {mergedActivities.reduce((s, a) => s + (a.qtyExecuted || 0), 0)}
                        </td>
                        <td></td>
                        <td className="p-3 text-right font-mono text-indigo-300">
                          S/ {mergedActivities.reduce((s, a) => {
                            const e = edtList.find(e => e.code === a.edtCode);
                            return s + ((a.plannedQty || 0) * (e?.unitPrice || 0));
                          }, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-300">
                          S/ {mergedActivities.reduce((s, a) => {
                            const e = edtList.find(e => e.code === a.edtCode);
                            return s + ((a.qtyExecuted || 0) * (e?.unitPrice || 0));
                          }, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
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
                    <table className="w-full text-[11px] text-slate-350 border-collapse">
                      <thead>
                        <tr className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-800">
                          <th className="p-1 text-left">Recurso</th>
                          <th className="p-1 text-right">Horas</th>
                          <th className="p-1 text-right">S/ /h</th>
                          <th className="p-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReport.manoObra.map((mo, i) => {
                          const costH = RESOURCE_COSTS[mo.resourceId] || 20;
                          const total = (mo.hoursWorked || 0) * costH;
                          return (
                            <tr key={i} className="border-b border-slate-850">
                              <td className="p-1">{mo.name || mo.resourceId}</td>
                              <td className="p-1 text-right font-mono">{mo.hoursWorked}</td>
                              <td className="p-1 text-right font-mono">{costH}</td>
                              <td className="p-1 text-right font-mono text-rose-400">
                                S/ {total.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="text-[10px] font-extrabold text-rose-300">
                          <td colSpan={3} className="p-1 text-right">Subtotal MO</td>
                          <td className="p-1 text-right">
                            S/ {selectedReport.manoObra.reduce((s, mo) => {
                              const costH = RESOURCE_COSTS[mo.resourceId] || 20;
                              return s + ((mo.hoursWorked || 0) * costH);
                            }, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Materials logs */}
                  <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2">
                    <span className="text-[10px] text-emerald-400 block font-black uppercase tracking-wider">Materiales</span>
                    {selectedReport.materials && selectedReport.materials.length > 0 ? (
                      <table className="w-full text-[11px] text-slate-350 border-collapse">
                        <thead>
                          <tr className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-800">
                            <th className="p-1 text-left">Recurso</th>
                            <th className="p-1 text-right">Cant</th>
                            <th className="p-1 text-right">S/ /und</th>
                            <th className="p-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReport.materials.map((mat, i) => {
                            const costU = RESOURCE_COSTS[mat.resourceId] || 10;
                            const total = (mat.qtyConsumed || 0) * costU;
                            return (
                              <tr key={i} className="border-b border-slate-850">
                                <td className="p-1">{mat.name || mat.resourceId}</td>
                                <td className="p-1 text-right font-mono">{mat.qtyConsumed} {mat.unit}</td>
                                <td className="p-1 text-right font-mono">S/ {costU}</td>
                                <td className="p-1 text-right font-mono text-rose-400">
                                  S/ {total.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="text-[10px] font-extrabold text-rose-300">
                            <td colSpan={3} className="p-1 text-right">Subtotal Mat.</td>
                            <td className="p-1 text-right">
                              S/ {selectedReport.materials.reduce((s, mat) => {
                                const costU = RESOURCE_COSTS[mat.resourceId] || 10;
                                return s + ((mat.qtyConsumed || 0) * costU);
                              }, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <span className="text-[10px] italic text-slate-550 block">Sin consumos de materiales.</span>
                    )}
                  </div>

                  {/* Equipment logs */}
                  <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-2">
                    <span className="text-[10px] text-rose-400 block font-black uppercase tracking-wider">Equipos & Maquinaria</span>
                    {selectedReport.equipos && selectedReport.equipos.length > 0 ? (
                      <table className="w-full text-[11px] text-slate-350 border-collapse">
                        <thead>
                          <tr className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-800">
                            <th className="p-1 text-left">Recurso</th>
                            <th className="p-1 text-right">Cant</th>
                            <th className="p-1 text-right">S/ /und</th>
                            <th className="p-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReport.equipos.map((eq, i) => {
                            const costU = RESOURCE_COSTS[eq.resourceId] || 30;
                            const total = (eq.qtyUsed || 0) * costU;
                            return (
                              <tr key={i} className="border-b border-slate-850">
                                <td className="p-1">{eq.name || eq.resourceId}</td>
                                <td className="p-1 text-right font-mono">{eq.qtyUsed} {eq.unit || "H-M"}</td>
                                <td className="p-1 text-right font-mono">S/ {costU}</td>
                                <td className="p-1 text-right font-mono text-rose-400">
                                  S/ {total.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="text-[10px] font-extrabold text-rose-300">
                            <td colSpan={3} className="p-1 text-right">Subtotal Eq.</td>
                            <td className="p-1 text-right">
                              S/ {selectedReport.equipos.reduce((s, eq) => {
                                const costU = RESOURCE_COSTS[eq.resourceId] || 30;
                                return s + ((eq.qtyUsed || 0) * costU);
                              }, 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <span className="text-[10px] italic text-slate-550 block">Sin equipos registrados.</span>
                    )}
                  </div>
                </div>

                {/* Total AC summary */}
                {(() => {
                  const totalMo = selectedReport.manoObra.reduce((s, mo) => {
                    return s + ((mo.hoursWorked || 0) * (RESOURCE_COSTS[mo.resourceId] || 20));
                  }, 0);
                  const totalMat = (selectedReport.materials || []).reduce((s, mat) => {
                    return s + ((mat.qtyConsumed || 0) * (RESOURCE_COSTS[mat.resourceId] || 10));
                  }, 0);
                  const totalEq = (selectedReport.equipos || []).reduce((s, eq) => {
                    return s + ((eq.qtyUsed || 0) * (RESOURCE_COSTS[eq.resourceId] || 30));
                  }, 0);
                  const totalAc = totalMo + totalMat + totalEq;
                  return (
                    <div className="text-right text-xs font-extrabold text-rose-300 border-t border-slate-700 pt-2 mt-2">
                      TOTAL AC: S/ {totalAc.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </div>
                  );
                })()}
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

        </div>
      )}

    </div>
  );
}
