const XLSX = require('xlsx');
const path = require('path');

const ROOT = 'd:\\Desarrollo de Proyectos\\Reporte Diario tiempo real';

function inspect() {
  const edtPath = path.join(ROOT, 'BD_EDT.xlsx');
  const pvPath = path.join(ROOT, 'PV.xlsx');
  
  const wbEdt = XLSX.readFile(edtPath);
  const wbPv = XLSX.readFile(pvPath);
  
  const edtRows = XLSX.utils.sheet_to_json(wbEdt.Sheets['Sheet1'], { defval: '' });
  const pvRows = XLSX.utils.sheet_to_json(wbPv.Sheets['PV_General'], { defval: '' });
  
  console.log('BD_EDT rows count:', edtRows.length);
  console.log('PV_General rows count:', pvRows.length);
  
  // Show a few rows
  console.log('First 5 BD_EDT rows:', JSON.stringify(edtRows.slice(0, 5), null, 2));
  console.log('First 5 PV_General rows:', JSON.stringify(pvRows.slice(0, 5), null, 2));
}

inspect();
