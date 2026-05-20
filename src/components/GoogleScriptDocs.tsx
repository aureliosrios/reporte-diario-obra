import React, { useState } from "react";
import { Clipboard, ClipboardList, Check, Server, Eye } from "lucide-react";

export function GoogleScriptDocs() {
  const [copied, setCopied] = useState(false);

  const googleAppsScriptCode = `/**
 * =========================================================================
 * REPORTE DIARIO DE OBRA (RDO) - MICROSERVICIO BACKEND DE COOPERACIÓN
 * =========================================================================
 * Desarrollado para registrar reportes en Google Sheets y guardar firmas/fotos
 * en Google Drive de forma gratuita e ilimitada.
 * Actuación: Recibe peticiones HTTP POST (JSON Payload).
 */

function doPost(e) {
  // Configuración de cabeceras CORS para permitir llamadas cross-origin
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };

  try {
    // 1. Parsear datos recibidos del formulario móvil
    var jsonString = e.postData.contents;
    var payload = JSON.parse(jsonString);
    
    // 2. Inicializar Libro de Cálculo (Google Sheets) activo
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Inicializar y formatear pestañas necesarias
    var sheetReportes = inicializarHoja(ss, "Reportes", [
      "ID Reporte", "Fecha Envío", "Proyecto Code", "Fecha Reporte", "Supervisor", "Turno", 
      "Horas Efectivas", "Clima Mañana", "Clima Tarde", "Personal Total", "Seguridad OK", 
      "Detalle Seguridad", "Incidentes", "Conflictos", "Plan Próximo Día", "Notas Generales", 
      "Valor Planificado", "Valor Ganado", "Costo Real", "Varianza Plazo (SV)", "Varianza Costo (CV)", 
      "SPI", "CPI", "Enlace Firma", "Foto Avance 1", "Foto Avance 2", "Foto Avance 3", "Foto Avance 4"
    ]);
    
    var sheetActividades = inicializarHoja(ss, "Actividades", [
      "ID Reporte", "Proyecto Code", "Fecha Reporte", "Supervisor", "Código Partida (EDT)", 
      "Cantidad Ejecutada", "Notas / Avances"
    ]);
    
    var sheetMateriales = inicializarHoja(ss, "Materiales", [
      "ID Reporte", "Proyecto Code", "Fecha Reporte", "Supervisor", "Código Material", 
      "Cantidad Consumida", "Capítulo EDT"
    ]);

    var sheetEquipos = inicializarHoja(ss, "Equipos", [
      "ID Reporte", "Proyecto Code", "Fecha Reporte", "Supervisor", "Código Equipo", 
      "Horas/Cantidad Utilizada", "Capítulo EDT"
    ]);

    // 3. Generar ID Único si no existe
    var now = new Date();
    var format = function(num) { return num < 10 ? '0' + num : num; };
    var idReporte = payload.id || ("REP-" + now.getFullYear() + format(now.getMonth() + 1) + format(now.getDate()) + 
                    "-" + format(now.getHours()) + format(now.getMinutes()) + format(now.getSeconds()));

    // 4. Procesamiento de archivos de Firma y Fotos en Google Drive
    var folderName = "Fotos Reportes Obra";
    var parentFolder = obtenerOCrearCarpeta(folderName);
    var reportFolder = parentFolder.createFolder(idReporte);
    reportFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Guardar Firma (Canvas interactivo)
    var enlaceFirma = "";
    if (payload.signatureBase64 && payload.signatureBase64.indexOf("base64,") !== -1) {
      enlaceFirma = guardarImagenBase64(reportFolder, payload.signatureBase64, idReporte + "_firma.png");
    }

    // Guardar Fotos de Avance (hasta 4)
    var enlacesFotos = ["", "", "", ""];
    if (payload.photoBase64s && payload.photoBase64s.length > 0) {
      for (var i = 0; i < Math.min(payload.photoBase64s.length, 4); i++) {
        if (payload.photoBase64s[i] && payload.photoBase64s[i].indexOf("base64,") !== -1) {
          enlacesFotos[i] = guardarImagenBase64(reportFolder, payload.photoBase64s[i], idReporte + "_foto_" + (i + 1) + ".png");
        }
      }
    }

    // 5. Registrar información relacional en la Hoja General de Reportes (Cabecera)
    var mt = payload.metrics || { plannedValue: 0, earnedValue: 0, actualCost: 0, sv: 0, cv: 0, spi: 1, cpi: 1 };
    sheetReportes.appendRow([
      idReporte,
      now.toISOString(),
      payload.projectCode,
      payload.date,
      payload.supervisor,
      payload.shift,
      payload.effectiveHours,
      payload.weatherMorning,
      payload.weatherAfternoon,
      payload.totalStaff,
      payload.safetyInspected ? "SÍ" : "NO",
      payload.safetyDetails || "",
      payload.incidents || "",
      payload.conflicts || "",
      payload.plannedNextDay || "",
      payload.generalNotes || "",
      mt.plannedValue,
      mt.earnedValue,
      mt.actualCost,
      mt.sv,
      mt.cv,
      mt.spi,
      mt.cpi,
      enlaceFirma,
      enlacesFotos[0],
      enlacesFotos[1],
      enlacesFotos[2],
      enlacesFotos[3]
    ]);

    // 6. Registrar detención de actividades (Partidas ejecutadas)
    if (payload.activities && payload.activities.length > 0) {
      payload.activities.forEach(function(act) {
        sheetActividades.appendRow([
          idReporte,
          payload.projectCode,
          payload.date,
          payload.supervisor,
          act.edtCode,
          act.qtyExecuted,
          act.notes || ""
        ]);
      });
    }

    // 7. Registrar Materiales Consumidos
    if (payload.materials && payload.materials.length > 0) {
      payload.materials.forEach(function(mat) {
        sheetMateriales.appendRow([
          idReporte,
          payload.projectCode,
          payload.date,
          payload.supervisor,
          mat.resourceId,
          mat.qtyConsumed,
          mat.edtGroupCode
        ]);
      });
    }

    // 8. Registrar Equipos Utilizados
    if (payload.equipos && payload.equipos.length > 0) {
      payload.equipos.forEach(function(eq) {
        sheetEquipos.appendRow([
          idReporte,
          payload.projectCode,
          payload.date,
          payload.supervisor,
          eq.resourceId,
          eq.qtyUsed,
          eq.edtGroupCode
        ]);
      });
    }

    // Enviar respuesta exitosa compatible con CORS
    var responseOutput = ContentService.createTextOutput(JSON.stringify({
      status: "success",
      reportId: idReporte,
      message: "Reporte guardado correctamente en Google Sheets y Drive"
    }));
    responseOutput.setMimeType(ContentService.MimeType.JSON);
    return responseOutput;

  } catch (error) {
    // Respuesta de error controlada
    var responseOutput = ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    }));
    responseOutput.setMimeType(ContentService.MimeType.JSON);
    return responseOutput;
  }
}

/**
 * Auxiliar: Asegura la existencia de la hoja y formatea sus encabezados
 */
function inicializarHoja(spreadsheet, nombreHoja, columnas) {
  var sheet = spreadsheet.getSheetByName(nombreHoja);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(nombreHoja);
    sheet.appendRow(columnas);
    
    // Aplicar formato premium a la cabecera
    var headerRange = sheet.getRange(1, 1, 1, columnas.length);
    headerRange.setBackground("#0284c7") // Azul Corporativo RDO
               .setFontColor("#FFFFFF")
               .setFontWeight("bold")
               .setFontFamily("Arial")
               .setHorizontalAlignment("center");
    
    // Congelar fila de cabecera
    sheet.setFrozenRows(1);
    
    // Autoajustar columnas
    for (var i = 1; i <= columnas.length; i++) {
       sheet.autoResizeColumn(i);
    }
  }
  return sheet;
}

/**
 * Auxiliar: Busca o crea una carpeta en la raíz de Google Drive
 */
function obtenerOCrearCarpeta(nombre) {
  var folders = DriveApp.getFoldersByName(nombre);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(nombre);
  }
}

/**
 * Auxiliar: Convierte un String Base64 a archivo binario de imagen en Drive y devuelve la URL de vista directa
 */
function guardarImagenBase64(folder, base64String, fileName) {
  try {
    var rawData = base64String.split("base64,")[1];
    var decoded = Utilities.base64Decode(rawData);
    var blob = Utilities.newBlob(decoded, "image/png", fileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Retorna URL de descarga directa o visualización limpia
    return "https://docs.google.com/uc?export=view&id=" + file.getId();
  } catch(e) {
    Logger.log("Error guardando imagen " + fileName + ": " + e.toString());
    return "";
  }
}`;

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
            Integración de Base de Datos Base de Campo
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Sincroniza tus reportes con tu propia hoja de cálculo de Google Sheets y Google Drive de manera directa.
          </p>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 transition text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg"
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
