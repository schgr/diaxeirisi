# Deterministic performance benchmark

Run with:

```text
npm run benchmark -- --output=benchmarks/results/local.json
```

The benchmark creates and deletes its own temporary database and files. It never
opens the application's real user-data directory. The generated dataset always
contains 1,500 shares, 6,751 transactions across fiscal years 2024–2026, an
archived 2023 snapshot, 300 synthetic photos, 150 compositions, 100 serial-number
registries and 60 ammunition registries.

Three iterations are used by default. Set `DCHSI_BENCH_ITERATIONS` only for local
diagnostics. A run exits non-zero when any declared response, event-loop-stall or
memory limit is exceeded.

## Stage result

Measurements below are milliseconds and use the median of three iterations,
except startup, transaction persistence, Excel and backup operations which run
once because they mutate or create files.

| Operation | Baseline | Final | Limit |
|---|---:|---:|---:|
| Fresh startup | 657.34 | 580.81 | 3,000 |
| Existing database startup | 34.81 | 37.43 | 3,000 |
| Share registry and HTML rows | 99.20 | 93.66 | 750 |
| Search across 1,500 shares | 6.17 | 8.37 | 250 |
| Open share card | 0.86 | 0.79 | 250 |
| Persist transaction | 12.74 | 10.79 | 1,000 |
| Prepare/render all 1,500 cards | 180.36 | 163.05 | 5,000 |
| Prepare/render 750 moved cards | 126.56 | 121.61 | 3,000 |
| Excel export in worker | 903.03 | 834.99 | 10,000 |
| Excel import in worker | 778.88 | 767.40 | 10,000 |
| Verified backup in worker | 808.24 | 846.97 | 10,000 |
| Maximum main-process stall | 24.30 | 27.41 | 1,500 |
| Maximum renderer-work stall | 194.38 | 168.14 | 250 |
| Maximum worker-task stall | 9.96 | 10.82 | 250 |
| RSS (MB) | 214.71 | 211.21 | 700 |

No production optimization or schema migration was made. All measured paths
were below their acceptance limits. Query plans confirm that share-card lookup
uses `idx_share_transactions_share_year`; the registry uses
`idx_share_archive_status`. Its temporary B-tree sort completed well below the
registry limit, so an additional published-schema index was not justified.

The baseline and final JSON reports are retained under `benchmarks/results/`.
