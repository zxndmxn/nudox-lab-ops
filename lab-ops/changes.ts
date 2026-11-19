import { buildBriefing, nextcloudBackupCoverage } from "./briefing.ts";

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

/** Preview only. Identical coverage states produce no notification. */
export function previewCoverageAlert(previous: Briefing, current: Briefing) {
  const before = nextcloudBackupCoverage(previous);
  const after = nextcloudBackupCoverage(current);
  if (before !== "gap" && after === "gap") {
    return { title: "Nextcloud backup coverage gap",
      message: "Open Lab Ops and check which archive needs attention." };
  }
  if (before === "gap" && after === "current") {
    return { title: "Nextcloud backup coverage restored",
      message: "Both archive checks are current. Review restore evidence separately." };
  }
  return null;
}
