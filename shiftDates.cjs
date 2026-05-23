const fs = require('fs');
const path = require('path');

const SHIFT_DAYS = -19;

function shiftDateString(dateStr) {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/);
  if (!match) return dateStr;
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1;
  const day = parseInt(match[3]);
  
  const d = new Date(Date.UTC(year, month, day));
  d.setUTCDate(d.getUTCDate() + SHIFT_DAYS);
  
  const newYear = d.getUTCFullYear();
  const newMonth = String(d.getUTCMonth() + 1).padStart(2, '0');
  const newDay = String(d.getUTCDate()).padStart(2, '0');
  
  return `${newYear}-${newMonth}-${newDay}${match[4] || ''}`;
}

function processObject(obj) {
  if (typeof obj === 'string') {
    // Only shift if it matches yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(obj)) {
      return shiftDateString(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(processObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = processObject(obj[key]);
    }
    return newObj;
  }
  return obj;
}

function processJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    const json = JSON.parse(content);
    const newJson = processObject(json);
    fs.writeFileSync(filePath, JSON.stringify(newJson, null, 2), 'utf8');
    console.log(`Updated JSON: ${filePath}`);
  } catch(e) {
    console.error(`Failed to parse JSON: ${filePath}`);
  }
}

function processTextFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  // Replace dates in the format YYYY-MM-DD
  const regex = /\b2026-(05|06|07|08|09)-\d{2}\b/g;
  content = content.replace(regex, (match) => shiftDateString(match));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated Text: ${filePath}`);
}

const publicDir = path.join(__dirname, 'public', 'data');
const jsonFiles = [
  'project.json',
  'pv-by-chapter.json',
  'pv-curve.json',
  'pv-edt-data.json',
  'resources.json'
];

jsonFiles.forEach(file => {
  processJsonFile(path.join(publicDir, file));
});

const srcDataDir = path.join(__dirname, 'src', 'data');
const tsFiles = [
  'pv-chapter-fallback.ts',
  'pv-curve-fallback.ts'
];

tsFiles.forEach(file => {
  processTextFile(path.join(srcDataDir, file));
});

processTextFile(path.join(__dirname, 'src', 'App.tsx'));

console.log("Done shifting dates!");
