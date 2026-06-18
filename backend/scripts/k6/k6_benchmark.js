// k6 Benchmark — E-Learning Platform API Load Test
// Usage:
//   k6 run --vus 100 --duration 120s backend/scripts/k6/k6_benchmark.js
//   k6 run --vus 100 --duration 120s --out json=results.json backend/scripts/k6/k6_benchmark.js

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const catalogLatency = new Trend("catalog_latency");
const searchLatency = new Trend("search_latency");
const leaderboardLatency = new Trend("leaderboard_latency");
const checkoutLatency = new Trend("checkout_latency");
const topupLatency = new Trend("topup_latency");
const dashboardLatency = new Trend("dashboard_latency");
const errorRate = new Rate("errors");

// ---------------------------------------------------------------------------
// Configuration (override via CLI flags or env vars)
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const API_PREFIX = "/api";

// ---------------------------------------------------------------------------
// Options — default thresholds
// ---------------------------------------------------------------------------
export const options = {
  thresholds: {
    http_req_duration: ["p(95)<500"],        // 95th percentile < 500ms
    http_req_failed: ["rate<0.05"],           // < 5% errors
    catalog_latency: ["p(95)<200"],
    search_latency: ["p(95)<100"],
    leaderboard_latency: ["p(95)<50"],
  },
  stages: [
    { duration: "30s", target: 20 },   // Ramp up
    { duration: "2m",  target: 100 },  // Steady state
    { duration: "30s", target: 0 },    // Ramp down
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function apiUrl(path) {
  return `${BASE_URL}${API_PREFIX}${path}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Session tokens from pre-login
let cachedTokens = [];

// ---------------------------------------------------------------------------
// Setup — login users to get session tokens (if auth is needed)
// ---------------------------------------------------------------------------
export function setup() {
  // For benchmarks, most endpoints are public-read.
  // Login to get a token for write endpoints.
  const loginRes = http.post(
    apiUrl("/auth/admin-login"),
    JSON.stringify({ username: "admin", password: "admin123" }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (loginRes.status === 200) {
    try {
      const body = JSON.parse(loginRes.body);
      if (body.session_key) {
        cachedTokens.push({ user: "admin", token: body.session_key });
      }
    } catch (e) {}
  }
  return { tokens: cachedTokens };
}

// ---------------------------------------------------------------------------
// Default function — realistic mixed workload
// ---------------------------------------------------------------------------
export default function (data) {
  const r = Math.random();
  const tokens = data?.tokens || [];
  const headers = { "Content-Type": "application/json" };
  if (tokens.length > 0) {
    headers["Authorization"] = `Bearer ${tokens[0].token}`;
  }

  // --- 60%: Read-heavy operations (catalog + search + leaderboard) ---

  if (r < 0.20) {
    // 20% — Course catalog browsing
    const studentId = `00000000-0000-0000-0000-${String(randomInt(0, 9999)).padStart(12, "0")}`;
    const res = http.get(apiUrl(`/store/courses?student_id=${studentId}`), { headers });
    catalogLatency.add(res.timings.duration);
    errorRate.add(res.status >= 400);
    check(res, { "catalog OK": (r) => r.status === 200 });
    sleep(0.1);

  } else if (r < 0.40) {
    // 20% — Dictionary search
    const keywords = ["xin", "chao", "cam", "on", "hoc", "gia", "dinh", "ngon", "ngu", "ky", "hieu"];
    const kw = randomItem(keywords);
    const res = http.get(apiUrl(`/dictionary/search?keyword=${kw}`), { headers });
    searchLatency.add(res.timings.duration);
    errorRate.add(res.status >= 400);
    check(res, { "search OK": (r) => r.status === 200 });
    sleep(0.05);

  } else if (r < 0.50) {
    // 10% — Leaderboard
    const res = http.get(apiUrl("/gamification/leaderboard?limit=20"), { headers });
    leaderboardLatency.add(res.timings.duration);
    errorRate.add(res.status >= 400);
    check(res, { "leaderboard OK": (r) => r.status === 200 });
    sleep(0.05);

  } else if (r < 0.55) {
    // 5% — Student progress
    const res = http.get(apiUrl("/students/progress"), { headers });
    dashboardLatency.add(res.timings.duration);
    errorRate.add(res.status >= 400);
    sleep(0.1);

  } else if (r < 0.60) {
    // 5% — Course content tree
    const courseId = `00000000-0000-0000-0000-${String(randomInt(0, 4999)).padStart(12, "0")}`;
    const res = http.get(apiUrl(`/teacher/courses/${courseId}/content`), { headers });
    dashboardLatency.add(res.timings.duration);
    errorRate.add(res.status >= 400);
    sleep(0.1);

  // --- 25%: Write / transactional operations ---

  } else if (r < 0.85) {
    // 25% — Wallet topup (fast write)
    const payload = JSON.stringify({
      user_id: `00000000-0000-0000-0000-${String(randomInt(0, 9999)).padStart(12, "0")}`,
      amount: randomInt(100000, 2000000),
      message: "k6 benchmark topup",
    });
    const res = http.post(apiUrl("/wallet/topup"), payload, { headers });
    topupLatency.add(res.timings.duration);
    errorRate.add(res.status >= 400);
    sleep(0.15);

  } else if (r < 0.95) {
    // 10% — Course checkout (complex write)
    const payload = JSON.stringify({
      student_id: `00000000-0000-0000-0000-${String(randomInt(0, 7999)).padStart(12, "0")}`,
      course_id: `00000000-0000-0000-0000-${String(randomInt(0, 4999)).padStart(12, "0")}`,
    });
    const res = http.post(apiUrl("/store/checkout"), payload, { headers });
    checkoutLatency.add(res.timings.duration);
    errorRate.add(res.status >= 400);
    sleep(0.2);

  } else {
    // 5% — Microlearning roadmap (read)
    const res = http.get(apiUrl("/microlearning/roadmap"), { headers });
    errorRate.add(res.status >= 400);
    sleep(0.05);
  }
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------
export function teardown(data) {
  // Nothing to clean up
}
