import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { buildBriefing, needsAttention, nextcloudBackupCoverage, resticReadiness } from "../lab-ops/briefing.ts";
import { loadLocalEvidence, parseEvidence, readLocalExport } from "../lab-ops/evidence.ts";
import { compareBriefings, previewCoverageAlert } from "../lab-ops/changes.ts";
import { demoDate, demoEvidence } from "../lab-ops/sample.ts";

const argv = process.argv.slice(2);
const agentFlag = argv.indexOf("--agent");
const agentPath = agentFlag >= 0 ? argv.splice(agentFlag, 2)[1] : undefined;
const [output, evidencePath, baselinePath, ...extra] = argv;
if (!output || extra.length) {
  throw new Error("Usage: node dashboard/build.ts OUTPUT.html [LOCAL-EVIDENCE.json] [BASELINE.json] [--agent FINDINGS.json]");
}
if (evidencePath) {
  const checkout = realpathSync(resolve(import.meta.dirname, ".."));
  const target = resolve(output);
  const folder = existsSync(target) ? dirname(realpathSync(target)) : realpathSync(dirname(target));
  const location = relative(checkout, folder);
  if (location === "" || (!isAbsolute(location) && location !== ".." && !location.startsWith(".." + sep))) {
    throw new Error("Keep live dashboards outside the project checkout.");
  }
}

type Briefing = ReturnType<typeof buildBriefing>;

function readBaseline(path: string, asOf: Date) {
  const snapshot = readLocalExport(path);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) ||
      !("asOf" in snapshot) || typeof snapshot.asOf !== "string" || !("evidence" in snapshot)) {
    throw new Error("Baseline must be a saved Lab Ops snapshot.");
  }
  const comparedAt = new Date(snapshot.asOf);
  if (!Number.isFinite(comparedAt.getTime()) || comparedAt >= asOf) {
    throw new Error("Baseline must be earlier than this briefing.");
  }
  return { comparedAt, rows: buildBriefing(parseEvidence(snapshot.evidence), comparedAt) };
}

function scenario(label: string, current: Briefing, baseline: Briefing | null, at: Date | null) {
  return { label, rows: current, coverage: nextcloudBackupCoverage(current),
    readiness: resticReadiness(current), attention: needsAttention(current).map(({ id }) => id),
    comparedAt: at?.toISOString() ?? null,
    changes: baseline ? compareBriefings(baseline, current) : [],
    alert: baseline ? previewCoverageAlert(baseline, current) : null };
}

function demoView() {
  const yesterday = new Date(demoDate.getTime() - 86_400_000);
  const priorRows = buildBriefing({
    ...demoEvidence,
    "mint-forgejo-script": { observedAt: "2026-11-18T10:00:00Z", outcome: "passed" },
    "mint-forgejo-service": { observedAt: "2026-11-18T10:00:00Z", outcome: "passed" },
    "mint-forgejo-timer": { observedAt: "2026-11-18T10:00:00Z", outcome: "passed" },
    "forgejo-guest": { observedAt: "2026-11-18T10:00:00Z", outcome: "passed" },
    "forgejo-dns": { observedAt: "2026-11-18T10:00:00Z", outcome: "passed" },
    "forgejo-proxy-http": { observedAt: "2026-11-18T10:00:00Z", outcome: "passed" },
    "nextcloud-files": { observedAt: "2026-11-17T12:30:00Z", outcome: "passed" },
  }, yesterday);
  const staleRows = buildBriefing(demoEvidence, demoDate);
  const freshRows = buildBriefing({
    ...demoEvidence,
    "pi5-backup": { observedAt: "2026-11-18T12:05:00Z", outcome: "passed" },
  }, demoDate);
  const earlierToday = new Date(demoDate.getTime() - 3_600_000);
  return {
    asOf: demoDate.toISOString(),
    agent: JSON.parse(readFileSync(new URL("../lab-ops/agent/sample-findings.json", import.meta.url), "utf8")),
    scenarios: [
      scenario("Snapshot missing", staleRows, priorRows, yesterday),
      scenario("Snapshot verified", freshRows, buildBriefing(demoEvidence, earlierToday), earlierToday),
    ],
  };
}

function liveView(path: string) {
  const now = new Date();
  const rows = buildBriefing(loadLocalEvidence(path), now);
  const baseline = baselinePath ? readBaseline(baselinePath, now) : null;
  return {
    asOf: now.toISOString(),
    agent: agentPath ? readLocalExport(agentPath) : null,
    scenarios: [scenario("Local evidence", rows, baseline?.rows ?? null, baseline?.comparedAt ?? null)],
  };
}

const data = JSON.stringify({ demo: demoView(), live: evidencePath ? liveView(evidencePath) : null })
  .replaceAll("<", "\\u003c");
const template = readFileSync(new URL("./page.html", import.meta.url), "utf8");
writeFileSync(output, template.replace("__BRIEFING_DATA__", () => data), "utf8");
