// Compare the bench workflow across two repositories (GitHub REST, `gh auth token`).
// Usage: bun scripts/compare.ts <hosted-repo> <sylphx-repo> [runs=8]
// Per job: pickup = started_at - created_at, run = completed_at - started_at,
// over the last N completed runs of `bench` in each repository.
const [hosted, ours, runsArg] = process.argv.slice(2);
if (!hosted || !ours) throw new Error("usage: compare.ts <hosted-repo> <sylphx-repo> [runs]");
const runs = Number(runsArg ?? 8);
const token = (await Bun.$`gh auth token`.text()).trim();
const api = async (path: string) => {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<any>;
};
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
};
async function collect(repo: string) {
  const list = await api(`repos/${repo}/actions/workflows/bench.yml/runs?status=completed&per_page=${runs}`);
  const byJob = new Map<string, { pickup: number[]; run: number[] }>();
  for (const run of list.workflow_runs) {
    const jobs = await api(`repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`);
    for (const job of jobs.jobs) {
      if (job.conclusion !== "success") continue;
      const name = job.name.replace(/ \(.*\)$/, "");
      const entry = byJob.get(name) ?? { pickup: [], run: [] };
      const t = (s: string) => new Date(s).getTime() / 1000;
      entry.pickup.push(t(job.started_at) - t(job.created_at));
      entry.run.push(t(job.completed_at) - t(job.started_at));
      byJob.set(name, entry);
    }
  }
  return byJob;
}
const [a, b] = await Promise.all([collect(hosted), collect(ours)]);
console.log(`| job | hosted pickup p50/p95 | ours pickup p50/p95 | hosted run p50 | ours run p50 | ours / hosted |`);
console.log(`| --- | --- | --- | --- | --- | --- |`);
for (const name of new Set([...a.keys(), ...b.keys()])) {
  const x = a.get(name), y = b.get(name);
  const f = (v: number) => (Number.isNaN(v) ? "-" : `${Math.round(v)} s`);
  const ratio = x && y ? (q(y.run, 0.5) / q(x.run, 0.5)).toFixed(2) : "-";
  console.log(`| ${name} | ${f(q(x?.pickup ?? [], 0.5))} / ${f(q(x?.pickup ?? [], 0.95))} | ${f(q(y?.pickup ?? [], 0.5))} / ${f(q(y?.pickup ?? [], 0.95))} | ${f(q(x?.run ?? [], 0.5))} | ${f(q(y?.run ?? [], 0.5))} | ${ratio} |`);
}
