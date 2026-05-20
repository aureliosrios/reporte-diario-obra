# Documentación Técnica — Sistema RDO + EVM
## Reporte Diario de Obra con Control de Valor Ganado

**Versión**: 2.1 — Mayo 2026  
**Última actualización**: 2026-05-20  
**Stack**: Vite + React + TypeScript + Express.js + XLSX

---

## 1. Arquitectura General

```
BD_EDT.xlsx ──────────────────────────────────────────────────────┐
BD_Metrados_Planificados.xlsx ──→ generate-pv-json.cjs ──────────→ data/*.json
BD_RRHH.xlsx ─────────────────────────────────────────────────────┘     │
PV.xlsx (referencia de validación)                                       │
                                                                         ↓
                                                               public/data/*.json
                                                           (GitHub Pages / estático)
                                                                         │
                                              ┌──────────────────────────┘
                                              │       server.ts
                                              │    /api/master-data
                                              │    /api/pv-curve
                                              │    /api/pv-chapter
                                              │
                                       App.tsx fetchAllData()
                                  (1° Express API, 2° /data/ estático, 3° BACKUP)
                                              │
                                    ProjectDashboard.tsx
                                   (Motor EVM – PMI-PMBOK)
```

### Flujo de Datos
1. El analista actualiza los Excel (`BD_EDT.xlsx`, `BD_Metrados_Planificados.xlsx`, `BD_RRHH.xlsx`)
2. Ejecuta `node scripts/generate-pv-json.cjs` → genera y sincroniza todos los JSON
3. El servidor Express lee los JSON al arrancar y los sirve vía `/api/*`
4. En modo estático (GitHub Pages), la app carga los JSON directamente desde `/data/`
5. Solo si todo falla → datos de respaldo `BACKUP_*` hardcodeados en `App.tsx`

---

## 2. Bases de Datos Excel

### Estructura obligatoria por archivo

| Archivo | Hoja | Columnas requeridas | Propósito |
|---------|------|---------------------|-----------|
| `BD_EDT.xlsx` | `Sheet1` | `edt_id`, `edt_nombre`, `actividad_id`, `actividad_nombre`, `codigo`, `unidad`, `presupuesto_total`, `metrado_total_planificado`, `nivel_wbs` (1 o 2), `padre_id` | Estructura WBS/EDT del proyecto |
| `BD_Metrados_Planificados.xlsx` | `Sheet1` | `id_wbs`, `fecha` (YYYY-MM-DD), `metrado_diario_planificado`, `pv_diario`, `pv_acumulado` | Baseline de planificación (PV diario) |
| `BD_RRHH.xlsx` | (primera hoja) | `codigo`, `nombre`, `tipo` (`mano_obra`/`material`/`equipo`), `unidad`, `costo_unitario` | Catálogo de recursos |

### Reglas de Estructura EDT

- **Nivel 1** (`nivel_wbs = 1`): Capítulos / Partidas genéricas. Tienen `actividad_id` vacío.
- **Nivel 2** (`nivel_wbs = 2`): Actividades / Partidas específicas. Tienen `padre_id` = `edt_id` del capítulo padre.
- El campo `codigo` es la **clave única** de cada ítem (ej. `OBR-PRE`, `OBR-PRE-01`).

### Regla de `unitPrice` (Precio Unitario)

```
unitPrice = presupuesto_total / metrado_total_planificado
```

Esta fórmula garantiza que:
- `PV = Σ (metrado_diario_planificado × unitPrice)` reproduce exactamente el `pv_diario` del Excel
- `EV = Σ (metrado_ejecutado × unitPrice)` está en la **misma moneda** (S/) que el PV
- `SV = EV - PV` y `SPI = EV / PV` son comparables y tienen sentido financiero real

---

## 3. Estructura de Capítulos del Proyecto

El proyecto actual tiene **7 capítulos EDT**:

| Código | Nombre | BAC (S/) |
|--------|--------|-----------|
| OBR-PRE | Obras Preliminares | 41,500 |
| CIM | Cimentación | 249,700 |
| EST | Estructura | 424,200 |
| ALB | Albañilería | 125,500 |
| INS | Instalaciones | 95,700 |
| ACA | Acabados | 170,100 |
| OBR-EXT | Obras Exteriores | 66,200 |
| **TOTAL** | **Proyecto completo** | **1,172,900** |

