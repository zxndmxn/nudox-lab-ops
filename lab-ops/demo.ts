import { buildBriefing, nextcloudBackupCoverage } from "./briefing.ts";
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
  "# Nudox Lab Ops",
  "",
  evidencePath
    ? "Maintenance briefing · Local evidence evaluated against demo thresholds"
    : "Maintenance briefing · Fictional observations and demo thresholds",
  "",
  "## What needs attention",
  "",
  `Nextcloud backup coverage: **${nextcloudBackupCoverage(briefing)}**.`,
  ...briefing
    .filter((row) => row.state !== "current")
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
  nextcloudBackupCoverage(briefing) === "gap"
    ? "Look up `nextcloudBackupCoverage` to inspect how the two archive checks produce the gap."
    : "Look up `nextcloudBackupCoverage` to inspect how the two archive checks decide coverage.",
  "Look up `assessObservation` to inspect the freshness rule, then find its caller `buildBriefing`.",
  "",
];
console.log(lines.join("\n"));
