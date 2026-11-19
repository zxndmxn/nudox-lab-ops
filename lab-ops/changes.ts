import { buildBriefing, resticReadiness } from "./briefing.ts";

type Briefing = ReturnType<typeof buildBriefing>;

export function compareBriefings(previous: Briefing, current: Briefing) {
  const previousStates = new Map(previous.map((row) => [row.id, row.state]));
  return current.flatMap((row) => {
    const before = previousStates.get(row.id) ?? "unknown";
    if (before === row.state) return [];
    return [{ id: row.id, host: row.host, label: row.label, before,
      after: row.state, nextCheck: row.nextCheck }];
  });
}

/** Preview only. Identical readiness states produce no notification. */
export function previewCoverageAlert(previous: Briefing, current: Briefing) {
  const before = resticReadiness(previous);
  const after = resticReadiness(current);
  if (before !== "gap" && after === "gap") {
    return { title: "Restic backups need attention",
      message: "A job, snapshot or repository check is stale or failed. Open Lab Ops to see which." };
  }
  if (before === "gap" && after === "verified") {
    return { title: "Restic backups verified again",
      message: "Job, snapshot and repository check are all current. Restore drills are tracked separately." };
  }
  return null;
}