---

## 4. Archivos JSON Generados

Todos ubicados en `data/` y copiados a `public/data/` automáticamente:

### `pv-edt-data.json`
```json
{
  "bac": 1172900,
  "edt": [ { "code": "OBR-PRE", "parentId": null, "name": "...", "unitPrice": 0, ... } ],
  "plannedValues": [ { "date": "2026-05-15", "edtCode": "OBR-PRE-01", "plannedQty": 141.67 } ]
}
```

### `pv-by-chapter.json`
```json
[
  {
    "code": "OBR-PRE",      ← CÓDIGO EDT (clave unívoca, NO el nombre)
    "name": "Obras Preliminares",
    "totalBudget": 41500,
    "points": [ { "date": "2026-05-15", "pvCumulative": 2533.33 }, ... ]
  }
]
```
> **Importante**: La clave `code` en `pv-by-chapter.json` usa el **código EDT** (`OBR-PRE`) para garantizar un lookup sin ambigüedad en `ProjectDashboard.tsx`.

### `pv-curve.json`
```json
[ { "date": "2026-05-15", "pvDaily": 2533.33, "pvCumulative": 2533.33 } ]
```

### `resources.json`
```json
[ { "id": "LH-CAP", "name": "Capataz", "type": "mano_obra", "unit": "Hora Hombre", "unitCost": 28.0 } ]
```

---

## 5. Motor EVM — Fórmulas Implementadas (PMI-PMBOK 7ma Ed.)

### Indicadores Globales del Proyecto

| Indicador | Fórmula | Fuente de datos |
|-----------|---------|-----------------|
| **BAC** | Total PV al final del cronograma | `pv-edt-data.json` → campo `bac` |
| **PV** | PV acumulado hasta fecha de corte | `pv-curve.json` → `pvCumulative` |
| **EV** | Σ (metrado_ejecutado × unitPrice) | Reportes RDO × EDT |
| **AC** | Σ (horas × tarifa) + Σ (mat × precio) + Σ (equipo × tarifa) | Recursos de reportes RDO |
| **SV** | EV - PV | Calculado |
| **CV** | EV - AC | Calculado |
| **SPI** | EV / PV | Calculado |
| **CPI** | EV / AC | Calculado |
| **ETC** | (BAC - EV) / CPI | Proyección al ritmo actual |
| **EAC** | AC + ETC | Estimado a la terminación |
| **% Avance** | (EV / BAC) × 100 | Calculado |

### Indicadores por Capítulo EDT

Aplican las mismas fórmulas. La **fuente de PV por capítulo** es siempre `pv-by-chapter.json` (lookup por `ch.code`). **Nunca** se calcula PV desde los metrados del reporte de campo.

### Semáforo de Estado

| Umbral | Estado |
|--------|--------|
| SPI ≥ 0.95 **Y** CPI ≥ 0.95 | 🟢 Saludable |
| SPI ≥ 0.85 **O** CPI ≥ 0.85 | 🟡 Alerta |
| SPI < 0.85 **Y** CPI < 0.85 | 🔴 Desviado |

---

## 6. Modos de Operación

### Modo Producción (Express + Excel)
```bash
node scripts/generate-pv-json.cjs   # Sincronizar Excel → JSON
node server.ts                      # Arrancar servidor Express
```
- Datos desde `/api/master-data`, `/api/pv-curve`, `/api/pv-chapter`
- Reportes guardados en `data/reports.json`

### Modo Estático / GitHub Pages
- La app carga automáticamente desde `/data/pv-edt-data.json`, `/data/pv-curve.json`, `/data/pv-by-chapter.json`
- Requiere que `public/data/` tenga los JSON generados (el script los copia automáticamente)
- Reportes desde Google Sheets (via webhook configurado en la app)

### Modo Offline / Emergencia
- Si todo falla, `BACKUP_EDT` (7 capítulos aproximados) y `BACKUP_REPORTS` (20 días sintéticos)
- Identificado con badge **"Local Resilient"** en el header

