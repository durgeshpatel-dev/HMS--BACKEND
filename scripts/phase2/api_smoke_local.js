#!/usr/bin/env node

/**
 * Phase-2 local API smoke checks (read-only by design).
 *
 * Optional env:
 *   API_BASE_URL=http://localhost:5000
 *   MANAGER_EMAIL=...
 *   MANAGER_PASSWORD=...
 */

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const MANAGER_EMAIL = process.env.MANAGER_EMAIL;
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;
const WAITER_PHONE = process.env.WAITER_PHONE;
const WAITER_PIN = process.env.WAITER_PIN;
const COOK_PHONE = process.env.COOK_PHONE;
const COOK_PIN = process.env.COOK_PIN;

const fs = require('fs');
const path = require('path');

const REPORT_DIR = '/home/patel/HMS all/HMS--BACKEND/reports';
const REPORT_FILE = path.join(REPORT_DIR, 'phase2-api-smoke.json');

const report = {
  generatedAt: new Date().toISOString(),
  apiBaseUrl: API_BASE_URL,
  checks: [],
};

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runCheck(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    report.checks.push({
      name,
      status: 'passed',
      durationMs: Date.now() - startedAt,
      details: details || null,
    });
    console.log(`[phase2] ✅ ${name}`);
  } catch (error) {
    const message = error?.message || String(error);
    report.checks.push({
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: message,
    });
    throw error;
  }
}

async function loginManager() {
  const login = await request('/api/v1/auth/manager/login', {
    method: 'POST',
    body: JSON.stringify({ email: MANAGER_EMAIL, password: MANAGER_PASSWORD }),
  });

  assert(login.ok, `manager login failed: ${login.status} ${JSON.stringify(login.data)}`);
  const token = login?.data?.data?.tokens?.accessToken;
  assert(token, 'manager login response missing access token');
  return token;
}

async function loginStaff(phone, pin, label) {
  const login = await request('/api/v1/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ phone, pin }),
  });

  assert(login.ok, `${label} login failed: ${login.status} ${JSON.stringify(login.data)}`);
  const token = login?.data?.data?.tokens?.accessToken;
  assert(token, `${label} login response missing access token`);
  return token;
}

function writeReportAndExit(exitCode) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`[phase2] report: ${REPORT_FILE}`);
  process.exit(exitCode);
}

(async () => {
  console.log(`\n[phase2] API base: ${API_BASE_URL}`);

  await runCheck('public /health', async () => {
    const health = await request('/health');
    assert(health.ok, `/health failed: ${health.status}`);
    return { status: health.status };
  });

  await runCheck('public /api/v1/health', async () => {
    const apiHealth = await request('/api/v1/health');
    assert(apiHealth.ok, `/api/v1/health failed: ${apiHealth.status}`);
    return { status: apiHealth.status };
  });

  await runCheck('unauthenticated protected route blocked', async () => {
    const noToken = await request('/api/v1/orders');
    assert(noToken.status === 401, `expected 401, got ${noToken.status}`);
    return { status: noToken.status };
  });

  if (!MANAGER_EMAIL || !MANAGER_PASSWORD) {
    console.log('[phase2] ⚠️ MANAGER_EMAIL/MANAGER_PASSWORD not provided; skipping auth-protected smoke checks');
    report.checks.push({
      name: 'credentialed checks',
      status: 'skipped',
      reason: 'MANAGER_EMAIL/MANAGER_PASSWORD not provided',
    });
    writeReportAndExit(0);
  }

  let mgrToken = '';
  await runCheck('manager login', async () => {
    const token = await loginManager();
    mgrToken = token;
    return { tokenPresent: Boolean(token) };
  });

  await runCheck('manager can read /api/v1/manager/staff', async () => {
    const staffList = await request('/api/v1/manager/staff', {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert(staffList.ok, `/api/v1/manager/staff failed: ${staffList.status}`);
    return { status: staffList.status };
  });

  await runCheck('manager can read /api/v1/orders', async () => {
    const orders = await request('/api/v1/orders', {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert(orders.ok, `/api/v1/orders failed: ${orders.status}`);
    return { status: orders.status };
  });

  await runCheck('manager upload endpoint authz behavior', async () => {
    const upload = await request('/api/v1/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgrToken}` },
      body: JSON.stringify({}),
    });
    // With manager token and no file, expected validation-ish 400/500 from multer handler layer,
    // but should NOT be 401/403.
    assert(upload.status !== 401 && upload.status !== 403, `unexpected upload auth failure: ${upload.status}`);
    return { status: upload.status };
  });

  if (WAITER_PHONE && WAITER_PIN) {
    const waiterToken = await loginStaff(WAITER_PHONE, WAITER_PIN, 'waiter');

    await runCheck('waiter cannot access manager/staff route', async () => {
      const r = await request('/api/v1/manager/staff', {
        headers: { Authorization: `Bearer ${waiterToken}` },
      });
      assert(r.status === 403, `expected 403 for waiter, got ${r.status}`);
      return { status: r.status };
    });

    await runCheck('waiter cannot upload assets', async () => {
      const r = await request('/api/v1/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${waiterToken}` },
        body: JSON.stringify({}),
      });
      assert(r.status === 403, `expected 403 for waiter upload, got ${r.status}`);
      return { status: r.status };
    });
  }

  if (COOK_PHONE && COOK_PIN) {
    const cookToken = await loginStaff(COOK_PHONE, COOK_PIN, 'cook');

    await runCheck('cook can update order status route access', async () => {
      // Access check only: fetch order list to see at least auth works in kitchen role.
      const r = await request('/api/v1/orders/kitchen', {
        headers: { Authorization: `Bearer ${cookToken}` },
      });
      assert(r.ok, `cook kitchen access failed: ${r.status}`);
      return { status: r.status };
    });

    await runCheck('cook cannot upload assets', async () => {
      const r = await request('/api/v1/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cookToken}` },
        body: JSON.stringify({}),
      });
      assert(r.status === 403, `expected 403 for cook upload, got ${r.status}`);
      return { status: r.status };
    });
  }

  console.log('\n[phase2] ✅ Local API smoke checks completed');
  writeReportAndExit(0);
})().catch((err) => {
  console.error(`\n[phase2] ❌ ${err.message}`);
  writeReportAndExit(1);
});
