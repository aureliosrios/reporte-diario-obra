const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const ROOT = 'd:\\Desarrollo de Proyectos\\Reporte Diario tiempo real';

function updateDatabase() {
  const edtPath = path.join(ROOT, 'BD_EDT.xlsx');
  const pvPath = path.join(ROOT, 'PV.xlsx');
  
  if (!fs.existsSync(edtPath)) {
    console.error(`Error: No se encuentra ${edtPath}`);
    return;
  }
  if (!fs.existsSync(pvPath)) {
    console.error(`Error: No se encuentra ${pvPath}`);
    return;
  }

  // 1. Leer PV_General de PV.xlsx para extraer metrado y presupuesto
  const wbPv = XLSX.readFile(pvPath);
  const pvGen = XLSX.utils.sheet_to_json(wbPv.Sheets['PV_General'], { defval: '' });
  
  const pvLookup = {};
  pvGen.forEach(r => {
    if (r.actividad_id) {
      const metrado = parseFloat(r.metrado_total_planificado) || 0;
      const presupuesto = parseFloat(r.presupuesto_total) || 0;
      const pu = metrado > 0 ? (presupuesto / metrado) : 0;
      
      pvLookup[r.actividad_id] = {
        metrado: metrado,
        pu: Math.round(pu * 10000) / 10000,
        presupuesto: presupuesto
      };
    }
  });

  // 2. Leer BD_EDT.xlsx
  const wbEdt = XLSX.readFile(edtPath);
  const sheetName = 'Sheet1';
  const edtRaw = XLSX.utils.sheet_to_json(wbEdt.Sheets[sheetName], { defval: '' });

  // 3. Modificar filas de BD_EDT.xlsx
  const updatedRows = edtRaw.map(r => {
    const nivel = parseInt(r.nivel_wbs) || 1;
    
    if (nivel === 1) {
      // Capítulo: calcular el presupuesto total sumando partidas hijas
      const children = edtRaw.filter(h => h.nivel_wbs === 2 && h.padre_id === r.edt_id);
      let sumBudget = 0;
      children.forEach(h => {
        const pvInfo = pvLookup[h.actividad_id];
        sumBudget += pvInfo ? pvInfo.presupuesto : (parseFloat(h.presupuesto_total) || 0);
      });

      return {
        edt_id: r.edt_id,
        edt_nombre: r.edt_nombre,
        actividad_id: '',
        actividad_nombre: '',
        codigo: r.codigo,
        unidad: 'glb',
        metrado_total_planificado: '',
        precio_unitario: '',
        precio_parcial: sumBudget,
        presupuesto_total: sumBudget,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        nivel_wbs: 1,
        padre_id: 0
      };
    } else {
      // Actividad / Partida (Nivel 2)
      const pvInfo = pvLookup[r.actividad_id];
      const metrado = pvInfo ? pvInfo.metrado : 0;
      const pu = pvInfo ? pvInfo.pu : 0;
      const presupuesto = pvInfo ? pvInfo.presupuesto : (parseFloat(r.presupuesto_total) || 0);

      return {
        edt_id: r.edt_id,
        edt_nombre: r.edt_nombre,
        actividad_id: r.actividad_id,
        actividad_nombre: r.actividad_nombre,
        codigo: r.codigo,
        unidad: r.unidad || 'und',
        metrado_total_planificado: metrado,
        precio_unitario: pu,
        precio_parcial: presupuesto,
        presupuesto_total: presupuesto,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        nivel_wbs: 2,
        padre_id: r.padre_id
      };
    }
  });

  // 4. Guardar archivo actualizado
  const ws = XLSX.utils.json_to_sheet(updatedRows, {
    header: [
      'edt_id',
      'edt_nombre',
      'actividad_id',
      'actividad_nombre',
      'codigo',
      'unidad',
      'metrado_total_planificado',
      'precio_unitario',
      'precio_parcial',
      'presupuesto_total',
      'fecha_inicio',
      'fecha_fin',
      'nivel_wbs',
      'padre_id'
    ]
  });
  
  wbEdt.Sheets[sheetName] = ws;
  XLSX.writeFile(wbEdt, edtPath);
  console.log(`✅ Base de datos BD_EDT.xlsx actualizada exitosamente.`);
}

updateDatabase();
