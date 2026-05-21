/**
 * Definición de tipos y estructuras para el Reporte Diario de Obra (RDO)
 */

export interface Project {
  id: string;
  name: string;
  code: string;
  location: string;
  manager: string;
}

export interface EdtItem {
  code: string; // e.g. "EST-01"
  parentId: string | null; // e.g. null for capítulos, or "EST"
  name: string;
  unit: string; // m3, m2, kg, bolsa, etc.
  totalBudgetQty: number; // Cantidad total contratada
  unitPrice: number; // Costo unitario planificado
}

export interface PlannedValue {
  date: string; // YYYY-MM-DD
  edtCode: string;
  plannedQty: number; // Cantidad planificada para ese día
}

export interface PvCurvePoint {
  date: string;
  pvDaily: number;
  pvCumulative: number;
}

export interface ResourceItem {
  id: string;
  name: string;
  type: 'mano_obra' | 'material' | 'equipo';
  unit: string;
  unitCost: number;
}

// Estructura del Reporte Diario enviado
export interface DailyReport {
  id: string;
  projectCode: string;
  reportType?: 'produccion' | 'seguridad';
  edtChapter?: string;
  date: string;
  shift: 'Mañana' | 'Tarde' | 'Noche' | 'Continuo';
  effectiveHours: number;
  supervisor: string;
  weatherMorning: 'Soleado' | 'Nublado' | 'Lluvia' | 'Viento';
  weatherAfternoon: 'Soleado' | 'Nublado' | 'Lluvia' | 'Viento';
  
  // Actividades Ejecutadas (Earned Value)
  activities: {
    edtCode: string;
    qtyExecuted: number;
    notes: string;
    plannedQty?: number;
    name?: string;
    unit?: string;
  }[];

  // Recursos Utilizados (Actual Cost)
  manoObra: {
    resourceId: string; // de BD_RRHH o ResourceItem
    quantity?: number;
    hoursWorked: number;
    edtGroupCode: string; // Capítulo Nivel 1 asociado (e.g. "EST")
    name?: string;
  }[];

  materials: {
    resourceId: string;
    qtyConsumed: number;
    edtGroupCode: string; // Capítulo Nivel 1 asociado
    name?: string;
    unit?: string;
  }[];

  equipos: {
    resourceId: string;
    qtyUsed: number; // horas o días
    edtGroupCode: string; // Capítulo Nivel 1 asociado
    name?: string;
    unit?: string;
  }[];

  // Control, Seguridad e Incidentes
  totalStaff: number;
  safetyInspected: boolean;
  safetyDetails: string;
  incidents: string;

  // Problemas y Planificación
  conflicts: string;
  plannedNextDay: string;
  generalNotes: string;

  // Entregables
  signatureBase64?: string;
  photoBase64s?: string[];
  createdAt: string;
  metrics?: EvmMetrics;
  photoUrlsLocal?: string[];
  signatureUrlLocal?: string;
}

// Métricas de EVM calculadas para un reporte
export interface EvmMetrics {
  reportId: string;
  date: string;
  plannedValue: number; // PV = Sum(QtyPlanned * UnitPrice)
  earnedValue: number;  // EV = Sum(QtyExecuted * UnitPrice)
  actualCost: number;   // AC = Sum(Hours*Rate) + Sum(Qty*MatPrice) + Sum(Qty*EquipPrice)
  sv: number;           // Schedule Variance = EV - PV
  cv: number;           // Cost Variance = EV - AC
  spi: number;          // Schedule Performance Index = EV / PV
  cpi: number;          // Cost Performance Index = EV / AC
}
