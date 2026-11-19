# Nudox Lab Ops

A homelab maintenance briefing for Pi 5, Mint and Proxmox. Lab Ops evaluates local evidence and shows which checks need attention. [Nudox](https://nudox.org/) indexes the briefing rules so you can inspect their source and references in Lindsey.

Part of the KSU AI Hackathon, alongside [DegreePath](https://github.com/zxndmxn/DegreePath_KSUAI).

## Status

| Area | State |
| --- | --- |
| Lab Ops briefing (backup coverage rules) | Working, 8 tests |
| Dashboard with Live and Demo views | Working, offline single HTML file |
| What changed? panel (Forgejo vs deployed drift) | Working; found real drift on Mint's backup pull script |
| ntfy alerts | Preview only, nothing is sent |
| Nudox code lookup over local MCP | Working with the patched Windows client |
| Backup dependency map (Python) | Working on synthetic fixtures, 4 tests |
| Restore receipts, DNS/NPM tracing, n8n inbox | Planned ([docs/integrations.md](docs/integrations.md)) |

## Quick start

Needs Node.js 22.18 or newer and Python 3.11 or newer.

```sh
git clone https://github.com/zxndmxn/nudox-lab-map.git
cd nudox-lab-map
node lab-ops/demo.ts                      # Markdown briefing (Obsidian renders the map)
node dashboard/build.ts lab-ops-demo.html # shareable demo dashboard
```

Open the HTML file in a browser. It makes no network requests.

## The demo story

1. The Proxmox guest backup for Nextcloud is fresh, so a normal dashboard shows green.
2. Nextcloud's **separate** file archive is stale. Lab Ops flags a coverage gap.
3. Switch **Stale file archive / Fresh file archive** to watch the gap open and clear, with an ntfy preview for each change.
4. In Nudox, search `assessObservation` and open References to land on `buildBriefing`, the code behind the finding.

The core idea: a successful job, a verified archive and a working restore are three different facts. Lab Ops never lets one stand in for another.

## Using live evidence

Live data stays on your machine, outside this checkout.

Live groups checks by host and shows the Proxmox archive path to Mint. Its header shows the newest recorded observation. A successful inventory scan that finds no archive reports a failed check. An unavailable inventory produces no new receipt.

1. Write a local evidence JSON. Each entry is a known check ID with `observedAt` (UTC, e.g. `2026-11-19T12:00:00Z`) and `outcome` (`passed` or `failed`). Missing checks stay **unknown**.
2. Briefing: `node lab-ops/demo.ts --evidence PATH`
3. Private dashboard: `node dashboard/build.ts OUT.html EVIDENCE.json [BASELINE.json]`. It opens on **Live** with a **Demo** tab. Do not share it, since it contains live data.
4. Baseline for the next run: `node dashboard/snapshot.ts EVIDENCE.json > BASELINE.json`. Without a baseline, Live shows no transitions.

An SSH job result never fills in snapshot, archive or restore checks. Time limits are demo defaults.

## Using Nudox

1. Get an API key from the [Nudox dashboard](https://dashboard.nudox.org/).
2. Run the Windows client (Lindsey) and point it at the `lab-ops` folder.
3. Query through local MCP. Verified lookups: `nextcloudBackupCoverage` resolves, and `buildBriefing` is an incoming reference to `assessObservation`.

Lindsey v0.1.0 on Windows can open to a black window (oversized initial surface, then DXGI device loss). A local patch setting the initial size to 1280 x 800 fixes it. `docs/codex-mcp.example.toml` shows the remote MCP config shape.

## How it works

```
hand-written topology (lab-ops/sample.ts)   local evidence JSON (outside repo)
                \                           /
             rules + briefing (lab-ops/briefing.ts, evidence.ts, changes.ts)
                              |
          Markdown briefing  /  dashboard (dashboard/)  /  ntfy preview
                              |
            Nudox indexes lab-ops/ for code lookup and impact
```

## Tests

```sh
node --test lab-ops/briefing.test.ts dashboard/archive-receipts.test.ts
python -m unittest discover -s tests -v       # 4 tests: dependency map
```

## Privacy and data

- Nudox only indexes `lab-ops/`: hand-written relationships and fictional observations.
- Vault notes, `Personal/`, scripts, configs, IPs, logs and credentials never enter the indexed package or Git.
- Nudox's servers do see key validation and request counts.
- `vault_index.py` is an optional local inventory. It skips `Personal` folders, never reads note bodies, and its output belongs outside the repo.

## Backup dependency map

The original pilot: select a component, trace what a change would affect, and see which recovery checks lack evidence. Uses synthetic fixtures only.

```sh
python impact.py   # then open dist/index.html
```

## Project layout

| Path | What it does |
| --- | --- |
| `lab-ops/briefing.ts` | Coverage rules and `buildBriefing` |
| `lab-ops/evidence.ts` | Parses local evidence JSON |
| `lab-ops/changes.ts` | What changed since the last baseline |
| `lab-ops/sample.ts` | Hand-written topology and fictional observations |
| `lab-ops/demo.ts` | Markdown briefing CLI |
| `dashboard/` | Dashboard builder, snapshots, receipt and drift merges |
| `impact.py`, `viewer.html`, `tests/` | Backup dependency map |
| `vault_index.py` | Optional local vault inventory |
| `docs/integrations.md` | Integration plan |

## Next up

1. **Restore receipts:** record a Forgejo isolated boot and test clone as separate checks.
2. **Forgejo drift:** review the Mint backup script diff and classify it.
3. **ntfy sender:** send once when a gap opens, once when it clears.
4. **DNS and Nginx Proxy Manager:** separate DNS failure, proxy failure and stopped guest.
5. **n8n inbox:** pull selected workflow findings into the briefing.
