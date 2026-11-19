# Lab Ops

Is my homelab actually recoverable? Lab Ops answers that for a Pi 5, a Mint backup box and a Proxmox host. It reads local receipts (restic jobs and snapshots, repository checks, Proxmox archives, Forgejo drift), shows what needs attention, and asks Codex to investigate and explain what to do next. [Nudox](https://nudox.org/) indexes the rules so you can jump to the code behind any state.

Part of the KSU AI Hackathon, alongside [DegreePath](https://github.com/zxndmxn/DegreePath_KSUAI).

The core idea: a job that succeeded, a fresh snapshot, a passing repository check and a working restore are four different facts. Lab Ops never lets one stand in for another.

## Status

| Area | State |
| --- | --- |
| Restic readiness (job, snapshot, repository check) | Working, tested |
| Dashboard: Live and Demo views, attention list, what changed | Working, offline single HTML file |
| Forgejo drift (deployed vs checked-in backup script) | Working; found real drift on Mint |
| Agent investigation (Codex reads receipts, explains next steps) | Working on real receipts, about a minute per run |
| Nudox code lookup | Working with the patched Windows client over local MCP |
| ntfy alert | Preview only, nothing is sent |

## Quick start

Needs Node.js 22.18 or newer.

```sh
git clone https://github.com/zxndmxn/nudox-lab-map.git
cd nudox-lab-map
node dashboard/build.ts lab-ops-demo.html   # demo dashboard, no network
node lab-ops/demo.ts                        # same briefing as Markdown
```

## The demo story

1. The Pi 5 restic job reports **success**. A normal dashboard shows green.
2. The newest snapshot is 11 days old. Lab Ops flags **Restic backups: Gap**.
3. The agent panel explains why: the job runs but writes nothing, and it names the exact checks and next command.
4. Switch **Snapshot missing / Snapshot verified** to watch the gap open and clear, with an ntfy preview for each change.
5. In Nudox, search `resticReadiness` to land on the rule behind the verdict.

## Agent investigation

```sh
node lab-ops/agent/investigate.ts --evidence EVIDENCE.json --receipts RECEIPTS_DIR --out FINDINGS.json
node dashboard/build.ts OUT.html EVIDENCE.json [BASELINE.json] --agent FINDINGS.json
```

- Uses the Codex CLI (or the one inside the Codex desktop app). Set `CODEX_BIN` if it is somewhere else.
- Codex works in a disposable copy of the briefing, receipts and rules. It has no network or host access and is told to only read. IP addresses and `user@host` strings are redacted first.
- Output follows `lab-ops/agent/schema.json`: a summary and up to four findings with severity, evidence as `file:line`, and a next step.
- Add `--nudox MCP_URL` (or `LAB_OPS_NUDOX_MCP`) to let Codex use Nudox for code lookup.
- The Demo view shows `lab-ops/agent/sample-findings.json`, a fictional sample run.

## Live evidence

Live data stays on your machine, outside this checkout.

1. Write a local evidence JSON: known check IDs with `observedAt` (UTC, e.g. `2026-11-19T12:00:00Z`) and `outcome` (`passed` or `failed`). Missing checks stay **Needs verification**.
2. Dashboard: `node dashboard/build.ts OUT.html EVIDENCE.json [BASELINE.json] [--agent FINDINGS.json]`. It opens on **Live** with a **Demo** tab. Do not share it.
3. Baseline for the next run: `node dashboard/snapshot.ts EVIDENCE.json > BASELINE.json`.

An SSH job result never fills in snapshot, archive or restore checks. Time limits are demo defaults.

## Using Nudox

1. Get an API key from the [Nudox dashboard](https://dashboard.nudox.org/).
2. Run the Windows client (Lindsey) and point it at the `lab-ops` folder.
3. Verified lookups over local MCP: `nextcloudBackupCoverage` resolves, and `buildBriefing` is an incoming reference to `assessObservation`.

Lindsey v0.1.0 on Windows can open to a black window (oversized initial surface, then DXGI device loss). A local patch setting the initial size to 1280 x 800 fixes it.

## How it works

```
local receipts (outside repo) ──> evidence JSON ──> rules (lab-ops/briefing.ts) ──> dashboard + Markdown briefing
                         \                                   │
                          └──> Codex agent (lab-ops/agent) ──┘  findings with evidence and next steps
                                                     Nudox indexes lab-ops/ for code lookup
```

## Tests

```sh
node --test lab-ops/briefing.test.ts dashboard/archive-receipts.test.ts
python -m unittest discover -s tests -v       # dependency map
```

## Privacy and data

- Receipts, evidence, findings and live dashboards stay outside the repo. The build refuses to write live output inside the checkout.
- The agent sees redacted receipts only. Nudox only indexes `lab-ops/`: hand-written rules and fictional observations.
- Vault notes, scripts, configs, IPs, logs and credentials never enter Git or the indexed package.

## Project layout

| Path | What it does |
| --- | --- |
| `lab-ops/briefing.ts` | Checks, freshness rule, `resticReadiness`, `needsAttention` |
| `lab-ops/evidence.ts` | Parses local evidence JSON |
| `lab-ops/changes.ts` | What changed since the last baseline, ntfy preview |
| `lab-ops/agent/` | Codex investigation: prompt, output schema, runner, sample run |
| `lab-ops/sample.ts` | Fictional demo observations |
| `lab-ops/demo.ts` | Markdown briefing CLI |
| `dashboard/` | Dashboard builder, snapshots, receipt and drift merges |
| `impact.py`, `viewer.html`, `tests/` | Original backup dependency map pilot (synthetic) |
| `vault_index.py` | Optional local vault inventory |
