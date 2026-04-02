#!/usr/bin/env node

/**
 * Phase-3 observability check (local-only)
 * - verifies /health response includes requestId
 * - verifies x-request-id response header roundtrip behavior
 */

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

async function check() {
  const injectedId = `local-check-${Date.now()}`;
  const res = await fetch(`${API_BASE_URL}/health`, {
    headers: {
      'x-request-id': injectedId,
    },
  });

  if (!res.ok) {
    throw new Error(`/health failed with status ${res.status}`);
  }

  const body = await res.json();
  const headerReqId = res.headers.get('x-request-id');

  if (!headerReqId) {
    throw new Error('Missing x-request-id response header');
  }

  if (headerReqId !== injectedId) {
    throw new Error(`x-request-id header mismatch. expected=${injectedId}, got=${headerReqId}`);
  }

  if (!body.requestId) {
    throw new Error('Health payload missing requestId');
  }

  if (body.requestId !== injectedId) {
    throw new Error(`requestId payload mismatch. expected=${injectedId}, got=${body.requestId}`);
  }

  console.log(JSON.stringify({
    ok: true,
    apiBaseUrl: API_BASE_URL,
    requestIdRoundtrip: true,
    responseStatus: res.status,
  }, null, 2));
}

check().catch((err) => {
  console.error(`[phase3] observability check failed: ${err.message}`);
  process.exit(1);
});
