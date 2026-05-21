# Data Flow — Reporte Diario de Obra (RDO)

## Índice

1. [Estructura de Datos](#1-estructura-de-datos)
2. [Pipeline: Archivos → Google Sheets → Dashboard](#2-pipeline)
3. [Cálculo de PV, EV, AC](#3-cálculo)
4. [Fallback Chain](#4-fallback-chain)
5. [Flujo Completo (Diagrama)](#5-flujo-completo)

---

## 1. Estructura de Datos

### 1.1 Interfaces principales (`src/types.ts`)

```
DailyReport {
  id, projectCode, date, shift, supervisor, effectiveHours,
  weatherMorning, weatherAfternoon,
  activities:     [{ edtCode, name, unit, plannedQty, qtyExecuted, notes }]
  manoObra:       [{ resourceId, name, hoursWorked, edtGroupCode }]
  materials:      [{ resourceId, name, qtyConsumed, unit, edtGroupCode }]
  equipos:        [{ resourceId, name, qtyUsed, unit, edtGroupCode }]
  totalStaff, safetyInspected, safetyDetails, incidents,
  conflicts, plannedNextDay, generalNotes, metrics?: EvmMetrics
}

EdtItem { code, parentId, name, unit, totalBudgetQty, unitPrice }

ResourceItem { id, name, type: "mano_obra"|"material"|"equipo", unit, unitCost }

PvCurvePoint { date, pvDaily, pvCumulative }

PvChapterPoint { code, name, totalBudget, points: [{ date, pvCumulative }] }
```

### 1.2 Archivos JSON en `data/` y `public/data/`

| Archivo | Contenido | Fuente |
|---|---|---|
| `project.json` | Metadatos del proyecto (nombre, código, ubicación, monto) | Excel del proyecto |
| `pv-edt-data.json` | EDT completo + valores planificados diarios + BAC total | BD_EDT.xlsx + BD_Metrados.xlsx |
| `pv-curve.json` | Curva S del proyecto: `[{ date, pvDaily, pvCumulative }]` | Agregación de PV diario |
| `pv-by-chapter.json` | PV acumulado por cada capítulo EDT (5 códigos, 90 días c/u) | Desglose por capítulo |
| `resources.json` | Catálogo de recursos: MO, materiales, equipos con costos | BD_RRHH.xlsx |

### 1.3 Los 5 Capítulos EDT (WBS)

| Código | Nombre | Presupuesto (S/) |
|---|---|---|
| OBR-PRE | Obras Preliminares y Provisionales | 45,000 |
| MOV-TIE | Movimiento de Tierras | 92,250 |
| EST-CON | Estructuras de Concreto | 321,350 |
| ARQ-ACAB | Arquitectura y Acabados | 313,200 |
| INS-SAN | Instalaciones Sanitarias y Eléctricas | 81,590 |
| **TOTAL BAC** | | **853,390** |

---

## 2. Pipeline

```
  Excel (BD_*)          JSON estáticos           Express Server            Google Sheets            Dashboard
  ───────────          ──────────────           ──────────────            ─────────────            ─────────
  BD_EDT.xlsx   ──►  data/pv-edt-data.json  ──►  /api/master-data        R_Produccion             Tabla Capítulos
  BD_Metrados.xlsx ─► data/pv-curve.json    ──►  /api/pv-curve           R_Seguridad              Curva S
  BD_PV_Diario.xlsx ─► data/pv-by-chapter   ──►  /api/pv-chapter         Detalle_Actividades      Cuaderno de Obra
  BD_RRHH.xlsx    ──►  data/resources.json   ──►  /api/resources          Detalle_Recursos         Métricas EVM
  Project meta    ──►  data/project.json     ──►  /api/projects
                       public/data/ (copia)        (tsx server.ts)
                                                    │
                                                    ├── /api/reports (GET)  ←── Reportes locales
                                                    └── /api/reports (POST) ──► Google Sheets via doPost

  Apps Script (generarBaseSintetica.gs)
    ──► Crea 4 hojas con 30 días de datos sintéticos
    ──► doGet: lee las 4 hojas y devuelve DailyReport[]
    ──► doPost: recibe POST y escribe en las 4 hojas
```

### 2.1 Google Sheets — 4 Tablas

#### R_Produccion (cabeceras de producción)

| # | Columna | Descripción |
|---|---|---|
| 0 | ID Reporte | `REP-20260601-001` |
| 1 | Fecha Envío | ISO timestamp |
| 2 | Fecha Reporte | `2026-06-01` |
| 3 | Supervisor/Ingeniero | Nombre |
| 4 | Turno | Mañana / Tarde / Noche / Continuo |
| 5 | Clima Mañana | Soleado / Nublado / Lluvia / Viento |
| 6 | Clima Tarde | Soleado / Nublado / Lluvia / Viento |
| 7 | Horas Efectivas | Horas trabajadas |
| 8 | Capítulo WBS ID | Código del capítulo (OBR-PRE, etc.) |
| 9 | Capítulo WBS Nombre | Nombre del capítulo |
| 10 | Conflictos/Restricciones | Texto |
| 11 | Trabajos Mañana | Plan del día siguiente |
| 12 | Observaciones Generales | Notas |

#### R_Seguridad (cabeceras de seguridad)

| # | Columna | Descripción |
|---|---|---|
| 0 | ID Reporte | `REP-SYN-S-001` |
| 1 | Fecha Envío | ISO timestamp |
| 2 | Fecha Reporte | `2026-06-01` |
| 3 | Supervisor | Nombre |
| 4 | Turno | Mañana / Tarde / Noche / Continuo |
| 5 | Clima Mañana | Temperatura |
| 6 | Clima Tarde | Temperatura |
| 7 | Personal Total en Obra | Número de personas |
| 8 | Inspecciones Realizadas | "SÍ" / "NO" |
| 9 | Detalle Inspecciones | Texto |
| 10 | Accidentes/Incidentes | Texto |
| 11 | Observaciones Generales | Texto |

#### Detalle_Actividades (actividades del día)

| # | Columna | Descripción |
|---|---|---|
| 0 | ID Reporte | FK → R_Produccion.ID |
| 1 | Fecha Reporte | Fecha |
| 2 | Supervisor | Nombre |
| 3 | Capítulo WBS ID | Código del capítulo |
| 4 | Actividad WBS ID | Código de actividad (OBR-PRE-01) |
| 5 | Nombre Actividad | Descripción |
| 6 | Unidad | m², m³, kg, und, etc. |
| 7 | Meta del Día | Cantidad planificada |
| 8 | Cantidad Ejecutada | Cantidad ejecutada |
| 9 | Avance Estimado | (no usado) |
| 10 | Observación/Comentario | Notas |

#### Detalle_Recursos (recursos consumidos)

| # | Columna | Descripción |
|---|---|---|
| 0 | ID Reporte | FK → R_Produccion.ID |
| 1 | Fecha Reporte | Fecha |
| 2 | Supervisor | Nombre |
| 3 | Tipo Recurso | `mano_obra` / `material` / `equipo` |
| 4 | Capítulo WBS ID | Código del capítulo |
| 5 | ID Recurso | Código del recurso (LH-CAP, MAT-CEM, EQ-MEZ) |
| 6 | Descripción Recurso | Nombre del recurso |
| 7 | Categoría/Detalle | "Horas Trabajadas" / "Consumo Material" / "Uso de Equipo" |
| 8 | Unidad | H-H, Bolsa, H-M, etc. |
| 9 | Cantidad Registrada | Cantidad consumida |

### 2.2 Scripts de generación sintética

- **`scripts/generarBaseSintetica.gs`** — Google Apps Script que crea las 4 hojas con 30 días de datos coherentes (Junio 2026). Asigna actividades y recursos por capítulo según el avance programado (PRY → MOV → EST → ARQ → INS).
- **`scripts/generate-synthetic-sheets.cjs`** — Alternativa en Node.js que genera CSVs/JSON para importación manual.

---

## 3. Cálculo de PV, EV, AC

### 3.1 PV — Planned Value (Valor Planificado)

```
PV del día = Σ (plannedQty × unitPrice) para cada actividad del reporte
```

- `plannedQty` viene de la actividad en `Detalle_Actividades` (col. 7)
- `unitPrice` viene del EDT (`EdtItem.unitPrice`) — lookup por `act.edtCode`
- El PV DIARIO también está precalculado en `pv-curve.json` (`pvDaily`)
- El PV ACUMULADO está en `pv-curve.json` (`pvCumulative`) y `pv-by-chapter.json`

**En el dashboard:**
- Curva S: usa `pvCurveData[].pvCumulative`
- Cuaderno de Obra: usa `pvCurveData[].pvDaily` (PV financiero del día)
- Capítulos: usa `pv-by-chapter.json` → lookup por código y fecha de corte

### 3.2 EV — Earned Value (Valor Ganado)

```
EV del día = Σ (qtyExecuted × unitPrice) para cada actividad ejecutada
```

- `qtyExecuted` viene de `Detalle_Actividades` (col. 8)
- `unitPrice` viene del EDT (`EdtItem.unitPrice`)
- NO se almacena monto monetario en Sheets — solo cantidades físicas

**En el dashboard:**
- Por reporte: suma directa en `enrichedReports[].computedMetrics.earnedValue`
- Acumulado: suma secuencial hasta la fecha de corte

### 3.3 AC — Actual Cost (Costo Real)

```
AC del día = MO + Materiales + Equipos

  MO        = Σ (hoursWorked × RESOURCE_COSTS[resourceId])
  Materiales= Σ (qtyConsumed × RESOURCE_COSTS[resourceId])
  Equipos   = Σ (qtyUsed × RESOURCE_COSTS[resourceId])
```

- Cantidades vienen de `Detalle_Recursos` (col. 9)
- Costos unitarios vienen del catálogo `RESOURCE_COSTS` construido desde:
  1. `resources.json` (unitCost)
  2. Fallback: MO = 20, Material = 10, Equipo = 30

**NO** se almacena monto monetario en Sheets — solo cantidades físicas y tipo de recurso.

### 3.4 Métricas EVM derivadas

| Métrica | Fórmula |
|---|---|
| SV | EV − PV |
| CV | EV − AC |
| SPI | EV / PV (>= 1 = adelantado) |
| CPI | EV / AC (>= 1 = ahorro) |
| ETC | (BAC − EV) / CPI |
| EAC | AC + ETC |
| TCPI | (BAC − EV) / (BAC − AC) |

---

## 4. Fallback Chain

El dashboard carga datos con esta prioridad (de más confiable a menos):

### Reportes (DailyReport[])
1. **Google Sheets Webhook** — `doGet` → HTML con JSON embebido → extracción vía `response.text()` + parse manual
2. **Express API** — `GET /api/reports` (reportes acumulados en memoria)
3. **Backup sintético** — `generate20DaysSyntheticReports()` (hardcoded)

### EDT + PlannedValues + BAC
1. `GET /api/master-data` → `{ bac, edt, plannedValues, resources }`
2. `GET /data/pv-edt-data.json` (archivo estático en `public/`)
3. `BACKUP_EDT` + `generateBackupPlannedValues()` (hardcoded en `App.tsx`)

### Curva S (PV Curve)
1. `GET /api/pv-curve`
2. `GET /data/pv-curve.json`
3. `FALLBACK_PV_CURVE` (constante embebida)

### PV por Capítulo
1. `GET /api/pv-chapter`
2. `GET /data/pv-by-chapter.json`
3. `PV_BY_CHAPTER` (constante embebida)

### Catálogo de Recursos
1. `GET /api/master-data` (o `/api/resources`)
2. `GET /data/resources.json`
3. `BACKUP_RESOURCES` (20 recursos hardcoded)

---

## 5. Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FUENTES DE DATOS                                                        │
│                                                                          │
│  BD_EDT.xlsx ──► data/pv-edt-data.json  ──► Express /api/master-data     │
│  BD_Metrados  ──► data/pv-curve.json    ──► Express /api/pv-curve        │
│  BD_PV_Diario ──► data/pv-by-chapter    ──► Express /api/pv-chapter      │
│  BD_RRHH.xlsx ──► data/resources.json   ──► Express /api/resources       │
│  Project meta ──► data/project.json     ──► Express /api/projects         │
│                                                                          │
│  generaBaseSintetica.gs ──► Google Sheets (4 tabs) ──► doGet ──► Webhook│
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  App.tsx (fetchAllData)                                                  │
│                                                                          │
│  1. ¿Hay webhook URL? ──► fetch(webhookUrl) ──► .text() ──► parse JSON  │
│     │                          │                                         │
│     │   ✓ reports desde Sheets  ✗ falla ──► Express /api/reports         │
│     │                                              │                     │
│     2. fetch /api/projects, /api/master-data,...    │ fallback           │
│        │                                   │                             │
│        ✓ Express responde                  ✗ catch block                 │
│          setProjects, setEdtList,            ├── fetch /data/*.json      │
│          setPvCurveData, setPvByChapter       │   (static files)         │
│          setResources, setProjectBac          │                          │
│                                               ├── ✗ → usar constantes    │
│                                                    embebidas (BACKUP_*)  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ProjectDashboard.tsx                                                    │
│                                                                          │
│  enrichedReports = sortedReports.map(r => {                             │
│    PV = Σ(plannedQty × edt.unitPrice)   ← actividades planeadas         │
│    EV = Σ(qtyExecuted × edt.unitPrice)  ← actividades ejecutadas        │
│    AC = Σ(horas×cost) + Σ(mat×cost) + Σ(eq×cost)  ← recursos            │
│    return { ...r, computedMetrics: { plannedValue, earnedValue,          │
│                                      actualCost, sv, cv, spi, cpi } }    │
│  })                                                                      │
│                                                                          │
│  generateChaptersData() ──► Por cada capítulo EDT:                      │
│    PV = pv-by-chapter lookup por fecha de corte                          │
│    EV = Σ(qtyEjecutada × unitPrice) de actividades hijas                │
│    AC = Σ(recursos con edtGroupCode = capítulo)                          │
│    BAC = último pvCumulative del capítulo (= totalBudget)                │
│    SPI = EV/PV, CPI = EV/AC, ETC = (BAC-EV)/CPI, EAC = AC+ETC           │
│                                                                          │
│  Render:                                                                 │
│    ├── Curva S (PV, EV, AC acumulados por fecha)                        │
│    ├── Métricas: BAC, PV, EV, AC, SV, CV, SPI, CPI, %Avance             │
│    ├── Cuaderno de Obra (tarjetas colapsables por día)                   │
│    │     PV: actividades planeadas × P.U.                               │
│    │     EV: actividades ejecutadas × P.U.                              │
│    │     AC: MO (horas×$/h) + Mat (qty×$/und) + Eq (qty×$/und)          │
│    └── Tabla de capítulos EDT con EVM completo                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```
