"""
Benchmark Orchestrator — runs full benchmark suite and collects metrics.

Usage:
    python -m scripts.run_benchmarks --output results/
    python -m scripts.run_benchmarks --scale 0.1 --quick  # Quick test run
    python -m scripts.run_benchmarks --pgbench-only        # Only SQL-level
    python -m scripts.run_benchmarks --k6-only             # Only API-level

Produces:
    results/benchmark_summary.md   — Human-readable report
    results/benchmark_data.json    — Machine-readable metrics
    results/pgbench/               — Raw pgbench log files
    results/k6/                    — Raw k6 output
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import asyncpg

TZ = timezone(timedelta(hours=7))
SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPTS_DIR.parent


# ============================================================================
# Database metric collectors
# ============================================================================


async def collect_db_metrics(conn: asyncpg.Connection) -> dict:
    """Collect all relevant PostgreSQL metrics at a point in time."""
    metrics = {}

    # Cache hit ratio
    row = await conn.fetchrow("""
        SELECT SUM(heap_blks_read) AS disk_reads,
               SUM(heap_blks_hit) AS cache_hits,
               ROUND(100.0 * SUM(heap_blks_hit) /
                     NULLIF(SUM(heap_blks_hit + heap_blks_read), 0), 2) AS hit_ratio_pct
        FROM pg_statio_user_tables
    """)
    metrics["cache"] = {
        "disk_reads": int(row["disk_reads"] or 0),
        "cache_hits": int(row["cache_hits"] or 0),
        "hit_ratio_pct": float(row["hit_ratio_pct"] or 0),
    }

    # Deadlocks
    row = await conn.fetchrow(
        "SELECT deadlocks, xact_commit, xact_rollback FROM pg_stat_database WHERE datname = current_database()"
    )
    metrics["concurrency"] = {
        "deadlocks": int(row["deadlocks"] or 0),
        "xact_commit": int(row["xact_commit"] or 0),
        "xact_rollback": int(row["xact_rollback"] or 0),
    }

    # Active connections
    active = await conn.fetchval(
        "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'"
    )
    total = await conn.fetchval("SELECT count(*) FROM pg_stat_activity")
    metrics["connections"] = {"active": int(active), "total": int(total)}

    # Index usage — count unused indexes
    row = await conn.fetchrow("""
        SELECT count(*) AS unused FROM pg_stat_user_indexes
        WHERE idx_scan = 0 AND indexrelname NOT LIKE '%pkey%' AND indexrelname NOT LIKE '%uq_%'
    """)
    total_idx = await conn.fetchval("""
        SELECT count(*) FROM pg_stat_user_indexes
        WHERE indexrelname NOT LIKE '%pkey%' AND indexrelname NOT LIKE '%uq_%'
    """)
    metrics["indexes"] = {"unused": int(row["unused"]), "total": int(total_idx)}

    # Top-10 slow queries from pg_stat_statements
    rows = await conn.fetch("""
        SELECT LEFT(query, 200) AS query, calls,
               ROUND(mean_exec_time::numeric, 2) AS avg_ms,
               ROUND(max_exec_time::numeric, 2) AS max_ms,
               shared_blks_read AS disk_reads,
               ROUND(100.0 * shared_blks_hit /
                     NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS hit_pct
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%' AND calls > 0
        ORDER BY mean_exec_time DESC LIMIT 10
    """)
    metrics["top_queries"] = [dict(r) for r in rows]

    return metrics


async def reset_db_stats(conn: asyncpg.Connection):
    """Reset cumulative statistics before a benchmark run."""
    await conn.execute("SELECT pg_stat_statements_reset()")
    await conn.execute("SELECT pg_stat_reset()")


# ============================================================================
# pgbench runner
# ============================================================================


def run_pgbench(output_dir: Path, host: str, port: str, user: str, password: str, database: str) -> dict:
    """Run all pgbench workloads and return summary."""
    output_dir.mkdir(parents=True, exist_ok=True)
    workloads = {
        "topup": SCRIPTS_DIR / "pgbench" / "bench_topup.sql",
        "transfer": SCRIPTS_DIR / "pgbench" / "bench_transfer.sql",
        "checkout": SCRIPTS_DIR / "pgbench" / "bench_checkout.sql",
        "mixed": SCRIPTS_DIR / "pgbench" / "bench_mixed.sql",
    }

    results = {}
    conn_str = f"postgresql://{user}:{password}@{host}:{port}/{database}"

    for name, script in workloads.items():
        if not script.exists():
            print(f"  Skipping {name}: script not found at {script}")
            continue

        log_prefix = str(output_dir / name)
        cmd = [
            "pgbench", "-c", "50", "-T", "60",
            "-f", str(script),
            "--log", f"--log-prefix={log_prefix}",
            conn_str,
        ]

        print(f"  Running pgbench/{name} (50 clients, 60s)...")
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            results[name] = _parse_pgbench_output(proc.stdout)
            results[name]["returncode"] = proc.returncode
            if proc.returncode != 0:
                results[name]["error"] = proc.stderr[:500]
        except subprocess.TimeoutExpired:
            results[name] = {"error": "timeout after 120s"}
        except FileNotFoundError:
            results[name] = {"error": "pgbench not found in PATH"}
            print("  WARNING: pgbench not installed. Install PostgreSQL client tools.")

    return results


def _parse_pgbench_output(stdout: str) -> dict:
    """Extract TPS and latency from pgbench output."""
    info = {}
    for line in stdout.split("\n"):
        line = line.strip()
        if "tps" in line.lower() and "including" in line.lower():
            # e.g., "tps = 123.456 (including connections establishing)"
            parts = line.split()
            for i, p in enumerate(parts):
                if p == "=" and i + 1 < len(parts):
                    try:
                        info["tps_including_connections"] = float(parts[i + 1])
                    except ValueError:
                        pass
        elif "tps" in line.lower() and "excluding" in line.lower():
            parts = line.split()
            for i, p in enumerate(parts):
                if p == "=" and i + 1 < len(parts):
                    try:
                        info["tps_excluding_connections"] = float(parts[i + 1])
                    except ValueError:
                        pass
        elif "latency average" in line.lower():
            parts = line.split()
            for i, p in enumerate(parts):
                if p == "=" and i + 1 < len(parts):
                    try:
                        info["latency_avg_ms"] = float(parts[i + 1].replace("ms", ""))
                    except ValueError:
                        pass
    info["raw_output"] = stdout[-2000:]
    return info


# ============================================================================
# k6 runner
# ============================================================================


def run_k6(output_dir: Path, base_url: str) -> dict:
    """Run k6 API benchmark and return summary."""
    output_dir.mkdir(parents=True, exist_ok=True)
    script = SCRIPTS_DIR / "k6" / "k6_benchmark.js"
    output_json = output_dir / "k6_results.json"

    if not script.exists():
        return {"error": f"k6 script not found at {script}"}

    cmd = [
        "k6", "run",
        "--vus", "100", "--duration", "120s",
        "--out", f"json={output_json}",
        "-e", f"BASE_URL={base_url}",
        str(script),
    ]

    print(f"  Running k6 (100 VUs, 120s)...")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        summary = _parse_k6_output(proc.stdout)
        summary["returncode"] = proc.returncode
        if proc.returncode != 0:
            summary["error"] = proc.stderr[:500]
        return summary
    except subprocess.TimeoutExpired:
        return {"error": "timeout after 180s"}
    except FileNotFoundError:
        print("  WARNING: k6 not installed. Run: winget install k6")
        return {"error": "k6 not found in PATH"}


def _parse_k6_output(stdout: str) -> dict:
    """Extract key metrics from k6 console output."""
    info = {"raw_summary": stdout[-3000:]}
    for line in stdout.split("\n"):
        line = line.strip()
        # http_req_duration
        if "http_req_duration" in line and "avg=" in line:
            info["http_req_duration"] = line
        elif "http_reqs" in line and "/s" in line:
            info["http_reqs_rate"] = line
        elif "http_req_failed" in line:
            info["http_req_failed"] = line
        elif "checks" in line and "%" in line:
            info["checks"] = line
    return info


# ============================================================================
# Main orchestrator
# ============================================================================


async def main():
    parser = argparse.ArgumentParser(description="Run E-Learning benchmark suite")
    parser.add_argument("--output", default="results", help="Output directory")
    parser.add_argument("--scale", type=float, default=1.0, help="Data scale factor")
    parser.add_argument("--quick", action="store_true", help="Quick run (scale 0.1, 30s each)")
    parser.add_argument("--pgbench-only", action="store_true")
    parser.add_argument("--k6-only", action="store_true")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", default="5432")
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--password", default="postgres")
    parser.add_argument("--database", default="elearning_db")
    args = parser.parse_args()

    if args.quick:
        args.scale = 0.1

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    run_id = datetime.now(TZ).strftime("%Y%m%d_%H%M%S")
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    pgbench_dir = run_dir / "pgbench"
    k6_dir = run_dir / "k6"
    report_file = run_dir / "benchmark_summary.md"
    data_file = run_dir / "benchmark_data.json"

    report: dict = {
        "run_id": run_id,
        "timestamp": datetime.now(TZ).isoformat(),
        "scale": args.scale,
        "base_url": args.base_url,
        "pgbench": None,
        "k6": None,
        "db_metrics_before": None,
        "db_metrics_after": None,
    }

    conn = await asyncpg.connect(
        host=args.host, port=args.port, user=args.user,
        password=args.password, database=args.database,
    )

    try:
        # --- Reset & snapshot before ---
        await reset_db_stats(conn)
        report["db_metrics_before"] = await collect_db_metrics(conn)
        print("Pre-run metrics captured.\n")

        # --- pgbench ---
        if not args.k6_only:
            print("=== pgbench SQL Benchmarks ===")
            report["pgbench"] = run_pgbench(pgbench_dir, args.host, args.port, args.user, args.password, args.database)
            print()

        # --- k6 ---
        if not args.pgbench_only:
            print("=== k6 API Benchmarks ===")
            report["k6"] = run_k6(k6_dir, args.base_url)
            print()

        # --- Snapshot after ---
        report["db_metrics_after"] = await collect_db_metrics(conn)
        print("Post-run metrics captured.\n")

        # --- Generate report ---
        _generate_report(report, report_file, data_file)
        print(f"Report written to {report_file}")
        print(f"Data written to {data_file}")

    finally:
        await conn.close()


def _generate_report(report: dict, md_path: Path, json_path: Path):
    """Write benchmark_summary.md and benchmark_data.json."""
    # JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str, ensure_ascii=False)

    # Markdown
    before = report.get("db_metrics_before", {}) or {}
    after = report.get("db_metrics_after", {}) or {}

    cache_before = before.get("cache", {})
    cache_after = after.get("cache", {})
    concur_before = before.get("concurrency", {})
    concur_after = after.get("concurrency", {})

    md = f"""# Benchmark Report — {report['run_id']}

**Timestamp:** {report['timestamp']}
**Scale:** {report['scale']}
**Base URL:** {report['base_url']}

## Database Metrics

### Cache Hit Ratio
| Metric | Before | After |
|--------|--------|-------|
| Disk reads | {cache_before.get('disk_reads', 'N/A')} | {cache_after.get('disk_reads', 'N/A')} |
| Cache hits | {cache_before.get('cache_hits', 'N/A')} | {cache_after.get('cache_hits', 'N/A')} |
| Hit ratio % | {cache_before.get('hit_ratio_pct', 'N/A')} | {cache_after.get('hit_ratio_pct', 'N/A')} |

### Concurrency
| Metric | Before | After |
|--------|--------|-------|
| Deadlocks | {concur_before.get('deadlocks', 'N/A')} | {concur_after.get('deadlocks', 'N/A')} |
| Commits | {concur_before.get('xact_commit', 'N/A')} | {concur_after.get('xact_commit', 'N/A')} |
| Rollbacks | {concur_before.get('xact_rollback', 'N/A')} | {concur_after.get('xact_rollback', 'N/A')} |

### Index Usage
| Metric | Value |
|--------|-------|
| Total indexes (non-PK/UQ) | {after.get('indexes', {}).get('total', 'N/A')} |
| Unused indexes | {after.get('indexes', {}).get('unused', 'N/A')} |

"""

    # pgbench
    pg = report.get("pgbench") or {}
    if pg:
        md += "## pgbench Results\n\n"
        for name, result in pg.items():
            md += f"### {name}\n"
            if "error" in result:
                md += f"**Error:** {result['error']}\n\n"
            else:
                md += f"- TPS (excl. connections): {result.get('tps_excluding_connections', 'N/A')}\n"
                md += f"- Avg latency: {result.get('latency_avg_ms', 'N/A')} ms\n\n"

    # k6
    k6 = report.get("k6") or {}
    if k6:
        md += "## k6 Results\n\n"
        if "error" in k6:
            md += f"**Error:** {k6['error']}\n"
        else:
            for key in ["http_req_duration", "http_reqs_rate", "http_req_failed", "checks"]:
                if key in k6:
                    md += f"- **{key}:** {k6[key]}\n"

    # Top queries
    top = after.get("top_queries", [])
    if top:
        md += "\n## Top-10 Slow Queries (pg_stat_statements)\n\n"
        md += "| Query | Calls | Avg ms | Max ms | Disk reads | Hit % |\n"
        md += "|-------|-------|--------|--------|------------|-------|\n"
        for q in top[:10]:
            query = (q.get("query", "") or "")[:80].replace("|", "/")
            md += f"| {query} | {q.get('calls', '')} | {q.get('avg_ms', '')} | {q.get('max_ms', '')} | {q.get('disk_reads', '')} | {q.get('hit_pct', '')} |\n"

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md)


if __name__ == "__main__":
    asyncio.run(main())
