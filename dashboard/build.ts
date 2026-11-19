import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { buildBriefing, nextcloudBackupCoverage } from "../lab-ops/briefing.ts";
import { loadLocalEvidence, parseEvidence, readLocalExport } from "../lab-ops/evidence.ts";
import { compareBriefings, previewCoverageAlert } from "../lab-ops/changes.ts";
import { demoDate, demoEvidence } from "../lab-ops/sample.ts";

const [output, evidencePath, baselinePath, ...extra] = process.argv.slice(2);
if (!output || extra.length) {
  throw new Error("Usage: node dashboard/build.ts OUTPUT.html [LOCAL-EVIDENCE.json] [BASELINE.json]");
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
  }, yesterday);
  const staleRows = buildBriefing(demoEvidence, demoDate);
  const freshRows = buildBriefing({
    ...demoEvidence,
    "nextcloud-files": { observedAt: "2026-11-18T12:00:00Z", outcome: "passed" },
  }, demoDate);
  const earlierToday = new Date(demoDate.getTime() - 3_600_000);
  return {
    asOf: demoDate.toISOString(),
    scenarios: [
      scenario("Stale file archive", staleRows, priorRows, yesterday),
      scenario("Fresh file archive", freshRows, buildBriefing(demoEvidence, earlierToday), earlierToday),
    ],
  };
}

function liveView(path: string) {
  const now = new Date();
  const rows = buildBriefing(loadLocalEvidence(path), now);
  const baseline = baselinePath ? readBaseline(baselinePath, now) : null;
  return {
    asOf: now.toISOString(),
    scenarios: [scenario("Local evidence", rows, baseline?.rows ?? null, baseline?.comparedAt ?? null)],
  };
}

const data = JSON.stringify({ demo: demoView(), live: evidencePath ? liveView(evidencePath) : null })
  .replaceAll("<", "\\u003c");
const template = readFileSync(new URL("./page.html", import.meta.url), "utf8");
writeFileSync(output, template.replace("__BRIEFING_DATA__", () => data), "utf8");
