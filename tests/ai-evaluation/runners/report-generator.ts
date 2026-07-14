/**
 * Report Generator for AI Evaluation
 *
 * Saves evaluation reports as JSON and optionally generates HTML reports.
 * Manages report history (keep last N reports).
 */

import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { EvaluationReport } from './regression-runner';

const REPORTS_DIR = join(import.meta.dir, '..', 'reports');

/**
 * Save evaluation report to disk.
 */
export function saveReport(report: EvaluationReport): string {
  mkdirSync(REPORTS_DIR, { recursive: true });

  const timestamp = report.timestamp.replace(/[:.]/g, '-');
  const filename = `eval-report-${timestamp}.json`;
  const filepath = join(REPORTS_DIR, filename);

  writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved: ${filepath}`);

  // Clean old reports
  cleanOldReports(30);

  return filepath;
}

/**
 * Keep only the last N reports.
 */
function cleanOldReports(keepLastN: number): void {
  try {
    const files = readdirSync(REPORTS_DIR)
      .filter((f) => f.startsWith('eval-report-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > keepLastN) {
      for (const file of files.slice(keepLastN)) {
        unlinkSync(join(REPORTS_DIR, file));
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Load the most recent report.
 */
export function loadLatestReport(): EvaluationReport | null {
  try {
    const files = readdirSync(REPORTS_DIR)
      .filter((f) => f.startsWith('eval-report-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) return null;

    const content = require('fs').readFileSync(join(REPORTS_DIR, files[0]), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Generate HTML report from evaluation data.
 */
export function generateHTMLReport(report: EvaluationReport): string {
  const o = report.output.aggregate;
  const r = report.retrieval.aggregate;
  const g = report.generation;

  const verdictColor = report.summary.verdict === 'PASS' ? '#22c55e' : '#ef4444';
  const verdictBg = report.summary.verdict === 'PASS' ? '#f0fdf4' : '#fef2f2';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Evaluation Report — ${report.timestamp}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #f8fafc; color: #1e293b; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 2rem; }
    .header h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
    .header .subtitle { color: #64748b; }
    .verdict { display: inline-block; padding: 0.5rem 1.5rem; border-radius: 8px; font-weight: 700; font-size: 1.2rem; background: ${verdictBg}; color: ${verdictColor}; border: 2px solid ${verdictColor}; margin: 1rem 0; }
    .score-bar { display: flex; align-items: center; margin: 0.3rem 0; }
    .score-bar .label { width: 180px; font-size: 0.9rem; }
    .score-bar .bar { flex: 1; height: 24px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
    .score-bar .fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .score-bar .value { width: 60px; text-align: right; font-weight: 600; font-size: 0.9rem; }
    .section { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { font-size: 1.2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .metric-card { background: #f8fafc; padding: 1rem; border-radius: 8px; text-align: center; }
    .metric-card .value { font-size: 1.8rem; font-weight: 700; }
    .metric-card .label { font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; }
    .findings { list-style: none; padding: 0; }
    .findings li { padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
    .findings li:last-child { border: none; }
    .gate { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9; }
    .gate .status { font-weight: 600; }
    .gate .pass { color: #22c55e; }
    .gate .fail { color: #ef4444; }
    footer { text-align: center; color: #94a3b8; font-size: 0.8rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔬 AI Evaluation Report</h1>
      <div class="subtitle">${report.timestamp} · Mode: ${report.mode}</div>
      <div class="verdict">${report.summary.verdict}</div>
      <div style="font-size:1.4rem; font-weight:700; margin-top:0.5rem;">Overall: ${(report.summary.overallScore * 100).toFixed(1)}%</div>
    </div>

    <div class="section">
      <h2>📊 Output Quality</h2>
      ${scoreBar('Accuracy', o.avgAccuracy)}
      ${scoreBar('Relevance', o.avgRelevance)}
      ${scoreBar('Completeness', o.avgCompleteness)}
      ${scoreBar('Hallucination (inv.)', 1 - o.avgHallucinationScore)}
      ${scoreBar('Toxicity (inv.)', 1 - o.avgToxicityScore)}
      ${scoreBar('Overall', o.avgOverallScore)}
    </div>

    <div class="section">
      <h2>📚 RAG Retrieval</h2>
      <div class="grid">
        <div class="metric-card"><div class="value">${(r.avgPrecisionAt3 * 100).toFixed(1)}%</div><div class="label">Precision@3</div></div>
        <div class="metric-card"><div class="value">${(r.avgRecallAt5 * 100).toFixed(1)}%</div><div class="label">Recall@5</div></div>
        <div class="metric-card"><div class="value">${(r.avgMRR * 100).toFixed(1)}%</div><div class="label">MRR</div></div>
        <div class="metric-card"><div class="value">${(r.avgNDCG5 * 100).toFixed(1)}%</div><div class="label">NDCG@5</div></div>
        <div class="metric-card"><div class="value">${(r.avgHitRate * 100).toFixed(1)}%</div><div class="label">Hit Rate</div></div>
      </div>
    </div>

    <div class="section">
      <h2>✍️ Generation Quality</h2>
      <div class="grid">
        <div class="metric-card"><div class="value">${(g.avgFaithfulness * 100).toFixed(1)}%</div><div class="label">Faithfulness</div></div>
        <div class="metric-card"><div class="value">${(g.avgCorrectness * 100).toFixed(1)}%</div><div class="label">Answer Correctness</div></div>
      </div>
    </div>

    <div class="section">
      <h2>🚦 Threshold Gates</h2>
      ${report.gateCheck.failures.length === 0
        ? '<div style="color:#22c55e; font-weight:600; padding:0.5rem 0;">✅ All checks passed</div>'
        : report.gateCheck.failures.map((f) =>
            `<div class="gate"><span>${f}</span><span class="status fail">FAIL</span></div>`
          ).join('')
      }
      <div style="margin-top:0.5rem; color:#64748b; font-size:0.9rem;">
        ${report.gateCheck.passedChecks}/${report.gateCheck.totalChecks} checks passed
      </div>
    </div>

    ${report.summary.keyFindings.length > 0 ? `
    <div class="section">
      <h2>⚠️ Key Findings</h2>
      <ul class="findings">
        ${report.summary.keyFindings.map((f) => `<li>⚠️ ${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <footer>Rottra AI Evaluation System · ${report.timestamp}</footer>
  </div>
</body>
</html>`;
}

function scoreBar(label: string, value: number): string {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444';
  return `
  <div class="score-bar">
    <div class="label">${label}</div>
    <div class="bar"><div class="fill" style="width:${pct}%; background:${color};"></div></div>
    <div class="value">${pct}%</div>
  </div>`;
}

/**
 * Save report in both JSON and HTML formats.
 */
export function saveReportFull(report: EvaluationReport): { json: string; html: string } {
  const json = saveReport(report);

  const htmlContent = generateHTMLReport(report);
  const timestamp = report.timestamp.replace(/[:.]/g, '-');
  const htmlPath = join(REPORTS_DIR, `eval-report-${timestamp}.html`);
  writeFileSync(htmlPath, htmlContent);
  console.log(`📄 HTML report saved: ${htmlPath}`);

  return { json, html: htmlPath };
}
