import type { Observation } from "../lab-ops/briefing.ts";

export const archiveChecks = ["nextcloud-guest", "nextcloud-files", "forgejo-present"] as const;
type ArchiveCheck = typeof archiveChecks[number];

/** Convert a complete, metadata-only receipt without inferring integrity. */
export function parseArchiveReceipts(input: string): Partial<Record<ArchiveCheck, Observation>> {
  const lines = input.trim().split(/\r?\n/);
  if (lines.length !== 5 || lines[0] !== "receipt-v1") {
    throw new Error("Incomplete archive receipt.");
  }
  const [asOfKey, asOf] = lines[1].split("|");
  const reference = Number(asOf);
  if (asOfKey !== "as-of" || !/^\d{10}$/.test(asOf) || reference < 1) {
    throw new Error("Invalid archive receipt clock.");
  }
  const result: Partial<Record<ArchiveCheck, Observation>> = {};
  for (const [position, check] of archiveChecks.entries()) {
    const [id, value, ...extra] = lines[position + 2].split("|");
    if (id !== check || extra.length) throw new Error("Unexpected archive check.");
    if (value === "missing") continue;
    const epoch = Math.floor(Number(value));
    if (!/^\d{10}(?:\.\d+)?$/.test(value) || epoch > reference) {
      throw new Error("Invalid archive timestamp.");
    }
    result[check] = {
      observedAt: new Date(epoch * 1000).toISOString().replace(".000Z", "Z"),
      outcome: "passed",
    };
  }
  return result;
}
