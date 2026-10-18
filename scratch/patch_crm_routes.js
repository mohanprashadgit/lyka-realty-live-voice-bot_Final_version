import fs from 'fs';

const filePath = 'crmRoutes.ts';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// Keep up to line 1675
const cleanLines = lines.slice(0, 1675);
fs.writeFileSync(filePath, cleanLines.join('\n') + '\n', 'utf8');
console.log('Successfully trimmed crmRoutes.ts to exactly 1675 lines!');
