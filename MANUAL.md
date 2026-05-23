# 🏗️ Sistema RDO — Reporte Diario de Obra
## Manual Técnico y de Usuario

**Stack:** Vite + React + TypeScript + Express.js + XLSX + Google Apps Script  
**Deploy:** GitHub Pages (frontend estático) + Express local (desarrollo)  
**Repositorio:** [aureliosrios/reporte-diario-obra](https://github.com/aureliosrios/reporte-diario-obra)  
**Producción:** https://aureliosrios.github.io/reporte-diario-obra/

---

## Índice

1. [¿Qué hace este sistema?](#1-qué-hace-este-sistema)
2. [Arquitectura General](#2-arquitectura-general)
3. [Estructura de Carpetas](#3-estructura-de-carpetas)
4. [Bases de Datos Excel](#4-bases-de-datos-excel)
5. [Pipeline Excel → JSON](#5-pipeline-excel--json)
6. [Configuración de Google Sheets](#6-configuración-de-google-sheets)
7. [Manual de Usuario — Campo (Smartphone)](#7-manual-de-usuario--campo-smartphone)
8. [Manual de Usuario — Dashboard (PC)](#8-manual-de-usuario--dashboard-pc)
9. [Indicadores EVM](#9-indicadores-evm)
10. [Modos de Operación](#10-modos-de-operación)
11. [Despliegue y Mantenimiento](#11-despliegue-y-mantenimiento)

---

## 1. ¿Qué hace este sistema?

El sistema RDO es una plataforma web **mobile-first** que permite:

- **Registrar el avance diario de obra** desde un smartphone en campo (formulario offline-resiliente)
- **Sincronizar automáticamente** los datos con Google Sheets en la nube
- **Visualizar el Dashboard EVM** (Earned Value Management) en tiempo real con la Curva S, métricas de rendimiento y cuaderno de obra digital

```
  Supervisor en campo        →    Google Sheets      →    Dashboard EVM
  (Formulario smartphone)         (Base de datos)         (GitHub Pages)
```

---

## 2. Arquitectura General

```
_excel-fuente/               data/                  Google Sheets
  BD_Presupuesto_EDT.xlsx  →  pv-edt-data.json  →  /api/master-data  ←──┐
  BD_PV_Diario_EDT.xlsx    →  pv-curve.json     →  /api/pv-curve         │
  BD_PV_CurvaS_Proyecto.  →  pv-by-chapter.json →  /api/pv-chapter       │
  BD_RRHH.xlsx        ─┐   →  resources.json    →  /api/resources        │
  BD_Almacen.xlsx      ─┘                                                 │
  BD_Proyecto.xlsx     ──→    project.json      →  /api/projects          │
                                                                          │
generate-pv-json.cjs                                                      │
  (Pipeline Excel → JSON)                                        App.tsx  │
                                                           fetchAllData() ─┘
                                                                 │
                                                    ┌────────────┴────────────┐
                                                    │                         │
                                               ReportForm              ProjectDashboard
                                           (campo / smartphone)        (EVM dashboard)
                                                    │
                                               POST → doPost()
                                            (Apps Script Webhook)
                                                    │
                                           Google Sheets (4 hojas)
                                                    │
                                               doGet() → JSON
                                                    │
                                           App.tsx fetchAllData()
                                           (reportes en tiempo real)
```

### Fallback Chain (resiliencia)

El sistema funciona aunque no haya internet, cargando datos en este orden de prioridad:

| Dato | 1° Prioridad | 2° Prioridad | 3° Prioridad |
|---|---|---|---|
| Reportes | Google Sheets (doGet webhook) | Express `/api/reports` | 20 reportes sintéticos embebidos |
| EDT + PV | Express `/api/master-data` | `/data/pv-edt-data.json` | BACKUP_EDT hardcodeado en App.tsx |
| Curva S | Express `/api/pv-curve` | `/data/pv-curve.json` | `FALLBACK_PV_CURVE` embebida |
| PV Capítulos | Express `/api/pv-chapter` | `/data/pv-by-chapter.json` | `PV_BY_CHAPTER` embebida |
| Recursos | Express `/api/master-data` | `/data/resources.json` | `BACKUP_RESOURCES` embebida |

---

## 3. Estructura de Carpetas

```
/
├── _excel-fuente/                   ← Archivos Excel fuente de verdad
│   ├── BD_Presupuesto_EDT.xlsx      ← Estructura WBS + presupuesto
│   ├── BD_PV_Diario_EDT.xlsx        ← Metrados planificados diarios
│   ├── BD_PV_CurvaS_Proyecto.xlsx   ← Curva S oficial del proyecto
│   ├── BD_Proyecto.xlsx             ← Metadatos del proyecto
│   ├── BD_RRHH.xlsx                 ← Catálogo de mano de obra
│   ├── BD_Almacen.xlsx              ← Catálogo de materiales y equipos
│   ├── plantilla_wbs.xlsx           ← Plantilla para nuevos proyectos
│   └── PV.xlsx                      ← Referencia de validación
│
├── data/                            ← Generado por el script (NO editar)
│   ├── project.json
│   ├── pv-edt-data.json
│   ├── pv-curve.json
│   ├── pv-by-chapter.json
│   ├── resources.json
│   ├── reports.json                 ← Reportes guardados localmente
│   ├── photos/                      ← Fotos de reportes
│   └── signatures/                  ← Firmas digitales
│
├── public/data/                     ← Copia de JSONs para GitHub Pages
│   └── *.json
│
├── docs/
│   └── google-apps-script/
│       └── generarBaseSintetica.gs  ← Apps Script para Google Sheets
│
├── scripts/
│   └── generate-pv-json.cjs        ← Único script de pipeline (Excel → JSON)
│
├── src/
│   ├── App.tsx                      ← Shell principal + carga de datos
│   ├── types.ts                     ← Tipos TypeScript
│   ├── index.css
│   ├── main.tsx
│   └── components/
│       ├── ProjectDashboard.tsx     ← Motor EVM + Dashboard visual
│       └── ReportForm.tsx           ← Formulario RDO de campo
│
├── .github/workflows/deploy.yml    ← CI/CD GitHub Pages
├── .env.example
├── MANUAL.md                       ← Este archivo
├── index.html
├── package.json
├── server.ts                        ← API Express (modo local)
├── tsconfig.json
└── vite.config.ts
```

---

## 4. Bases de Datos Excel

Los Excel viven en `_excel-fuente/`. **Nunca editar los JSON de `data/` manualmente** — siempre modificar el Excel y ejecutar el pipeline.

### BD_Presupuesto_EDT.xlsx — Hoja: `Presupuesto`

| Columna | Tipo | Descripción |
|---|---|---|
| `edt_id` | Número | ID único del ítem (ej: 1, 1.1, 2, 2.1) |
| `edt_nombre` | Texto | Nombre del capítulo (solo nivel 1) |
| `actividad_id` | Número | ID de la actividad (solo nivel 2) |
| `actividad_nombre` | Texto | Nombre de la actividad |
| `codigo` | Texto | Código único: `OBR-PRE`, `OBR-PRE-01`, etc. |
| `unidad` | Texto | m², m³, kg, und, Global, etc. |
| `presupuesto_total` | Número | Monto total contratado (S/) |
| `metrado_total_planificado` | Número | Cantidad total del proyecto |
| `precio_unitario` | Número | PU = presupuesto_total / metrado_total |
| `nivel_wbs` | 1 o 2 | 1 = Capítulo, 2 = Actividad |
| `padre_id` | Número | edt_id del capítulo padre (solo nivel 2) |

> **Regla clave:** `precio_unitario = presupuesto_total / metrado_total_planificado`
> Esto garantiza que `PV = Σ(metrado_diario × PU)` = `pv_diario` del Excel.

### BD_PV_Diario_EDT.xlsx — Hoja: `PV_Diario_EDT`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_wbs` | Número | FK → `actividad_id` de BD_Presupuesto_EDT |
| `fecha` | YYYY-MM-DD | Fecha del valor planificado |
| `metrado_diario_planificado` | Número | Cantidad planificada para ese día |
| `pv_diario` | Número | PV en soles del día (= metrado × PU) |
| `pv_acumulado` | Número | PV acumulado hasta esa fecha (por actividad) |

### BD_PV_CurvaS_Proyecto.xlsx — Hoja: `CurvaS`

| Columna | Tipo | Descripción |
|---|---|---|
| `fecha` | YYYY-MM-DD | Fecha |
| `pv_diario` | Número | PV total del proyecto ese día (Σ todas las actividades) |
| `pv_acumulado` | Número | PV acumulado total del proyecto |

### BD_Proyecto.xlsx — Hoja: `Proyecto`

Formato de dos columnas (clave / valor):

| Clave | Valor de ejemplo |
|---|---|
| `Nombre del Proyecto` | Edificio Multifamiliar Girasoles |
| `Código de Proyecto` | MFG-01 |
| `Ubicación` | San Isidro, Lima, Perú |
| `Gerente de Obra` | Ing. Alejandro Rivas |
| `Empresa Constructora` | Constructora Aurelio Rios S.A.C. |
| `Cliente` | Inmobiliaria Los Parques S.A. |
| `Supervisor de Obra` | Ing. Claudia Mendoza |

### BD_RRHH.xlsx — Hoja: `Recursos_MO`

| Columna | Descripción |
|---|---|
| `codigo` | ID del recurso (ej: `LH-CAP`) |
| `nombre` | Descripción (ej: Capataz de Edificación) |
| `tipo` | Siempre `mano_obra` |
| `unidad` | `Hora Hombre` |
| `costo_unitario` | Tarifa horaria en S/ |

### BD_Almacen.xlsx — Hoja: `Materiales_Equipos`

| Columna | Descripción |
|---|---|
| `id_recurso` | ID (ej: `MAT-CEM`, `EQ-MEZ`) |
| `descripcion` | Nombre del recurso |
| `tipo` | `material` o `equipo` |
| `unidad` | Bolsa, m³, Hora Máquina, etc. |
| `precio_unitario_real` | Costo unitario en S/ |

---

## 5. Pipeline Excel → JSON

Cuando se modifica cualquier Excel, ejecutar:

```bash
node scripts/generate-pv-json.cjs
```

### ¿Qué hace el script?

1. Lee `BD_Presupuesto_EDT.xlsx` → estructura de capítulos y actividades
2. Lee `BD_PV_Diario_EDT.xlsx` → valores planificados diarios por actividad
3. Lee `BD_PV_CurvaS_Proyecto.xlsx` → curva S oficial agregada del proyecto
4. Lee `BD_Proyecto.xlsx` → metadatos del proyecto
5. Lee `BD_RRHH.xlsx` + `BD_Almacen.xlsx` → catálogo unificado de recursos
6. Calcula `unitPrice = presupuesto_total / metrado_total_planificado` por partida
7. Valida coherencia: `Σ PV capítulos ≈ BAC total` (diferencia < S/ 1.00)
8. Escribe los JSON en `data/` **y** copia a `public/data/` automáticamente

### Archivos generados

| Archivo | Contenido |
|---|---|
| `data/project.json` | Metadatos del proyecto |
| `data/pv-edt-data.json` | `{ bac, edt[], plannedValues[] }` |
| `data/pv-curve.json` | Curva S: `[{ date, pvDaily, pvCumulative }]` |
| `data/pv-by-chapter.json` | PV por capítulo: `[{ code, name, totalBudget, points[] }]` |
| `data/resources.json` | Catálogo unificado de recursos |

### Para un nuevo proyecto

1. Copiar los Excel de `_excel-fuente/` con la misma estructura de columnas
2. Actualizar los datos (actividades, presupuesto, cronograma)
3. Ejecutar `node scripts/generate-pv-json.cjs`
4. La app reconocerá automáticamente los nuevos capítulos

---

## 6. Configuración de Google Sheets

### 6.1 Crear la Hoja de Cálculo

1. Ir a [Google Sheets](https://sheets.google.com) → Crear nueva hoja
2. Abrir el editor de Apps Script: **Extensiones → Apps Script**
3. Copiar el contenido de `docs/google-apps-script/generarBaseSintetica.gs`
4. Guardar y hacer **Ejecutar → generarEstructuraHojas** (crea las 4 hojas automáticamente)
5. Publicar como webapp: **Implementar → Nueva implementación**
   - Tipo: Aplicación web
   - Ejecutar como: Yo
   - Acceso: Cualquier persona
6. Copiar la URL de implementación

### 6.2 Estructura de las 4 Hojas

El Apps Script crea automáticamente:

| Hoja | Contenido |
|---|---|
| `R_Produccion` | Cabecera del reporte: fecha, supervisor, turno, clima, horas, capítulo |
| `R_Seguridad` | Datos HSE: personal total, inspecciones, incidentes |
| `Detalle_Actividades` | Actividades del día: código EDT, meta, ejecutado |
| `Detalle_Recursos` | Recursos consumidos: MO, materiales, equipos |

### 6.3 Conectar la App con Sheets

1. Abrir el dashboard → botón **"Despliegue Sheets"** (ícono de nube)
2. Pegar la URL del Apps Script
3. Hacer clic en **"Guardar y Sincronizar"**

A partir de ahí, cada reporte enviado desde campo se guarda automáticamente en Sheets, y el dashboard los carga en tiempo real.

---

## 7. Manual de Usuario — Campo (Smartphone)

### Acceso

- **URL directa al formulario:** `[url-del-proyecto]/#campo`
- La app funciona offline — guarda automáticamente cada 15 segundos en el navegador

### Pasos para registrar un reporte

#### Paso 1 — Datos Generales
- Seleccionar **proyecto** y **turno** (Mañana / Tarde / Noche / Continuo)
- Ingresar **horas efectivas** trabajadas
- Registrar el **clima** de la mañana y la tarde
- Escribir el nombre del **supervisor**

#### Paso 2 — Capítulo EDT
- Seleccionar el **capítulo de trabajo** del día (Obras Preliminares, Estructuras, etc.)
- Esto filtra automáticamente las actividades disponibles

#### Paso 3 — Actividades Ejecutadas
- Hacer clic en **"+ Agregar Actividad"**
- Buscar la actividad por código o nombre
- Ingresar:
  - **Meta del día** (quantidade planificada)
  - **Ejecutado** (cantidad real lograda)
  - **Observaciones** opcionales

#### Paso 4 — Recursos Utilizados
- **Mano de Obra:** Seleccionar cuadrilla, ingresar horas trabajadas
- **Materiales:** Seleccionar material y cantidad consumida
- **Equipos:** Seleccionar equipo y horas de uso

#### Paso 5 — Seguridad y HSE
- Personal total en obra
- ¿Se realizaron inspecciones de seguridad? (Sí/No)
- Detalle de inspecciones y observaciones
- Registro de incidentes o accidentes (si los hubo)

#### Paso 6 — Observaciones y Plan
- Restricciones o conflictos del día
- Plan de trabajo para el día siguiente
- Observaciones generales

#### Paso 7 — Firma y Fotos
- Firma digital en el lienzo táctil
- Adjuntar hasta **4 fotografías** de avance

#### Paso 8 — Enviar
- **"Enviar Reporte"** → guarda localmente + envía a Google Sheets
- Si no hay internet, queda guardado en el navegador para sincronizar después
- Descargar **respaldo JSON** para archivos locales

---

## 8. Manual de Usuario — Dashboard (PC)

### Acceso

- **URL principal:** `[url-del-proyecto]/#gerencia`
- Requiere conexión para cargar datos de Google Sheets

### Panel de Control EVM

#### Métricas Principales (tarjetas superiores)

| Métrica | Significado |
|---|---|
| **BAC** | Presupuesto total del proyecto |
| **PV** | Valor planificado hasta hoy (Curva S) |
| **EV** | Valor ganado: lo que realmente se ejecutó |
| **AC** | Costo real incurrido |
| **SPI** | Índice de rendimiento del plazo (≥1 = adelantado) |
| **CPI** | Índice de rendimiento del costo (≥1 = ahorro) |
| **% Avance** | EV / BAC × 100 |

#### Curva S

Gráfico acumulado con tres líneas:
- 🔵 **PV** — Lo planificado (Baseline)
- 🟢 **EV** — Lo ejecutado (en valor)
- 🔴 **AC** — Lo gastado (costo real)

#### Tabla de Capítulos EDT

Muestra por cada capítulo (Obras Preliminares, Estructuras, etc.):
- BAC, PV, EV, AC del capítulo
- SPI, CPI, % avance
- Semáforo de estado: 🟢 Saludable / 🟡 Alerta / 🔴 Desviado

#### Cuaderno de Obra Digital

Seleccionar cualquier reporte para ver:
- Resumen del día (clima, horas, personal)
- Actividades ejecutadas con PV y EV calculados
- Recursos consumidos con costos detallados
- Seguridad e incidentes

### Sincronización

- Botón **"🔄 Sincronizar"** → recarga datos de Google Sheets
- El dashboard actualiza automáticamente al abrir

---

## 9. Indicadores EVM

Basado en la norma **PMI-PMBOK 7ma Edición**.

### Fórmulas Principales

| Indicador | Fórmula | Fuente de Datos |
|---|---|---|
| **PV** | PV acumulado hasta fecha de corte | `pv-curve.json` → `pvCumulative` |
| **EV** | Σ (metrado_ejecutado × PU) | Actividades de reportes RDO |
| **AC** | Σ (horas × tarifa) + Σ (mat × precio) + Σ (equipo × tarifa) | Recursos de reportes RDO |
| **SV** | EV − PV | Calculado |
| **CV** | EV − AC | Calculado |
| **SPI** | EV / PV | Calculado |
| **CPI** | EV / AC | Calculado |
| **ETC** | (BAC − EV) / CPI | Proyección al ritmo actual |
| **EAC** | AC + ETC | Estimado a la terminación |
| **% Avance** | EV / BAC × 100 | Calculado |

### Semáforo de Estado

| Condición | Estado |
|---|---|
| SPI ≥ 0.95 **Y** CPI ≥ 0.95 | 🟢 **Saludable** |
| SPI ≥ 0.85 **O** CPI ≥ 0.85 | 🟡 **Alerta** |
| SPI < 0.85 **Y** CPI < 0.85 | 🔴 **Desviado** |

### Reglas de Coherencia

1. **El Excel es la fuente de verdad** — cualquier cambio de presupuesto o cronograma → actualizar Excel → ejecutar script
2. **PV siempre del baseline** — el PV de un capítulo viene de `pv-by-chapter.json`, nunca de los reportes de campo
3. **Lookup por código, nunca por nombre** — el código EDT (`OBR-PRE`, `EST-CON`) es la clave única

---

## 10. Modos de Operación

### Modo Local (desarrollo)

```bash
# 1. Instalar dependencias (solo primera vez)
npm install

# 2. Actualizar datos si cambió algún Excel
node scripts/generate-pv-json.cjs

# 3. Correr la aplicación
npm run dev
# → http://localhost:3000
```

Datos servidos desde Express: `/api/master-data`, `/api/pv-curve`, `/api/pv-chapter`, `/api/reports`

### Modo GitHub Pages (producción)

- La app carga JSON estáticos desde `/data/*.json` (copiados por el script)
- Reportes desde Google Sheets via webhook
- No requiere servidor Express

### Modo Offline (emergencia)

Si todo falla, la app muestra un badge **"Local Resilient"** y usa:
- `BACKUP_EDT` — 5 capítulos aproximados con actividades tipo
- `BACKUP_RESOURCES` — 20 recursos de referencia
- `BACKUP_REPORTS` — 20 días de reportes sintéticos

---

## 11. Despliegue y Mantenimiento

### Despliegue Automático (GitHub Actions)

Cada `git push` a `main` dispara automáticamente:
1. Checkout del código
2. `npm install`
3. `vite build --base=/reporte-diario-obra/`
4. Deploy a la rama `gh-pages`

```bash
# Para actualizar datos en producción:
node scripts/generate-pv-json.cjs   # Regenera los JSON
git add data/ public/data/
git commit -m "feat: actualizar datos del proyecto"
git push origin main
# GitHub Actions despliega automáticamente
```

### Variables de Entorno

Crear `.env.local` en la raíz (ver `.env.example`):

```env
GEMINI_API_KEY=tu_clave_aqui    # Opcional: para análisis IA en el dashboard
```

### Agregar un Nuevo Proyecto

1. Actualizar los archivos en `_excel-fuente/` con la estructura del nuevo proyecto
2. Ejecutar `node scripts/generate-pv-json.cjs`
3. Configurar una nueva hoja de Google Sheets y obtener la URL del webhook
4. Ingresar la URL en la app → "Despliegue Sheets"

### Solución de Problemas Comunes

| Problema | Causa probable | Solución |
|---|---|---|
| Dashboard muestra datos sintéticos | Webhook de Sheets no configurado | Ir a Despliegue Sheets y guardar URL |
| El script falla al leer Excel | Nombre de hoja incorrecto | Verificar que la hoja se llame exactamente `Presupuesto`, `PV_Diario_EDT`, `CurvaS`, `Proyecto`, `Recursos_MO`, `Materiales_Equipos` |
| PV y EV no coinciden | `unitPrice` inconsistente | Ejecutar el script y revisar las advertencias `⚠` |
| Badge "Local Resilient" aparece | Express no está corriendo | Ejecutar `npm run dev` |
| Reporte no se envía a Sheets | Error CORS o permisos | Verificar que el Apps Script esté publicado con acceso "Cualquier persona" |
