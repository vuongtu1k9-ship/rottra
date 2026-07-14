import * as fs from 'fs';
import * as path from 'path';

function getTree(dirPath: string, depth = 0, maxDepth = 4, prefix = ''): string[] {
  if (depth > maxDepth) return [];
  const basename = path.basename(dirPath);
  if (['node_modules', '.git', '.gemini', 'dist', 'public'].includes(basename)) return [];
  
  let files: string[] = [];
  try {
    files = fs.readdirSync(dirPath);
  } catch (e) {
    return [];
  }

  // sort directories first
  files.sort((a, b) => {
    const isDirA = fs.statSync(path.join(dirPath, a)).isDirectory();
    const isDirB = fs.statSync(path.join(dirPath, b)).isDirectory();
    if (isDirA && !isDirB) return -1;
    if (!isDirA && isDirB) return 1;
    return a.localeCompare(b);
  });

  let lines: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(dirPath, file);
    const isLast = i === files.length - 1;
    const isDir = fs.statSync(fullPath).isDirectory();
    
    const connector = isLast ? '└── ' : '├── ';
    lines.push(`${prefix}${connector}${file}${isDir ? '/' : ''}`);
    
    if (isDir) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      lines.push(...getTree(fullPath, depth + 1, maxDepth, newPrefix));
    }
  }
  return lines;
}

const lines = getTree(process.cwd());
const treeStr = '.\n' + lines.join('\n');

const structPath = path.join(process.cwd(), 'docs', 'structure.md');
const content = fs.readFileSync(structPath, 'utf8');

const startMarker = "Plaintext\n.";
const endMarker = "364: 🧠 4 TRIẾT LÝ SỐNG CÒN CỦA KIẾN TRÚC MỚI"; // I'll use regex to replace

const match = content.match(/🚀 BẢN QUY HOẠCH CẤU TRÚC MỚI \(ROTTRA CORE V-MAX\)[\s\S]*?(?=🧠 4 TRIẾT LÝ SỐNG CÒN CỦA KIẾN TRÚC MỚI)/);

if (match) {
  const newContent = content.replace(match[0], `🚀 BẢN QUY HOẠCH CẤU TRÚC MỚI (ROTTRA CORE V-MAX)\nPlaintext\n${treeStr}\n\n`);
  fs.writeFileSync(structPath, newContent, 'utf8');
  console.log("Updated structure.md!");
} else {
  console.log("Could not find replacement block");
}
