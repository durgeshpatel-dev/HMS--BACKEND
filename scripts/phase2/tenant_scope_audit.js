#!/usr/bin/env node

/**
 * Phase-2 tenant-scope audit (static heuristic, read-only).
 *
 * Scans service files for Prisma calls and flags query blocks
 * that do not visibly include `restaurantId`.
 */

const fs = require('fs');
const path = require('path');

const ROOT = '/home/patel/HMS all/HMS--BACKEND';
const SERVICES_DIR = path.join(ROOT, 'src', 'services');
const REPORT_DIR = path.join(ROOT, 'reports');
const REPORT_FILE = path.join(REPORT_DIR, 'phase2-tenant-audit.md');

const PRISMA_CALL_RE = /prisma\.[a-zA-Z0-9_]+\.(findMany|findFirst|findUnique|update|delete|create|upsert|count)\(/;

const IGNORE_FILES = new Set([
  // Auth legitimately has global email/phone lookups.
  'auth.service.ts',
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
}

function toRel(p) {
  return path.relative(ROOT, p).replaceAll('\\\\', '/');
}

function analyzeFile(filePath) {
  const rel = toRel(filePath);
  if (IGNORE_FILES.has(path.basename(filePath))) {
    return { rel, ignored: true, findings: [] };
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!PRISMA_CALL_RE.test(line)) continue;

    const windowStart = i;
    const windowEnd = Math.min(lines.length - 1, i + 28);
    const block = lines.slice(windowStart, windowEnd + 1).join('\n');

    const hasRestaurantScope = /restaurantId\b/.test(block);
    const hasIdOnlyPattern = /where\s*:\s*\{\s*id\b/.test(block);

    if (!hasRestaurantScope && !hasIdOnlyPattern) {
      findings.push({
        line: i + 1,
        snippet: line.trim(),
        reason: 'No visible restaurantId scope in query block',
      });
    }
  }

  return { rel, ignored: false, findings };
}

function main() {
  const files = walk(SERVICES_DIR);
  const analyzed = files.map(analyzeFile);

  const flagged = analyzed.filter((f) => !f.ignored && f.findings.length > 0);
  const totalFindings = flagged.reduce((acc, f) => acc + f.findings.length, 0);

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const now = new Date().toISOString();
  const lines = [];
  lines.push('# Phase-2 Tenant Scope Audit Report');
  lines.push('');
  lines.push(`Generated at: ${now}`);
  lines.push('');
  lines.push('> Note: This is a static heuristic audit. It highlights candidates for manual review.');
  lines.push('');
  lines.push(`- Service files scanned: ${files.length}`);
  lines.push(`- Files flagged: ${flagged.length}`);
  lines.push(`- Total candidate findings: ${totalFindings}`);
  lines.push('');

  if (flagged.length === 0) {
    lines.push('✅ No candidate tenant-scope issues detected by heuristic scan.');
  } else {
    lines.push('## Candidate findings');
    lines.push('');

    for (const file of flagged) {
      lines.push(`### ${file.rel}`);
      lines.push('');
      for (const f of file.findings) {
        lines.push(`- Line ${f.line}: ${f.reason}`);
        lines.push(`  - ${f.snippet}`);
      }
      lines.push('');
    }
  }

  fs.writeFileSync(REPORT_FILE, lines.join('\n') + '\n', 'utf8');

  console.log(`\n[phase2] Tenant audit report generated: ${REPORT_FILE}`);
  console.log(`[phase2] Files scanned: ${files.length}`);
  console.log(`[phase2] Candidate findings: ${totalFindings}`);

  process.exit(0);
}

main();
