import React, { useState } from "react";
import { Clipboard, ClipboardList, Check, Server, Eye } from "lucide-react";

export function GoogleScriptDocs() {
  const [copied, setCopied] = useState(false);

  const googleAppsScriptCode = `/**
 * =========================================================================
 * REPORTE DIARIO DE OBRA (RDO) - MICROSERVICIO BIDIRECCIONAL EN GOOGLE SHEETS
 * =========================================================================
 * Desarrollado para registrar reportes en Google Sheets y leerlos en tiempo real
 * para el Dashboard de PC.
 * Soporta las 4 pestañas reales: R_Produccion, R_Seguridad, Detalle_Actividades y Detalle_Recursos.
 */

// 1. CONTROL DE CONSULTAS (HTTP GET): Obtiene los reportes para el Dashboard
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var sheetProd = ss.getSheetByName("R_Produccion");
  var sheetSeg = ss.getSheetByName("R_Seguridad");
  var sheetAct = ss.getSheetByName("Detalle_Actividades");
  var sheetRec = ss.getSheetByName("Detalle_Recursos");
  
  var reportsMap = {};
  
  // A. Leer cabeceras de R_Produccion (Producción de Obra)
  if (sheetProd) {
    var data = sheetProd.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = row[0];
      if (!id) continue;
      
      reportsMap[id] = {
        id: id,
        projectCode: "MFG-01", // Proyecto único
        createdAt: row[1],
        date: formatDateString(row[2]),
        supervisor: row[3],
        shift: row[4],
        weatherMorning: row[5],
        weatherAfternoon: row[6],
        effectiveHours: Number(row[7]) || 8,
        chapterWbsId: row[8] || "",
        chapterWbsName: row[9] || "",
        conflicts: row[10] || "",
        plannedNextDay: row[11] || "",
        generalNotes: row[12] || "",
        activities: [],
        manoObra: [],
        materials: [],
        equipos: [],
        totalStaff: 0,
        safetyInspected: false,
        safetyDetails: "",
        incidents: ""
      };
    }
  }
  
  // B. Leer cabeceras de R_Seguridad (HSE y Personal)
  if (sheetSeg) {
    var data = sheetSeg.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = row[0];
      if (!id) continue;
      
      var r = reportsMap[id];
      if (!r) {
        r = {
          id: id,
          projectCode: "MFG-01",
          createdAt: row[1],
          date: formatDateString(row[2]),
          supervisor: row[3],
          shift: row[4],
          weatherMorning: row[5],
          weatherAfternoon: row[6],
          effectiveHours: 0,
          chapterWbsId: "",
          chapterWbsName: "",
          conflicts: "",
          plannedNextDay: "",
          generalNotes: row[11] || "",
          activities: [],
          manoObra: [],
          materials: [],
          equipos: []
        };
        reportsMap[id] = r;
      }
      
      r.totalStaff = Number(row[7]) || 0;
      r.safetyInspected = (row[8] === "SÍ");
      r.safetyDetails = row[9] || "";
      r.incidents = row[10] || "";
    }
  }
  
  // C. Leer detalle de actividades de Detalle_Actividades
  if (sheetAct) {
    var data = sheetAct.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = row[0];
      if (!id) continue;
      
      var r = reportsMap[id];
      if (r) {
        r.activities.push({
          edtCode: row[4],
          name: row[5] || "",
          unit: row[6] || "",
          plannedQty: Number(row[7]) || 0,
          qtyExecuted: Number(row[8]) || 0,
          notes: row[10] || ""
        });
      }
    }
  }
  
  // D. Leer recursos de Detalle_Recursos
  if (sheetRec) {
    var data = sheetRec.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = row[0];
      if (!id) continue;
      
      var r = reportsMap[id];
      if (r) {
        var tipo = row[3]; // mano_obra, material, equipo
        var wbsId = row[4];
        var resId = row[5];
        var desc = row[6] || "";
        var unit = row[8] || "";
        var qty = Number(row[9]) || 0;
        
        if (tipo === "mano_obra") {
          r.manoObra.push({
            resourceId: resId,
            name: desc,
            hoursWorked: qty,
            edtGroupCode: wbsId
          });
        } else if (tipo === "material") {
          r.materials.push({
            resourceId: resId,
            name: desc,
            qtyConsumed: qty,
            unit: unit,
            edtGroupCode: wbsId
          });
        } else if (tipo === "equipo") {
          r.equipos.push({
            resourceId: resId,
            name: desc,
            qtyUsed: qty,
            unit: unit,
            edtGroupCode: wbsId
          });
        }
      }
    }
  }
  
  var list = [];
  for (var k in reportsMap) {
    list.push(reportsMap[k]);
  }
  
  // Ordenar de más antiguo a más nuevo
  list.sort(function(a, b) {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
  
  var jsonStr = JSON.stringify(list);
  var response = HtmlService.createHtmlOutput(jsonStr);
  response.setHeader("Access-Control-Allow-Origin", "*");
  return response;
}

// Helper: Formatea celdas de fechas a string limpio YYYY-MM-DD
function formatDateString(val) {
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = val.getMonth() + 1;
    var d = val.getDate();
    return y + "-" + (m < 10 ? '0' + m : m) + "-" + (d < 10 ? '0' + d : d);
  }
  if (typeof val === "string" && val.indexOf("T") !== -1) {
    return val.split("T")[0];
  }
  return String(val);
}

// 2. RECEPCIÓN DE ENVÍOS (HTTP POST): Guarda nuevos registros
function doPost(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    var jsonString = e.postData.contents;
    var payload = JSON.parse(jsonString);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var sheetProd = inicializarHoja(ss, "R_Produccion", [
      "ID Reporte", "Fecha Envío", "Fecha Reporte", "Supervisor/Ingeniero", "Turno", 
      "Clima Mañana", "Clima Tarde", "Horas Efectivas", "Capítulo WBS ID", "Capítulo WBS Nombre", 
      "Conflictos/Restricciones", "Trabajos Mañana", "Observaciones Generales"
    ]);
    
    var sheetSeg = inicializarHoja(ss, "R_Seguridad", [
      "ID Reporte", "Fecha Envío", "Fecha Reporte", "Supervisor/Ingeniero", "Turno", 
      "Clima Mañana", "Clima Tarde", "Personal Total en Obra", "Inspecciones Realizadas", 
      "Detalle Inspecciones", "Accidentes/Incidentes", "Observaciones Generales"
    ]);
    
    var sheetAct = inicializarHoja(ss, "Detalle_Actividades", [
      "ID Reporte", "Fecha Reporte", "Supervisor/Ingeniero", "Capítulo WBS ID", "Actividad WBS ID", 
      "Nombre Actividad", "Unidad", "Meta del Día", "Cantidad Ejecutada", "Avance Estimado", "Observación/Comentario"
    ]);
    
    var sheetRec = inicializarHoja(ss, "Detalle_Recursos", [
      "ID Reporte", "Fecha Reporte", "Supervisor/Ingeniero", "Tipo Recurso", "Capítulo WBS ID", 
      "ID Recurso", "Descripción Recurso", "Categoría/Detalle", "Unidad", "Cantidad Registrada"
    ]);

    var now = new Date();
    var format = function(num) { return num < 10 ? '0' + num : num; };
    var idReporte = payload.id || ("REP-MFG-" + now.getFullYear() + format(now.getMonth() + 1) + format(now.getDate()) + 
                    "-" + format(now.getHours()) + format(now.getMinutes()) + format(now.getSeconds()));

    // Obtener capítulo desde el payload (edtChapter) o derivar de actividades
    var chapterId = payload.edtChapter || "";
    var chapterName = "";
    var chapterMap = {
      "OBR-PRE":"Obras Preliminares y Provisionales","MOV-TIE":"Movimiento de Tierras",
      "EST-CON":"Estructuras de Concreto","ARQ-ACAB":"Arquitectura y Acabados",
      "INS-SAN":"Instalaciones Sanitarias y Eléctricas",
      "EST":"Estructuras","ARQ":"Arquitectura","MEP":"Instalaciones MEP"
    };
    if (chapterId) chapterName = chapterMap[chapterId] || chapterId;

    if (payload.reportType === "seguridad" || payload.reportType === "safety") {
      sheetSeg.appendRow([
        idReporte,
        now.toISOString(),
        payload.date,
        payload.supervisor,
        payload.shift,
        payload.weatherMorning,
        payload.weatherAfternoon,
        payload.totalStaff || 0,
        payload.safetyInspected ? "SÍ" : "NO",
        payload.safetyDetails || "",
        payload.incidents || "",
        payload.generalNotes || ""
      ]);
    } else {
      sheetProd.appendRow([
        idReporte,
        now.toISOString(),
        payload.date,
        payload.supervisor,
        payload.shift,
        payload.weatherMorning,
        payload.weatherAfternoon,
        payload.effectiveHours || 8,
        chapterId,
        chapterName,
        payload.conflicts || "",
        payload.plannedNextDay || "",
        payload.generalNotes || ""
      ]);

      if (payload.activities && payload.activities.length > 0) {
        payload.activities.forEach(function(act) {
          sheetAct.appendRow([
            idReporte,
            payload.date,
            payload.supervisor,
            chapterId,
            act.edtCode,
            act.name || "",
            act.unit || "",
            act.plannedQty || 0,
            act.qtyExecuted,
            "",
            act.notes || ""
          ]);
        });
      }

      if (payload.manoObra && payload.manoObra.length > 0) {
        payload.manoObra.forEach(function(mo) {
          sheetRec.appendRow([
            idReporte,
            payload.date,
            payload.supervisor,
            "mano_obra",
            mo.edtGroupCode,
            mo.resourceId,
            mo.name || "",
            "Horas Trabajadas",
            "H-H",
            mo.hoursWorked
          ]);
        });
      }

      if (payload.materials && payload.materials.length > 0) {
        payload.materials.forEach(function(mat) {
          sheetRec.appendRow([
            idReporte,
            payload.date,
            payload.supervisor,
            "material",
            mat.edtGroupCode,
            mat.resourceId,
            mat.name || "",
            "Consumo Material",
            mat.unit || "",
            mat.qtyConsumed
          ]);
        });
      }

      if (payload.equipos && payload.equipos.length > 0) {
        payload.equipos.forEach(function(eq) {
          sheetRec.appendRow([
            idReporte,
            payload.date,
            payload.supervisor,
            "equipo",
            eq.edtGroupCode,
            eq.resourceId,
            eq.name || "",
            "Uso de Equipo",
            eq.unit || "",
            eq.qtyUsed
          ]);
        });
      }
    }

    var responseOutput = ContentService.createTextOutput(JSON.stringify({
      status: "success",
      reportId: idReporte,
      message: "Reporte guardado correctamente en Google Sheets"
    }));
    responseOutput.setMimeType(ContentService.MimeType.JSON);
    return responseOutput;

  } catch (error) {
    var responseOutput = ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    }));
    responseOutput.setMimeType(ContentService.MimeType.JSON);
    return responseOutput;
  }
}

// 3. UTILITY GENERATOR: Crea 20 días de datos sintéticos continuos para pruebas
function generarDatosSinteticos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var sheetProd = inicializarHoja(ss, "R_Produccion", [
    "ID Reporte", "Fecha Envío", "Fecha Reporte", "Supervisor/Ingeniero", "Turno", 
    "Clima Mañana", "Clima Tarde", "Horas Efectivas", "Capítulo WBS ID", "Capítulo WBS Nombre", 
    "Conflictos/Restricciones", "Trabajos Mañana", "Observaciones Generales"
  ]);
  
  var sheetSeg = inicializarHoja(ss, "R_Seguridad", [
    "ID Reporte", "Fecha Envío", "Fecha Reporte", "Supervisor/Ingeniero", "Turno", 
    "Clima Mañana", "Clima Tarde", "Personal Total en Obra", "Inspecciones Realizadas", 
    "Detalle Inspecciones", "Accidentes/Incidentes", "Observaciones Generales"
  ]);
  
  var sheetAct = inicializarHoja(ss, "Detalle_Actividades", [
    "ID Reporte", "Fecha Reporte", "Supervisor/Ingeniero", "Capítulo WBS ID", "Actividad WBS ID", 
    "Nombre Actividad", "Unidad", "Meta del Día", "Cantidad Ejecutada", "Avance Estimado", "Observación/Comentario"
  ]);
  
  var sheetRec = inicializarHoja(ss, "Detalle_Recursos", [
    "ID Reporte", "Fecha Reporte", "Supervisor/Ingeniero", "Tipo Recurso", "Capítulo WBS ID", 
    "ID Recurso", "Descripción Recurso", "Categoría/Detalle", "Unidad", "Cantidad Registrada"
  ]);
  
  // Limpiar datos anteriores (excepto cabeceras)
  if (sheetProd.getLastRow() > 1) sheetProd.getRange(2, 1, sheetProd.getLastRow() - 1, sheetProd.getLastColumn()).clearContent();
  if (sheetSeg.getLastRow() > 1) sheetSeg.getRange(2, 1, sheetSeg.getLastRow() - 1, sheetSeg.getLastColumn()).clearContent();
  if (sheetAct.getLastRow() > 1) sheetAct.getRange(2, 1, sheetAct.getLastRow() - 1, sheetAct.getLastColumn()).clearContent();
  if (sheetRec.getLastRow() > 1) sheetRec.getRange(2, 1, sheetRec.getLastRow() - 1, sheetRec.getLastColumn()).clearContent();
  
  var baseDate = new Date(2026, 4, 15); // 15 de Mayo de 2026
  
  for (var day = 0; day < 20; day++) {
    var currentDate = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000);
    var dateString = currentDate.getFullYear() + "-" + 
                     ((currentDate.getMonth() + 1) < 10 ? "0" + (currentDate.getMonth() + 1) : (currentDate.getMonth() + 1)) + "-" + 
                     (currentDate.getDate() < 10 ? "0" + currentDate.getDate() : currentDate.getDate());
    
    var idReporte = "REP-MFG-" + dateString.replace(/-/g, "");
    var supervisor = "Ing. Alejandro Rivas";
    var shift = "Mañana";
    
    var weatherMorning = "Soleado";
    var weatherAfternoon = "Nublado";
    var effectiveHours = 8;
    var conflicts = "Ninguno";
    var observations = "Avances conformes al programa diario de obra.";
    
    // Simular retraso por lluvia extrema en el Día 6
    if (day === 5) {
      weatherMorning = "Nublado";
      weatherAfternoon = "Lluvia";
      effectiveHours = 4;
      conflicts = "Lluvia torrencial en la tarde. Se paralizaron trabajos a las 14:00.";
      observations = "Parada parcial por tormenta. Personal evacuado a refugios.";
    } 
    // Simular horas extras de recuperación en los Días 7 al 12
    else if (day >= 6 && day <= 11) {
      effectiveHours = 9.5;
      conflicts = "Jornada extendida autorizada.";
      observations = "Se trabajaron 1.5 horas extras para recuperar avance de estructuras.";
    }
    
    var chapterWbsId = (day < 12) ? "EST" : "ARQ";
    var chapterWbsName = (day < 12) ? "Estructuras" : "Arquitectura";
    
    // A. Registrar Producción
    sheetProd.appendRow([
      idReporte,
      new Date().toISOString(),
      dateString,
      supervisor,
      shift,
      weatherMorning,
      weatherAfternoon,
      effectiveHours,
      chapterWbsId,
      chapterWbsName,
      conflicts,
      "Preparar encofrado y control de calidad de materiales.",
      observations
    ]);
    
    // B. Registrar Seguridad (HSE)
    var totalStaff = Math.round(18 + Math.random() * 8);
    if (day >= 6 && day <= 11) totalStaff += 4; // Más operarios para horas extras
    
    var hseInspected = true;
    var hseDetails = "Inspección de EPPs y arneses conforme.";
    var safetyIncident = "Ninguno";
    
    if (day === 10) { // Día 11: Incidente leve
      hseDetails = "Revisión de cables de andamio con observaciones menores.";
      safetyIncident = "Resbalón de peón en rampa de acceso, atendido por primeros auxilios. Sin baja laboral.";
    }
    
    sheetSeg.appendRow([
      idReporte,
      new Date().toISOString(),
      dateString,
      supervisor,
      shift,
      weatherMorning,
      weatherAfternoon,
      totalStaff,
      hseInspected ? "SÍ" : "NO",
      hseDetails,
      safetyIncident,
      "Charlas de 5 minutos sobre orden y limpieza enfocadas en lodos."
    ]);
    
    // C. Registrar Actividades Ejecutadas
    if (day < 5) {
      sheetAct.appendRow([idReporte, dateString, supervisor, "EST", "EST-01", "Obras Provisionales y Preliminares", "m2", 20, 15, "", "Habilitación de almacenes"]);
      sheetAct.appendRow([idReporte, dateString, supervisor, "EST", "EST-02", "Movimiento de Tierras - Excavación", "m3", 100, 85, "", "Excavación masiva de zanjas"]);
    } else if (day === 5) { // Día de lluvia: producción baja
      sheetAct.appendRow([idReporte, dateString, supervisor, "EST", "EST-02", "Movimiento de Tierras - Excavación", "m3", 100, 15, "", "Parálisis por anegamiento"]);
    } else if (day >= 6 && day < 12) {
      var colQty = (day === 6 || day === 7) ? 25 : 18;
      var beamQty = (day >= 8) ? 35 : 0;
      sheetAct.appendRow([idReporte, dateString, supervisor, "EST", "EST-03", "Concreto de Columnas y Placas", "m3", 40, colQty, "", "Vaciado continuo de concreto f'c=280"]);
      if (beamQty > 0) {
        sheetAct.appendRow([idReporte, dateString, supervisor, "EST", "EST-04", "Concreto de Vigas y Losas", "m3", 45, beamQty, "", "Encofrado e instalación de acero"]);
      }
    } else { // Fase de Arquitectura
      var wallQty = 120 - (day - 12) * 5;
      var plasterQty = (day >= 15) ? 140 : 0;
      sheetAct.appendRow([idReporte, dateString, supervisor, "ARQ", "ARQ-01", "Muros de Ladrillo KK", "m2", 150, wallQty, "", "Asentado de muros en primer nivel"]);
      if (plasterQty > 0) {
        sheetAct.appendRow([idReporte, dateString, supervisor, "ARQ", "ARQ-02", "Tarrajeo Frotachado Interiores", "m2", 180, plasterQty, "", "Tarrajeo liso en muros internos"]);
      }
    }
    
    // D. Registrar Recursos Consumidos
    // Personal (Mano de Obra)
    sheetRec.appendRow([idReporte, dateString, supervisor, "mano_obra", chapterWbsId, "LH-CAP", "Capataz de Edificación", "Horas Trabajadas", "H-H", effectiveHours]);
    sheetRec.appendRow([idReporte, dateString, supervisor, "mano_obra", chapterWbsId, "LH-OPE", "Operario Civil", "Horas Trabajadas", "H-H", effectiveHours * 4]);
    sheetRec.appendRow([idReporte, dateString, supervisor, "mano_obra", chapterWbsId, "LH-PEO", "Peón de Construcción", "Horas Trabajadas", "H-H", effectiveHours * 8]);
    
    // Materiales y Equipos
    if (day < 5) {
      sheetRec.appendRow([idReporte, dateString, supervisor, "equipo", "EST", "EQ-RET", "Retroexcavadora CAT 320", "Uso de Equipo", "H-M", effectiveHours]);
    } else if (day === 5) {
      sheetRec.appendRow([idReporte, dateString, supervisor, "equipo", "EST", "EQ-RET", "Retroexcavadora CAT 320", "Uso de Equipo", "H-M", 3]);
    } else if (day >= 6 && day < 12) {
      sheetRec.appendRow([idReporte, dateString, supervisor, "equipo", "EST", "EQ-MEZ", "Mezcladora de Trompo", "Uso de Equipo", "H-M", effectiveHours]);
      var cementUsed = (day >= 8) ? 90 : 45;
      sheetRec.appendRow([idReporte, dateString, supervisor, "material", "EST", "MAT-CEM", "Cemento Portland Tipo I", "Consumo Material", "Bolsa", cementUsed]);
    } else { // Arquitectura
      sheetRec.appendRow([idReporte, dateString, supervisor, "material", "ARQ", "MAT-CEM", "Cemento Portland Tipo I", "Consumo Material", "Bolsa", 22]);
      sheetRec.appendRow([idReporte, dateString, supervisor, "material", "ARQ", "MAT-LAD", "Ladrillo KK Arcilla 18H", "Consumo Material", "Millar", 2.1]);
    }
  }
}

// Auxiliar: Asegura la existencia de la hoja y formatea sus encabezados
function inicializarHoja(spreadsheet, nombreHoja, columnas) {
  var sheet = spreadsheet.getSheetByName(nombreHoja);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(nombreHoja);
    sheet.appendRow(columnas);
    
    var headerRange = sheet.getRange(1, 1, 1, columnas.length);
    headerRange.setBackground("#1e293b") // Slate 800 Premium
               .setFontColor("#FFFFFF")
               .setFontWeight("bold")
               .setFontFamily("Arial")
               .setHorizontalAlignment("center");
    
    sheet.setFrozenRows(1);
    for (var i = 1; i <= columnas.length; i++) {
       sheet.autoResizeColumn(i);
    }
  }
  return sheet;
}

// Auxiliar: Busca o crea una carpeta en la raíz de Google Drive
function obtenerOCrearCarpeta(nombre) {
  var folders = DriveApp.getFoldersByName(nombre);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(nombre);
  }
}

// Auxiliar: Convierte un String Base64 a archivo binario de imagen en Drive y devuelve la URL
function guardarImagenBase64(folder, base64String, fileName) {
  try {
    var rawData = base64String.split("base64,")[1];
    var decoded = Utilities.base64Decode(rawData);
    var blob = Utilities.newBlob(decoded, "image/png", fileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://docs.google.com/uc?export=view&id=" + file.getId();
  } catch(e) {
    Logger.log("Error guardando imagen " + fileName + ": " + e.toString());
    return "";
  }
}
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-sky-400" />
            Integración de Base de Datos de Campo
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Sincroniza tus reportes con tu propia hoja de cálculo de Google Sheets y Google Drive de manera directa.
          </p>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 transition text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" /> Copiado
            </>
          ) : (
            <>
              <Clipboard className="w-4 h-4" /> Copiar Código GS
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        <div className="space-y-4">
          <h3 className="font-semibold text-sky-400 flex items-center gap-2 text-base">
            <ClipboardList className="w-4 h-4" /> Paso 1: Configurar Google Sheets
          </h3>
          <ul className="space-y-2 text-xs text-slate-300 list-decimal pl-4">
            <li>Crea una nueva hoja de cálculo vacía en Google Sheets.</li>
            <li>No necesitas crear ninguna pestaña. El código las inicializará con diseño premium en tu primer envío.</li>
            <li>En el menú superior de la hoja, ve a <strong>Extensiones</strong> {">"} <strong>Apps Script</strong>.</li>
            <li>Borra todo el código del editor e instala el código provisto aquí a la derecha.</li>
          </ul>

          <h3 className="font-semibold text-sky-400 flex items-center gap-2 text-base pt-2">
            <Server className="w-4 h-4" /> Paso 2: Desplegar la Web App
          </h3>
          <ul className="space-y-2 text-xs text-slate-300 list-decimal pl-4">
            <li>Dentro de Apps Script, presiona el botón <strong>Implementar</strong> {">"} <strong>Nueva implementación</strong>.</li>
            <li>Selecciona el tipo de implementación: <strong>Aplicación web</strong>.</li>
            <li>Configura:
              <ul className="list-disc pl-4 mt-1 text-slate-400 space-y-1">
                <li>Ejecutar como: <span className="text-sky-300">Yo (tu_correo@gmail.com)</span>.</li>
                <li>Quién tiene acceso: <span className="text-sky-300">Cualquiera</span> (obligatorio para recibir datos desde el celular en obra).</li>
              </ul>
            </li>
            <li>Haz clic en <strong>Implementar</strong>, otorga los permisos necesarios accesando con tu cuenta de Google.</li>
            <li>Copia la <strong>URL de la Aplicación web</strong> generada e introdúcela en la sección de Ajustes del campo de esta App.</li>
          </ul>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 flex flex-col h-[300px]">
          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
            <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              Code.gs (Apps Script)
            </span>
            <span className="text-xxs text-slate-500 uppercase">Javascript GAS</span>
          </div>
          <pre className="font-mono text-[10px] p-4 text-slate-400 overflow-y-auto flex-1 select-all scrollbar-thin">
            {googleAppsScriptCode}
          </pre>
        </div>
      </div>
    </div>
  );
}
