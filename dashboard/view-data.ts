import { buildBriefing, needsAttention, nextcloudBackupCoverage, resticReadiness } from "../lab-ops/briefing.ts";
import { compareBriefings, previewCoverageAlert } from "../lab-ops/changes.ts";
import { parseEvidence, readLocalExport } from "../lab-ops/evidence.ts";

type Briefing = ReturnType<typeof buildBriefing>;

export function scenario(label: string, current: Briefing, baseline: Briefing | null, at: Date | null) {
  return { label, rows: current, coverage: nextcloudBackupCoverage(current),
    readiness: resticReadiness(current), attention: needsAttention(current).map(({ id }) => id),
    comparedAt: at?.toISOString() ?? null,
    changes: baseline ? compareBriefings(baseline, current) : [],
    alert: baseline ? previewCoverageAlert(baseline, current) : null };
}

export function readSnapshot(path: string) {
  const snapshot = readLocalExport(path);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) ||
      !("asOf" in snapshot) || typeof snapshot.asOf !== "string" || !("evidence" in snapshot)) {
    throw new Error("Expected a Lab Ops snapshot.");
  }
  const at = new Date(snapshot.asOf);
  if (!Number.isFinite(at.getTime())) throw new Error("Invalid snapshot time.");
  return { at, rows: buildBriefing(parseEvidence(snapshot.evidence), at) };
}
