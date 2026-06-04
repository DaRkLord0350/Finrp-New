// ============================================================
// FinRP — k6 Scale Target Tests
// Tests at 10k, 100k, 500k, 1M customer dataset sizes.
// Run per-stage: k6 run -e SCALE=100k tests/load/k6-scale-targets.js
// ============================================================

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL   = __ENV.BASE_URL   || "http://localhost:3000";
const AUTH_TOKEN = __ENV.CLERK_TOKEN || "";
const SCALE      = __ENV.SCALE      || "10k";

const errorRate = new Rate("errors");
const p95dash   = new Trend("p95_dashboard");

// VU counts & expected thresholds vary by target scale
const SCALE_CONFIG = {
  "10k":  { vus: 200,  duration: "3m", dashP95: 200  },
  "100k": { vus: 1000, duration: "5m", dashP95: 500  },
  "500k": { vus: 2000, duration: "5m", dashP95: 1000 },
  "1M":   { vus: 3000, duration: "8m", dashP95: 1500 },
};

const cfg = SCALE_CONFIG[SCALE] || SCALE_CONFIG["10k"];

export const options = {
  vus:      cfg.vus,
  duration: cfg.duration,
  thresholds: {
    "p95_dashboard": [`p(95)<${cfg.dashP95}`],
    "errors":        ["rate<0.02"],
  },
};

const HEADERS = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  "Content-Type": "application/json",
};

export default function () {
  // Dashboard — main canary endpoint
  const r = http.get(`${BASE_URL}/api/dashboard`, { headers: HEADERS });
  p95dash.add(r.timings.duration);
  const ok = check(r, {
    "status 200": (res) => res.status === 200,
    "has stats":  (res) => {
      try { return !!JSON.parse(res.body).stats; } catch { return false; }
    },
  });
  errorRate.add(!ok);

  // Cursor paginated customers
  const c = http.get(`${BASE_URL}/api/customers?take=25`, { headers: HEADERS });
  check(c, { "customers paginated": (res) => res.status === 200 });

  sleep(1);
}

export function handleSummary(data) {
  const p95 = data.metrics.p95_dashboard?.values?.["p(95)"] ?? 0;
  const rps  = data.metrics.http_reqs?.values?.rate ?? 0;
  return {
    stdout: `
Scale: ${SCALE}  |  VUs: ${cfg.vus}
Dashboard p95: ${p95.toFixed(0)}ms  (target <${cfg.dashP95}ms)
Throughput:    ${rps.toFixed(1)} req/s
Errors:        ${((data.metrics.errors?.values?.rate ?? 0) * 100).toFixed(2)}%
`,
  };
}
