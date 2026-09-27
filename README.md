# runner-bench

The same CI jobs, timed on GitHub-hosted `ubuntu-latest` and on Sylphx Runners
`sylphx-linux-standard`: pickup under a six-job fan-out, a cold Rust release
build (ripgrep), a Bun install and build (hono), and a Docker build with no
cache. This repository runs the hosted side; a private twin runs the identical
workflow with `BENCH_RUNNER=sylphx-linux-standard`.

```sh
bun scripts/compare.ts SylphxAI/runner-bench SylphxAI/runner-bench-private
```

Pickup is `started_at − created_at` and run time is `completed_at − started_at`
of each job, from GitHub's own API.
