import { buildBriefing, needsAttention, nextcloudBackupCoverage, resticReadiness } from "./briefing.ts";
import { loadLocalEvidence } from "./evidence.ts";
import { demoDate, demoEvidence } from "./sample.ts";
const [flag, evidencePath, ...extra] = process.argv.slice(2);
if (flag !== undefined && (flag !== "--evidence" || !evidencePath || extra.length)) {
  throw new Error("Usage: node lab-ops/demo.ts [--evidence <local status export>]");
}
const briefing = buildBriefing(
  evidencePath ? loadLocalEvidence(evidencePath) : demoEvidence,
  evidencePath ? new Date() : demoDate,
);

const lines = [
  "# Lab Ops",
  "",
  evidencePath
    ? "Maintenance briefing · Local evidence evaluated against demo thresholds"
    : "Maintenance briefing · Fictional observations and demo thresholds",
  "",
  "## What needs attention",
  "",
  `Restic backups: **${resticReadiness(briefing)}**. Nextcloud archive coverage: ${nextcloudBackupCoverage(briefing)}.`,
  "",
  ...needsAttention(briefing)
    .map((row) => `- **${row.label}** · ${row.state}. ${row.nextCheck}`),
  "",
  "## Backup paths",
  "",
  "```mermaid",
  "flowchart LR",
  "    pi[Pi 5] -->|restic snapshot| mint[Mint backup storage]",
  "    prox[Proxmox] -->|guest archive| mint",
  "    prox -->|separate Nextcloud file archive| mint",
  "    prox -->|Forgejo archive| mint",
  "    mint --> drill[Restore drill]",
  "```",
  "",
  "## Evidence and next checks",
  "",
  "| Host | Check | State | Last observed UTC | Next check |",
  "| --- | --- | --- | --- | --- |",
  ...briefing.map((row) =>
    `| ${row.host} | ${row.label} | ${row.state} | ${row.observedAt ?? "none yet"} | ${row.nextCheck} |`
  ),
  "",
  "## Nudox code trace",
  "",
  "Look up `resticReadiness` to see why a passing job alone never verifies backups.",
  "Look up `assessObservation` for the freshness rule, then its caller `buildBriefing`.",
  "",
];
console.log(lines.join("\n"));
