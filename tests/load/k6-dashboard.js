// ============================================================
// FinRP — k6 Load Test: Dashboard API
// Run: k6 run tests/load/k6-dashboard.js
//
// Stages model realistic traffic ramp-up to 1,000 concurrent
// users then a sustained 5k VU peak.
// ============================================================

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────
const errorRate       = new Rate("errors");
const dashboardTrend  = new Trend("dashboard_latency_ms");
const customersTrend  = new Trend("customers_latency_ms");
const authMisses      = new Counter("auth_cache_misses");

// ── Environment ───────────────────────────────────────────────
const BASE_URL   = __ENV.BASE_URL   || "http://localhost:3000";
// Provide a valid Clerk session token via env:
// k6 run -e CLERK_TOKEN=... tests/load/k6-dashboard.js
const AUTH_TOKEN = __ENV.CLERK_TOKEN || "";

// ── Test stages ───────────────────────────────────────────────
export const options = {
  stages: [
    // Warm-up
    { duration: "30s",  target: 50   },
    // Ramp to 1k — verifies Redis cache holds
    { duration: "2m",   target: 1000 },
    // Sustained 1k
    { duration: "3m",   target: 1000 },
    // Spike to 2.5k — simulates morning login burst
    { duration: "1m",   target: 2500 },
    { duration: "2m",   target: 2500 },
    // Ramp to 5k peak
    { duration: "2m",   target: 5000 },
    { duration: "3m",   target: 5000 },
    // Cool-down
    { duration: "1m",   target: 0    },
  ],
  thresholds: {
    // p95 dashboard response < 500ms (Redis cache hit expected)
    "dashboard_latency_ms": ["p(95)<500", "p(99)<1500"],
    // p95 customers response < 800ms
    "customers_latency_ms": ["p(95)<800"],
    // Error rate < 1%
    "errors": ["rate<0.01"],
    // HTTP errors < 0.5%
    "http_req_failed": ["rate<0.005"],
  },
};

const HEADERS = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  "Content-Type": "application/json",
};

// ── Main test function ────────────────────────────────────────
export default function () {
  // 1. Dashboard (should be <100ms with Redis cache)
  const dashRes = http.get(`${BASE_URL}/api/dashboard`, { headers: HEADERS });
  dashboardTrend.add(dashRes.timings.duration);

  const dashOk = check(dashRes, {
    "dashboard 200":               (r) => r.status === 200,
    "dashboard has stats":         (r) => {
      try { return JSON.parse(r.body).stats !== undefined; }
      catch { return false; }
    },
    "dashboard <500ms":            (r) => r.timings.duration < 500,
  });
  errorRate.add(!dashOk);

  // Count responses that look like they bypassed the cache (>200ms = DB hit)
  if (dashRes.timings.duration > 200) authMisses.add(1);

  sleep(0.5);

  // 2. Customer list (cursor-paginated, take=25)
  const custRes = http.get(`${BASE_URL}/api/customers?take=25`, { headers: HEADERS });
  customersTrend.add(custRes.timings.duration);

  const custOk = check(custRes, {
    "customers 200":               (r) => r.status === 200,
    "customers paginated":         (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined && Array.isArray(body.data);
      } catch { return false; }
    },
    "customers <800ms":            (r) => r.timings.duration < 800,
  });
  errorRate.add(!custOk);

  sleep(0.3);

  // 3. Simulated page navigation — notifications count
  const notifRes = http.get(`${BASE_URL}/api/notifications?take=10`, { headers: HEADERS });
  check(notifRes, { "notifications 200": (r) => r.status === 200 || r.status === 404 });

  sleep(1);
}

// ── Summary output ────────────────────────────────────────────
export function handleSummary(data) {
  return {
    "tests/load/results/dashboard-summary.json": JSON.stringify(data, null, 2),
    stdout: buildReport(data),
  };
}

function buildReport(data) {
  const ms    = (v) => (v !== undefined ? `${v.toFixed(0)}ms` : "N/A");
  const pct   = (v) => (v !== undefined ? `${(v * 100).toFixed(2)}%` : "N/A");

  return `
╔══════════════════════════════════════════════════════════════════╗
║            FinRP Load Test — Dashboard API Results              ║
╠══════════════════════════════════════════════════════════════════╣
║ Dashboard latency  p50: ${ms(data.metrics.dashboard_latency_ms?.values?.["p(50)"])}   p95: ${ms(data.metrics.dashboard_latency_ms?.values?.["p(95)"])}   p99: ${ms(data.metrics.dashboard_latency_ms?.values?.["p(99)"])}
║ Customer latency   p50: ${ms(data.metrics.customers_latency_ms?.values?.["p(50)"])}   p95: ${ms(data.metrics.customers_latency_ms?.values?.["p(95)"])}
║ Error rate:        ${pct(data.metrics.errors?.values?.rate)}
║ Auth cache misses: ${data.metrics.auth_cache_misses?.values?.count ?? 0}
╚══════════════════════════════════════════════════════════════════╝
`;
}
