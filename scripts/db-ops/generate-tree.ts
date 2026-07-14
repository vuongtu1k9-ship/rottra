import * as fs from 'fs';
import * as path from 'path';

function printTree(dirPath: string, depth = 0, maxDepth = 4, prefix = '') {
  if (depth > maxDepth) return;
  const basename = path.basename(dirPath);
  if (['node_modules', '.git', '.gemini', 'dist', 'public'].includes(basename)) return;
  
  let files: string[] = [];
  try {
    files = fs.readdirSync(dirPath);
  } catch (e) {
    return;
  }

  // sort directories first
  files.sort((a, b) => {
    const isDirA = fs.statSync(path.join(dirPath, a)).isDirectory();
    const isDirB = fs.statSync(path.join(dirPath, b)).isDirectory();
    if (isDirA && !isDirB) return -1;
    if (!isDirA && isDirB) return 1;
    return a.localeCompare(b);
  });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(dirPath, file);
    const isLast = i === files.length - 1;
    const isDir = fs.statSync(fullPath).isDirectory();
    
    const connector = isLast ? '└── ' : '├── ';
    console.log(`${prefix}${connector}${file}${isDir ? '/' : ''}`);
    
    if (isDir) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      printTree(fullPath, depth + 1, maxDepth, newPrefix);
    }
  }
}

console.log('.');
printTree(process.cwd());
