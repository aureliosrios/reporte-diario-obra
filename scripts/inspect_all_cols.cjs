const XLSX = require('xlsx');
const path = require('path');
const ROOT = 'd:\\Desarrollo de Proyectos\\Reporte Diario tiempo real';

function searchColumns(filename) {
  console.log(`\n================== ${filename} ==================`);
  try {
    const wb = XLSX.readFile(path.join(ROOT, filename));
    wb.SheetNames.forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      console.log(`Hoja: "${sheetName}" | Filas: ${data.length}`);
      if (data.length > 0) {
        console.log('Columnas:', Object.keys(data[0]));
        console.log('Fila de muestra:', data[0]);
      }
    });
  } catch (e) {
    console.error(`Error leyendo ${filename}:`, e.message);
  }
}

searchColumns('BD_EDT.xlsx');
searchColumns('PV.xlsx');
searchColumns('BD_Metrados_Planificados.xlsx');
