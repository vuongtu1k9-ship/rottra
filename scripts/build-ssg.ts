import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROUTES_TO_PRERENDER = ['/', '/about'];
const PORT = 5174; // Port for preview server
const DIST_DIR = path.join(process.cwd(), 'dist');

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function buildSSG() {
  console.log('🚀 [SSG] Bước 1: Khởi động Vite Build (CSR)...');
  
  // 1. Chạy vite build
  const buildProc = spawn('bun', ['--bun', 'vite', 'build'], { stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    buildProc.on('close', code => {
      if (code === 0) resolve(true);
      else reject(new Error('Vite build failed'));
    });
  });

  console.log('✅ [SSG] Build CSR hoàn tất. Bắt đầu Render HTML tĩnh...');

  // 2. Chạy preview server
  const previewProc = spawn('bun', ['--bun', 'vite', 'preview', '--port', PORT.toString(), '--strictPort'], {
    stdio: 'pipe'
  });

  // Chờ server preview khởi động
  await wait(3000);

  // 3. Khởi động Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  for (const route of ROUTES_TO_PRERENDER) {
    console.log(`⏳ [SSG] Đang prerender route: ${route}`);
    const url = `http://localhost:${PORT}${route}`;
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Đảm bảo SolidJS đã render
    await wait(1000);

    let html = await page.evaluate(() => {
      return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    });

    // Thay thế script inject của vite preview nếu có
    html = html.replace(/<script[^>]*vite\/client[^>]*><\/script>/g, '');

    let fileName = route === '/' ? 'index' : route.replace(/^\//, '');
    const filePath = path.join(DIST_DIR, `${fileName}.html`);
    
    // Cần đảm bảo thư mục tồn tại nếu route có slash
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`✅ [SSG] Đã lưu: ${filePath}`);
  }

  await browser.close();
  
  // Tắt server preview
  previewProc.kill();
  console.log('🎉 [SSG] Quá trình Hybrid Pre-rendering hoàn tất!');
}

buildSSG().catch(err => {
  console.error('❌ [SSG] Lỗi nghiêm trọng:', err);
  process.exit(1);
});
