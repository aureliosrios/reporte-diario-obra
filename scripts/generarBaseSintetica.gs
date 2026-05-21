/**
 * GENERADOR DE BASE DE DATOS SINTÉTICA PARA REPORTE DIARIO DE OBRA (RDO)
 *
 * Cómo usar:
 *   1. En Google Sheets: Extensiones → Apps Script
 *   2. Pegar todo este código y guardar (Ctrl+S)
 *   3. Seleccionar la función "generarBaseSintetica" y ejecutar
 *   4. Se crearán 4 pestañas: Producción, Seguridad, Actividades, Recursos
 *
 * Genera 30 días de reportes sintéticos (Jun 2026) coherentes con el
 * Plan de Valor Planificado (PV) del proyecto Edificio Multifamiliar Girasoles.
 */

function generarBaseSintetica() {
  // ─── 1. DATOS DEL PROYECTO ───────────────────────────────────────────────
  const PROJECT = {
    code: "MFG-01",
    name: "Edificio Multifamiliar Girasoles",
    location: "San Isidro, Lima, Perú",
    manager: "Ing. Alejandro Rivas"
  };

  // ─── 2. EDT (Estructura de Desglose de Trabajo) ─────────────────────────
  // Capítulos Nivel 1
  const CHAPTERS = {
    "OBR-PRE":  { name: "Obras Preliminares y Provisionales",   startDay: 0,  endDay: 9  },
    "MOV-TIE":  { name: "Movimiento de Tierras",                startDay: 1,  endDay: 19 },
    "EST-CON":  { name: "Estructuras de Concreto",              startDay: 7,  endDay: 27 },
    "ARQ-ACAB": { name: "Arquitectura y Acabados",             startDay: 15, endDay: 29 },
    "INS-SAN":  { name: "Instalaciones Sanitarias y Eléctricas",startDay: 19, endDay: 29 }
  };
  const CHAPTER_ORDER = Object.keys(CHAPTERS); // orden de construcción

  // Partidas Nivel 2 por capítulo
  const EDT_ITEMS = {
    "OBR-PRE": [
      { code: "OBR-PRE-01", name: "Limpieza de terreno manual",         unit: "m2", unitPrice: 6.0,  totalBudgetQty: 1500 },
      { code: "OBR-PRE-02", name: "Trazo, nivelación y replanteo",      unit: "m2", unitPrice: 8.0,  totalBudgetQty: 1500 },
      { code: "OBR-PRE-03", name: "Cerco provisional de obra con madera",unit: "m", unitPrice: 50.0,  totalBudgetQty: 240  },
      { code: "OBR-PRE-04", name: "Construcción de almacén y oficina",  unit: "glb",unitPrice: 12000,totalBudgetQty: 1    }
    ],
    "MOV-TIE": [
      { code: "MOV-TIE-01", name: "Excavación masiva con excavadora",   unit: "m3", unitPrice: 22.0, totalBudgetQty: 1200 },
      { code: "MOV-TIE-02", name: "Excavación manual de zanjas",        unit: "m3", unitPrice: 45.0, totalBudgetQty: 180  },
      { code: "MOV-TIE-03", name: "Relleno y compactado con vibradora", unit: "m3", unitPrice: 35.0, totalBudgetQty: 450  },
      { code: "MOV-TIE-04", name: "Eliminación de desmonte c/volquete", unit: "m3", unitPrice: 28.0, totalBudgetQty: 1500 }
    ],
    "EST-CON": [
      { code: "EST-CON-01", name: "Solado de concreto e=3\" f'c=100",  unit: "m2", unitPrice: 32.0, totalBudgetQty: 350  },
      { code: "EST-CON-02", name: "Concreto f'c=210 en zapatas",       unit: "m3", unitPrice: 380,  totalBudgetQty: 160  },
      { code: "EST-CON-03", name: "Acero de refuerzo en zapatas",      unit: "kg", unitPrice: 5.5,  totalBudgetQty: 4500 },
      { code: "EST-CON-04", name: "Concreto f'c=280 en columnas",      unit: "m3", unitPrice: 420,  totalBudgetQty: 85   },
      { code: "EST-CON-05", name: "Encofrado metálico de columnas",    unit: "m2", unitPrice: 65.0, totalBudgetQty: 320  },
      { code: "EST-CON-06", name: "Acero de refuerzo en columnas",     unit: "kg", unitPrice: 5.8,  totalBudgetQty: 6200 },
      { code: "EST-CON-07", name: "Concreto f'c=210 en losas y vigas", unit: "m3", unitPrice: 410,  totalBudgetQty: 120  },
      { code: "EST-CON-08", name: "Encofrado de vigas y losas",        unit: "m2", unitPrice: 55.0, totalBudgetQty: 580  },
      { code: "EST-CON-09", name: "Acero de refuerzo en vigas y losas",unit: "kg", unitPrice: 5.8,  totalBudgetQty: 8800 }
    ],
    "ARQ-ACAB": [
      { code: "ARQ-ACAB-01", name: "Muros de ladrillo King Kong",       unit: "m2", unitPrice: 75.0, totalBudgetQty: 1100 },
      { code: "ARQ-ACAB-02", name: "Tarrajeo frotachado interiores",   unit: "m2", unitPrice: 22.0, totalBudgetQty: 2400 },
      { code: "ARQ-ACAB-03", name: "Tarrajeo fino en cielorrasos",     unit: "m2", unitPrice: 26.0, totalBudgetQty: 850  },
      { code: "ARQ-ACAB-04", name: "Contrapiso de concreto e=2\"",     unit: "m2", unitPrice: 24.0, totalBudgetQty: 850  },
      { code: "ARQ-ACAB-05", name: "Instalación de piso porcelanato",  unit: "m2", unitPrice: 85.0, totalBudgetQty: 800  },
      { code: "ARQ-ACAB-06", name: "Pintura látex en muros y columnas",unit: "m2", unitPrice: 12.0, totalBudgetQty: 2400 },
      { code: "ARQ-ACAB-07", name: "Puertas contraplacadas de cedro",  unit: "und",unitPrice: 450,  totalBudgetQty: 32   },
      { code: "ARQ-ACAB-08", name: "Ventanas de vidrio templado 8mm",  unit: "m2", unitPrice: 220,  totalBudgetQty: 110  }
    ],
    "INS-SAN": [
      { code: "INS-SAN-01", name: "Redes de desagüe PVC 4\"",          unit: "m",  unitPrice: 42.0, totalBudgetQty: 320  },
      { code: "INS-SAN-02", name: "Tubería de agua fría y caliente",   unit: "m",  unitPrice: 35.0, totalBudgetQty: 450  },
      { code: "INS-SAN-03", name: "Tuberías PVC luz empotradas",       unit: "m",  unitPrice: 18.0, totalBudgetQty: 950  },
      { code: "INS-SAN-04", name: "Cableado eléctrico cobre NH-80",    unit: "m",  unitPrice: 6.5,  totalBudgetQty: 2800 },
      { code: "INS-SAN-05", name: "Montaje de aparatos sanitarios",    unit: "jgo",unitPrice: 950,  totalBudgetQty: 18   }
    ]
  };

  // PV diario por partida (cantidades planificadas distribuidas)
  // Se genera como fracción del total presupuestado entre los días activos
  const pvSchedule = generarPVDiario(CHAPTERS, EDT_ITEMS);

  // ─── 3. CATÁLOGO DE RECURSOS (BD_RRHH + BD_Almacen) ────────────────────
  const RESOURCES = {
    "LH-CAP": { name: "Capataz de Edificación",       type: "mano_obra",  unit: "Hora Hombre", cost: 28.0 },
    "LH-OPE": { name: "Operario de Obra Civil",       type: "mano_obra",  unit: "Hora Hombre", cost: 22.5 },
    "LH-OFI": { name: "Oficial de Obra Civil",        type: "mano_obra",  unit: "Hora Hombre", cost: 18.0 },
    "LH-PEO": { name: "Peón de Construcción",         type: "mano_obra",  unit: "Hora Hombre", cost: 14.5 },
    "LH-SUP": { name: "Supervisor SST (Prevencionista)",type: "mano_obra",unit: "Hora Hombre", cost: 35.0 },
    "MAT-CEM":{ name: "Cemento Portland Tipo I",      type: "material",   unit: "Bolsa",       cost: 24.5 },
    "MAT-ACE":{ name: "Acero corrugado fy=4200",      type: "material",   unit: "kg",          cost: 4.8  },
    "MAT-ARE":{ name: "Arena gruesa para mezclas",    type: "material",   unit: "m3",          cost: 65.0 },
    "MAT-PIE":{ name: "Piedra chancada de 1/2\"",     type: "material",   unit: "m3",          cost: 72.0 },
    "MAT-LAD":{ name: "Ladrillo KK arcilla 18 huecos",type: "material",   unit: "Millar",      cost: 850  },
    "MAT-POR":{ name: "Porcelanato pulido 60x60cm",   type: "material",   unit: "m2",          cost: 45.0 },
    "MAT-PUE":{ name: "Puerta contraplacada cedro",   type: "material",   unit: "und",         cost: 350  },
    "MAT-VID":{ name: "Vidrio templado e=8mm",        type: "material",   unit: "m2",          cost: 150  },
    "MAT-DES":{ name: "Tubería PVC sanitaria 4\"",    type: "material",   unit: "m",           cost: 12.5 },
    "MAT-AGU":{ name: "Tubería PVC agua fría 1/2\"",  type: "material",   unit: "m",           cost: 8.5  },
    "EQ-MEZ": { name: "Mezcladora de concreto 9p3",   type: "equipo",     unit: "Hora Máquina", cost: 15.0 },
    "EQ-VIB": { name: "Vibradora de concreto 2\"",    type: "equipo",     unit: "Hora Máquina", cost: 8.5  },
    "EQ-RET": { name: "Retroexcavadora CAT 320",      type: "equipo",     unit: "Hora Máquina", cost: 55.0 },
    "EQ-VOL": { name: "Camión Volquete Volvo 15m3",   type: "equipo",     unit: "Hora Máquina", cost: 42.0 },
    "EQ-AND": { name: "Andamio multidireccional",      type: "equipo",     unit: "Día",         cost: 6.0  }
  };

  // Plantilla de recursos por capítulo
  const MO_TEMPLATE = {
    "OBR-PRE":  ["LH-CAP","LH-OPE","LH-PEO"],
    "MOV-TIE":  ["LH-CAP","LH-OPE","LH-PEO"],
    "EST-CON":  ["LH-CAP","LH-OPE","LH-OFI","LH-PEO"],
    "ARQ-ACAB": ["LH-CAP","LH-OFI","LH-PEO"],
    "INS-SAN":  ["LH-CAP","LH-OFI","LH-PEO"]
  };
  const MAT_TEMPLATE = {
    "OBR-PRE":  [{id:"MAT-CEM", qtyF:()=>rng(2,8)}],
    "MOV-TIE":  [],
    "EST-CON":  [{id:"MAT-CEM",qtyF:()=>rng(10,60)},{id:"MAT-ACE",qtyF:()=>rng(100,400)},{id:"MAT-ARE",qtyF:()=>rng(1,4)},{id:"MAT-PIE",qtyF:()=>rng(1,4)}],
    "ARQ-ACAB": [{id:"MAT-LAD",qtyF:()=>rng(0.5,2.5)},{id:"MAT-CEM",qtyF:()=>rng(5,20)},{id:"MAT-POR",qtyF:()=>rng(15,50)}],
    "INS-SAN":  [{id:"MAT-DES",qtyF:()=>rng(10,30)},{id:"MAT-AGU",qtyF:()=>rng(10,30)}]
  };
  const EQ_TEMPLATE = {
    "OBR-PRE":  [{id:"EQ-RET",qtyF:(h)=>h*rng(0.3,0.6)}],
    "MOV-TIE":  [{id:"EQ-RET",qtyF:(h)=>h*rng(0.8,1.0)},{id:"EQ-VOL",qtyF:(h)=>h*rng(0.5,0.8)}],
    "EST-CON":  [{id:"EQ-MEZ",qtyF:(h)=>h*rng(0.7,1.0)},{id:"EQ-VIB",qtyF:(h)=>h*rng(0.6,0.9)}],
    "ARQ-ACAB": [{id:"EQ-AND",qtyF:()=>rng(2,6)}],
    "INS-SAN":  []
  };

  // ─── 4. HELPER FUNCTIONS ──────────────────────────────────────────────────
  function rng(min, max) {
    return min + Math.random() * (max - min);
  }
  function rngInt(min, max) {
    return Math.round(min + Math.random() * (max - min));
  }
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function formatDate(dayIndex) {
    const d = new Date(2026, 5, 1 + dayIndex); // Jun 1 = day 0
    return Utilities.formatDate(d, "GMT-5", "yyyy-MM-dd");
  }

  const weatherPool = [
    {am:"Soleado", pm:"Soleado"},
    {am:"Soleado", pm:"Nublado"},
    {am:"Nublado", pm:"Nublado"},
    {am:"Nublado", pm:"Lluvia"},
    {am:"Soleado", pm:"Soleado"}
  ];

  function getDayScenario(dayIndex) {
    if (dayIndex === 6)  return "rain";      // Jun 7: lluvia
    if (dayIndex === 11) return "incident";  // Jun 12: incidente
    if (dayIndex === 17) return "strike";    // Jun 18: paro
    if (dayIndex === 21) return "high";      // Jun 22: alta prod.
    return "normal";
  }

  function getPerfFactor(dayIndex, totalDays) {
    const pct = dayIndex / totalDays;
    if (pct < 0.15) return 0.85 + Math.random() * 0.15;
    if (pct < 0.50) return 0.90 + Math.random() * 0.20;
    if (pct < 0.85) return 0.93 + Math.random() * 0.12;
    return 0.88 + Math.random() * 0.12;
  }

  function isChapterActive(chapterCode, dayIndex) {
    const ch = CHAPTERS[chapterCode];
    return dayIndex >= ch.startDay && dayIndex <= ch.endDay;
  }

  // ─── 5. GENERAR PV DIARIO POR PARTIDA ──────────────────────────────────
  function generarPVDiario(chapters, edtItems) {
    const schedule = {};
    for (let day = 0; day < 30; day++) {
      const dateStr = formatDate(day);
      schedule[dateStr] = {};
      for (const chCode of CHAPTER_ORDER) {
        if (!isChapterActive(chCode, day)) continue;
        const items = edtItems[chCode] || [];
        for (const item of items) {
          const ch = chapters[chCode];
          const totalDays = ch.endDay - ch.startDay + 1;
          const qtyPerDay = item.totalBudgetQty / totalDays;
          schedule[dateStr][item.code] = Math.round(qtyPerDay * 100) / 100;
        }
      }
    }
    return schedule;
  }

  // ─── 6. GENERAR DATOS SINTÉTICOS ──────────────────────────────────────────
  const TOTAL_DAYS = 30;

  const rowsProduccion = [];
  const rowsSeguridad = [];
  const rowsActividades = [];
  const rowsRecursos = [];

  let reportCounter = 1;

  for (let day = 0; day < TOTAL_DAYS; day++) {
    const dateStr = formatDate(day);
    const scenario = getDayScenario(day);
    const perfFactor = getPerfFactor(day, TOTAL_DAYS);

    // Condiciones del día según escenario
    let weatherAM, weatherPM, effectiveHours, conflictsText, nextDayText, obsText;
    switch (scenario) {
      case "rain":
        weatherAM="Nublado"; weatherPM="Lluvia"; effectiveHours=4;
        conflictsText="Lluvia intensa en la tarde. Trabajos suspendidos desde las 14:00.";
        nextDayText="Recuperación de jornada. Trabajos planificados en Estructuras.";
        obsText="Paralización parcial por condiciones climáticas adversas.";
        break;
      case "incident":
        weatherAM="Soleado"; weatherPM="Nublado"; effectiveHours=7;
        conflictsText="Incidente leve: resbalón de peón en zona de excavación. Atención en primeros auxilios.";
        nextDayText="Charla de seguridad reforzada. Continuar con acero de columnas.";
        obsText="Se reportó incidente sin baja laboral. Se reforzaron medidas de seguridad.";
        break;
      case "strike":
        weatherAM="Soleado"; weatherPM="Soleado"; effectiveHours=5;
        conflictsText="Paro de 2 horas por reunión sindical. Menor rendimiento en la jornada.";
        nextDayText="Normalización de actividades. Se programarán horas extras compensatorias.";
        obsText="Retraso por medida de fuerza gremial.";
        break;
      case "high":
        weatherAM="Soleado"; weatherPM="Soleado"; effectiveHours=10;
        conflictsText="Ninguno. Jornada extendida autorizada para recuperar cronograma.";
        nextDayText="Continuar con instalación de pisos y acabados.";
        obsText="Alta productividad. Se superó la meta diaria en acabados.";
        break;
      default:
        const w = pickRandom(weatherPool);
        weatherAM=w.am; weatherPM=w.pm;
        effectiveHours=weatherPM==="Lluvia"?6:8;
        conflictsText="Sin restricciones mayores.";
        nextDayText="Continuar con actividades programadas según plan de obra.";
        obsText="Jornada normal. Avance conforme al programa.";
    }

    // Personal total para seguridad
    let totalStaffAll = 0;

    // ── Reportes de PRODUCCIÓN por capítulo activo ──
    for (const chCode of CHAPTER_ORDER) {
      if (!isChapterActive(chCode, day)) continue;

      const chName = CHAPTERS[chCode].name;
      const chapterItems = EDT_ITEMS[chCode] || [];
      const dayPV = pvSchedule[dateStr] || {};

      const actividades = [];
      for (const item of chapterItems) {
        const planned = dayPV[item.code] || 0;
        if (planned <= 0) continue;
        const executed = Math.round(planned * perfFactor * (0.85 + Math.random() * 0.30) * 100) / 100;
        actividades.push([
          item.code,
          item.name,
          item.unit,
          planned,
          Math.max(0, executed),
          pickRandom(["Trabajo conforme a especificaciones.","Avance normal sin observaciones.","Cuadrilla completa rindiendo según programa.","Supervisión aprobó los trabajos."])
        ]);
      }
      if (actividades.length === 0) continue;

      const reportId = "REP-SYN-" + String(reportCounter).padStart(4, "0");
      reportCounter++;

      // Personal base según capítulo
      const baseStaff = chCode==="OBR-PRE"?8:chCode==="MOV-TIE"?12:chCode==="EST-CON"?25:chCode==="ARQ-ACAB"?20:10;
      const totalStaff = Math.round(baseStaff * (0.8 + Math.random() * 0.4));
      totalStaffAll += totalStaff;

      // Mano de obra
      const moIds = MO_TEMPLATE[chCode] || ["LH-CAP","LH-PEO"];
      const manoObra = moIds.map(id => [
        id,
        RESOURCES[id].name,
        Math.max(1, Math.round(rng(1,4))),
        Math.round(effectiveHours * rng(0.9, 1.1)),
        chCode
      ]);

      // Materiales
      const matTpl = MAT_TEMPLATE[chCode] || [];
      const materials = matTpl.map(m => [
        m.id,
        RESOURCES[m.id].name,
        Math.round(m.qtyF() * 100) / 100,
        chCode
      ]);

      // Equipos
      const eqTpl = EQ_TEMPLATE[chCode] || [];
      const equipos = eqTpl.map(e => [
        e.id,
        RESOURCES[e.id].name,
        Math.round(e.qtyF(effectiveHours) * 100) / 100,
        chCode
      ]);

      // Fila: Producción
      rowsProduccion.push([
        reportId, dateStr, chCode, PROJECT.manager, "Mañana",
        effectiveHours, weatherAM, weatherPM, totalStaff,
        conflictsText, nextDayText, obsText,
        actividades.length, manoObra.length, materials.length, equipos.length
      ]);

      // Filas: Actividades (una por partida)
      for (const a of actividades) {
        rowsActividades.push([reportId, dateStr, chCode, a[0], a[1], a[2], a[3], a[4], a[5]]);
      }

      // Filas: Recursos
      for (const mo of manoObra) {
        rowsRecursos.push([reportId, dateStr, chCode, "Mano de Obra", mo[0], mo[1], mo[2] * mo[3], "Hora Hombre", RESOURCES[mo[0]].cost]);
      }
      for (const mat of materials) {
        rowsRecursos.push([reportId, dateStr, chCode, "Material", mat[0], mat[1], mat[2], RESOURCES[mat[0]].unit, RESOURCES[mat[0]].cost]);
      }
      for (const eq of equipos) {
        rowsRecursos.push([reportId, dateStr, chCode, "Equipo", eq[0], eq[1], eq[2], RESOURCES[eq[0]].unit, RESOURCES[eq[0]].cost]);
      }
    }

    // ── Reporte de SEGURIDAD (1 por día) ──
    const safetyId = "REP-SYN-S-" + String(day + 1).padStart(3, "0");
    let safetyDetails = "Charla de 5 minutos dictada. Inspección de EPPs y áreas de trabajo conforme.";
    let incidents = "Ninguno";
    if (scenario === "incident") {
      safetyDetails = "Charla de seguridad reforzada post-incidente. Se revisaron protocolos.";
      incidents = "Resbalón de peón en rampa de acceso. Atención en primeros auxilios. Sin baja laboral.";
    }

    rowsSeguridad.push([
      safetyId, dateStr, PROJECT.manager, "Mañana",
      effectiveHours, weatherAM, weatherPM, totalStaffAll || rngInt(8, 15),
      "Sí", safetyDetails, incidents,
      conflictsText, "Reporte integral de seguridad - " + obsText
    ]);
  }

  // ─── 7. ESCRIBIR EN GOOGLE SHEETS ──────────────────────────────────────────
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Crear pestañas NUEVAS primero (para tener hojas de respaldo)
  const tabProduccion = ss.insertSheet("Producción");
  const tabSeguridad = ss.insertSheet("Seguridad");
  const tabActividades = ss.insertSheet("Actividades");
  const tabRecursos = ss.insertSheet("Recursos");

  // Luego eliminar pestañas antiguas duplicadas (sobran las recién creadas)
  const existingTabs = ["Producción","Seguridad","Actividades","Recursos"];
  for (const tab of existingTabs) {
    const sheets = ss.getSheets().filter(s => s.getName() === tab);
    // Dejar solo la primera (la recién creada), eliminar las demás
    for (let i = 1; i < sheets.length; i++) {
      ss.deleteSheet(sheets[i]);
    }
  }

  // Encabezados
  const HEADERS = {
    Produccion: ["ReportID","Fecha","Capítulo","Supervisor","Turno","HorasEfectivas","ClimaAM","ClimaPM","PersonalTotal","Conflictos","PlanPróximoDía","Observaciones","NumActividades","NumMO","NumMateriales","NumEquipos"],
    Seguridad:  ["ReportID","Fecha","Supervisor","Turno","HorasEfectivas","ClimaAM","ClimaPM","PersonalTotal","InspecciónRealizada","DetallesSeguridad","Incidentes","Conflictos","Observaciones"],
    Actividades:["ReportID","Fecha","Capítulo","CódigoEDT","Actividad","Unidad","CantidadPlanificada","CantidadEjecutada","Notas"],
    Recursos:   ["ReportID","Fecha","Capítulo","TipoRecurso","CódigoRecurso","Recurso","Cantidad","Unidad","CostoUnitario"]
  };

  function escribirSheet(sheet, headers, rows) {
    const data = [headers, ...rows];
    const range = sheet.getRange(1, 1, data.length, headers.length);
    range.setValues(data);
    // Formato: negrita en encabezados
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    // Ajustar ancho de columnas automáticamente
    for (let col = 0; col < headers.length; col++) {
      sheet.autoResizeColumn(col + 1);
    }
  }

  escribirSheet(tabProduccion, HEADERS.Produccion, rowsProduccion);
  escribirSheet(tabSeguridad, HEADERS.Seguridad, rowsSeguridad);
  escribirSheet(tabActividades, HEADERS.Actividades, rowsActividades);
  escribirSheet(tabRecursos, HEADERS.Recursos, rowsRecursos);

  // Mover pestañas al inicio en orden
  ss.setActiveSheet(tabProduccion);
  ss.moveActiveSheet(1);
  ss.setActiveSheet(tabSeguridad);
  ss.moveActiveSheet(2);
  ss.setActiveSheet(tabActividades);
  ss.moveActiveSheet(3);
  ss.setActiveSheet(tabRecursos);
  ss.moveActiveSheet(4);

  // ─── 8. RESUMEN ────────────────────────────────────────────────────────────
  const totalProd = rowsProduccion.length;
  const totalSeg = rowsSeguridad.length;
  const totalAct = rowsActividades.length;
  const totalRec = rowsRecursos.length;

  const msg = `✅ Base de datos sintética generada exitosamente.\n\n` +
    `📊 Resumen:\n` +
    `• Producción: ${totalProd} reportes\n` +
    `• Seguridad: ${totalSeg} reportes\n` +
    `• Actividades: ${totalAct} registros\n` +
    `• Recursos: ${totalRec} registros\n\n` +
    `📅 Período: 01 Jun 2026 → 30 Jun 2026\n` +
    `🏗️ Proyecto: ${PROJECT.name}\n\n` +
    `Las 4 pestañas han sido creadas y pobladas con datos sintéticos\n` +
    `coherentes con el Plan de Valor Planificado (PV) del proyecto.`;

  SpreadsheetApp.getUi().alert(msg);
}
