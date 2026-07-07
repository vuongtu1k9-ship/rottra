import fs from 'node:fs';
import path from 'node:path';

const builtIns = new Set(['fs', 'path', 'crypto', 'os', 'events', 'child_process', 'util', 'worker_threads', 'stream']);

function walk(dir: string, callback: (file: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, callback);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.tsrx') || file.endsWith('.tsrx.tsx'))) {
      callback(fullPath);
    }
  }
}

const srcDir = path.join(process.cwd(), 'src');
console.log(`Scanning ${srcDir} for Node.js built-in imports...`);

walk(srcDir, (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const builtInPattern = 'fs|path|crypto|os|events|child_process|util|worker_threads|stream|zlib|v8|vm|http|https|url|dns|querystring|readline|buffer|process|assert';

  // Regex to match imports of built-in modules in static from statements
  const staticRegex = new RegExp(`(from\\s+['"])(${builtInPattern})(['"])`, 'g');
  content = content.replace(staticRegex, (match, prefix, moduleName, suffix) => {
    changed = true;
    console.log(`  Updating ${path.basename(file)}: "${moduleName}" -> "node:${moduleName}"`);
    return `${prefix}node:${moduleName}${suffix}`;
  });

  // Regex to match dynamic imports like import("fs") or import("fs/promises")
  const dynamicRegex = new RegExp(`(import\\(['"])(${builtInPattern})([^'"]*['"])`, 'g');
  content = content.replace(dynamicRegex, (match, prefix, moduleName, suffix) => {
    changed = true;
    console.log(`  Updating dynamic import in ${path.basename(file)}: "${moduleName}" -> "node:${moduleName}"`);
    return `${prefix}node:${moduleName}${suffix}`;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log('Done!');