---

## 7. Script de Generación de Datos

```bash
node scripts/generate-pv-json.cjs
```

### Qué hace el script
1. Lee `BD_EDT.xlsx` → estructura de capítulos y actividades
2. Lee `BD_Metrados_Planificados.xlsx` → valores planificados diarios
3. Lee `BD_RRHH.xlsx` → catálogo de recursos
4. Calcula `unitPrice` = `presupuesto_total / metrado_total_planificado` por partida
5. Genera curva S acumulada del proyecto (Σ `pv_diario` por fecha)
6. Genera curvas S por capítulo (lookup por `código EDT`, no por nombre)
7. Valida coherencia: `Σ BAC capítulos ≈ BAC total` (diferencia < S/ 1.00)
8. Escribe **todos** los JSON en `data/` **Y** copia a `public/data/`

### Añadir un nuevo proyecto
Para usar la app con un proyecto diferente:
1. Crear copias de los Excel con la misma estructura de columnas
2. Actualizar `BD_EDT.xlsx` con los capítulos y partidas del nuevo proyecto
3. Actualizar `BD_Metrados_Planificados.xlsx` con el cronograma planificado
4. Ejecutar `node scripts/generate-pv-json.cjs`
5. La app reconocerá automáticamente los nuevos capítulos

---

## 8. Sincronización con Google Sheets

La app puede recibir reportes en tiempo real desde Google Sheets vía webhook (Apps Script):

1. Configurar el webhook en la pestaña **"Despliegue Sheets"** de la app
2. El Apps Script debe retornar un array de `DailyReport[]` en formato JSON
3. La app prioriza los datos de Sheets sobre los reportes locales
4. Los cambios en Sheets se reflejan en la app al presionar **"Sincronizar Sheets"**

---

## 9. Archivos del Proyecto

```
/
├── BD_EDT.xlsx                      ← Estructura WBS/EDT (fuente de verdad)
├── BD_Metrados_Planificados.xlsx    ← Baseline de PV diario (fuente de verdad)
├── BD_RRHH.xlsx                     ← Catálogo de recursos
├── PV.xlsx                          ← Planilla de referencia de validación
├── scripts/
│   └── generate-pv-json.cjs        ← Pipeline Excel → JSON (ejecutar al cambiar Excel)
├── data/                            ← Generado por el script (NO editar manualmente)
│   ├── pv-edt-data.json
│   ├── pv-curve.json
│   ├── pv-by-chapter.json
│   ├── resources.json
│   └── reports.json                ← Reportes RDO guardados
├── public/data/                     ← Copia para GitHub Pages (NO editar manualmente)
│   ├── pv-edt-data.json
│   ├── pv-curve.json
│   ├── pv-by-chapter.json
│   └── resources.json
├── src/
│   ├── App.tsx                      ← Shell de la app + carga de datos
│   ├── types.ts                     ← Tipos TypeScript
│   └── components/
│       ├── ProjectDashboard.tsx     ← Motor EVM + Dashboard visual
│       ├── ReportForm.tsx           ← Formulario RDO de campo
│       └── ...
└── server.ts                        ← API Express (modo producción local)
```

---

## 10. Reglas de Coherencia y Buenas Prácticas

1. **El Excel es la fuente de verdad** — cualquier cambio en el presupuesto o cronograma se hace en el Excel, luego se ejecuta el script.
2. **PV siempre del baseline** — el PV de un capítulo nunca se recalcula desde los reportes de campo; siempre viene de `pv-by-chapter.json`.
3. **unitPrice en S/** — el precio unitario de cada partida representa el costo real en soles, permitiendo que EV, PV y AC sean comparables.
4. **Lookup por código, nunca por nombre** — el código EDT (`OBR-PRE`, `CIM`, etc.) es la clave única; los nombres pueden tener variaciones tipográficas.
5. **Coherencia validada** — el script verifica automáticamente que `Σ BAC capítulos ≈ BAC total` al ejecutarse.
6. **Alerta de inconsistencia en el dashboard** — si `Σ PV capítulos ≠ PV integral` (> 0.5%), el dashboard muestra un badge de alerta.
