#!/usr/bin/env node

/**
 * Phase-2 route security audit (static heuristic, read-only).
 *
 * Flags mutating routes (POST/PUT/PATCH/DELETE) that do not visibly use
 * requireRole(...) in the same route definition block.
 */

const fs = require('fs');
const path = require('path');

const ROOT = '/home/patel/HMS all/HMS--BACKEND';
const ROUTES_DIR = path.join(ROOT, 'src', 'routes');
const REPORT_DIR = path.join(ROOT, 'reports');
const REPORT_FILE = path.join(REPORT_DIR, 'phase2-route-security-audit.md');

const ROUTE_START_RE = /router\.(post|put|patch|delete)\s*\(/;
const PUBLIC_ROUTE_FILES = new Set([
  'auth.routes.ts',
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
  return path.relative(ROOT, p).replaceAll('\\', '/');
}

function parseRouteBlock(lines, startIndex) {
  let depth = 0;
  let started = false;
  const block = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    block.push(line);

    for (const ch of line) {
      if (ch === '(') {
        depth++;
        started = true;
      } else if (ch === ')') {
        depth--;
      }
    }

    if (started && depth <= 0 && /\);\s*$/.test(line.trim())) {
      return { blockLines: block, endIndex: i };
    }
  }

  return { blockLines: block, endIndex: lines.length - 1 };
}

function getRoutePathFromStartLine(line) {
  const m = line.match(/router\.(?:post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/);
  return m ? m[1] : '(unknown)';
}

function getRoutePathFromBlock(blockLines) {
  const text = blockLines.join('\n');
  const m = text.match(/router\.(?:post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/m);
  return m ? m[1] : '(unknown)';
}

function analyzeFile(filePath) {
  const rel = toRel(filePath);
  const base = path.basename(filePath);

  if (PUBLIC_ROUTE_FILES.has(base)) {
    return { rel, findings: [], ignoredReason: 'Public auth routes (expected no role guards)' };
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const findings = [];
  const hasGlobalRequireRole = lines.some((ln) => /router\.use\(\s*requireRole\s*\(/.test(ln));
  const hasGlobalRequireAuth = lines.some((ln) => /router\.use\(\s*requireAuth\s*\)/.test(ln));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!ROUTE_START_RE.test(line)) continue;

    const method = line.match(/router\.(post|put|patch|delete)/)?.[1]?.toUpperCase() || 'UNKNOWN';
    const { blockLines, endIndex } = parseRouteBlock(lines, i);
    const blockText = blockLines.join('\n');
    const pathValue = getRoutePathFromBlock(blockLines) || getRoutePathFromStartLine(line);

    const hasRequireRole = /requireRole\s*\(/.test(blockText);
    const hasRequireAuthGlobal = hasGlobalRequireAuth;

    // We only flag when role guard is missing.
    if (!hasRequireRole && !hasGlobalRequireRole) {
      findings.push({
        line: i + 1,
        method,
        routePath: pathValue,
        hasRequireAuthGlobal,
        reason: 'Mutating route has no visible requireRole guard',
      });
    }

    i = endIndex;
  }

  return { rel, findings, ignoredReason: null };
}

function main() {
  const files = walk(ROUTES_DIR);
  const analyzed = files.map(analyzeFile);
  const flagged = analyzed.filter((a) => a.findings.length > 0);
  const ignored = analyzed.filter((a) => a.ignoredReason);
  const totalFindings = flagged.reduce((sum, f) => sum + f.findings.length, 0);

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const out = [];
  out.push('# Phase-2 Route Security Audit Report');
  out.push('');
  out.push(`Generated at: ${new Date().toISOString()}`);
  out.push('');
  out.push('> Note: Static heuristic report for manual review.');
  out.push('');
  out.push(`- Route files scanned: ${files.length}`);
  out.push(`- Files flagged: ${flagged.length}`);
  out.push(`- Total candidate findings: ${totalFindings}`);
  out.push(`- Files skipped by rule: ${ignored.length}`);
  out.push('');

  if (ignored.length > 0) {
    out.push('## Skipped files');
    out.push('');
    for (const item of ignored) {
      out.push(`- ${item.rel}: ${item.ignoredReason}`);
    }
    out.push('');
  }

  if (flagged.length === 0) {
    out.push('✅ No candidate mutating-route role-guard issues detected.');
  } else {
    out.push('## Candidate findings');
    out.push('');
    for (const file of flagged) {
      out.push(`### ${file.rel}`);
      out.push('');
      for (const f of file.findings) {
        out.push(`- ${f.method} ${f.routePath} at line ${f.line}`);
        out.push(`  - ${f.reason}`);
        out.push(`  - Global requireAuth before route: ${f.hasRequireAuthGlobal ? 'yes' : 'no'}`);
      }
      out.push('');
    }
  }

  fs.writeFileSync(REPORT_FILE, out.join('\n') + '\n', 'utf8');

  console.log(`\n[phase2] Route security audit report generated: ${REPORT_FILE}`);
  console.log(`[phase2] Route files scanned: ${files.length}`);
  console.log(`[phase2] Candidate findings: ${totalFindings}`);
}

main();
