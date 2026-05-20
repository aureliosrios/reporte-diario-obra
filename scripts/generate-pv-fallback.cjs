// Generate embedded fallback PV curve constant for App.tsx
const fs = require('fs');
const path = require('path');

const compact = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'pv-curve-compact.json'), 'utf-8'));
const { dates, pvCumulative } = compact;
const lastPv = pvCumulative[pvCumulative.length - 1];

// Generate TypeScript constant
let code = `// PV Curve fallback for GitHub Pages (generated from BD_Metrados_Planificados.xlsx)
// ${dates.length} dates, total PV: S/ ${lastPv.toFixed(2)}
export const FALLBACK_PV_CURVE: { date: string; pvDaily: number; pvCumulative: number }[] = [\n`;

for (let i = 0; i < dates.length; i++) {
  code += `  { date: "${dates[i]}", pvDaily: ${compact.pvDaily[i]}, pvCumulative: ${pvCumulative[i]} },\n`;
}
code += '];\n';

// Write as .ts file that can be imported
const outputPath = path.join(__dirname, '..', 'src', 'data', 'pv-curve-fallback.ts');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, code);
console.log(`✓ Generated ${outputPath} (${dates.length} points, PV total: ${lastPv})`);
