// Generate embedded fallback constants for App.tsx
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// ─── 1. PV Curve Fallback ─────────────────────────────────────────────────────
const compact = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pv-curve-compact.json'), 'utf-8'));
const { dates, pvDaily, pvCumulative } = compact;
const lastPv = pvCumulative[pvCumulative.length - 1];

let curveCode = `// PV Curve fallback for GitHub Pages (generated from BD_PV_CurvaS_Proyecto.xlsx)
// ${dates.length} dates, total PV: S/ ${lastPv.toFixed(2)}
export const FALLBACK_PV_CURVE: { date: string; pvDaily: number; pvCumulative: number }[] = [\n`;

for (let i = 0; i < dates.length; i++) {
  curveCode += `  { date: "${dates[i]}", pvDaily: ${pvDaily[i]}, pvCumulative: ${pvCumulative[i]} },\n`;
}
curveCode += '];\n';

fs.mkdirSync(path.join(ROOT, 'src', 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src', 'data', 'pv-curve-fallback.ts'), curveCode);
console.log(`✓ src/data/pv-curve-fallback.ts (${dates.length} points, PV total: ${lastPv})`);

// ─── 2. PV by Chapter Fallback ────────────────────────────────────────────────
const byChapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pv-by-chapter.json'), 'utf-8'));

let chCode = '// PV by Chapter fallback (generated from BD_Presupuesto_EDT.xlsx + BD_PV_Diario_EDT.xlsx)\n';
chCode += '// Total chapters: ' + byChapter.length + ', BAC: S/ ' + byChapter.reduce((s, ch) => s + ch.points[ch.points.length - 1].pvCumulative, 0).toFixed(2) + '\n\n';

// Generate individual arrays with safe variable names
const varNames = [];
byChapter.forEach(ch => {
  const varName = 'PV_CH_' + ch.code.replace(/[^a-zA-Z0-9]/g, '_');
  varNames.push({ varName, code: ch.code, name: ch.name, totalBudget: ch.totalBudget });
  chCode += 'const ' + varName + ' = ' + JSON.stringify(ch.points) + ';\n\n';
});

chCode += 'export interface PvChapterPoint {\n';
chCode += '  code: string;\n';
chCode += '  name: string;\n';
chCode += '  totalBudget: number;\n';
chCode += '  points: { date: string; pvCumulative: number }[];\n';
chCode += '}\n\n';

chCode += 'export const PV_BY_CHAPTER: PvChapterPoint[] = [\n';
varNames.forEach((v, i) => {
  chCode += '  { code: "' + v.code + '", name: "' + v.name + '", totalBudget: ' + v.totalBudget + ', points: ' + v.varName + ' }';
  chCode += i < varNames.length - 1 ? ',' : '';
  chCode += '\n';
});
chCode += '];\n';

fs.writeFileSync(path.join(ROOT, 'src', 'data', 'pv-chapter-fallback.ts'), chCode);
console.log('✓ src/data/pv-chapter-fallback.ts (' + byChapter.length + ' chapters)');
