import type { Observation } from "../lab-ops/briefing.ts";

export const resticChecks = ["pi5-restic-job", "pi5-backup", "mint-check"] as const;
type ResticCheck = typeof resticChecks[number];

/**
 * Parse a restic receipt read from systemd journals. Lines are `check|epoch|outcome` or `check|none`.
 * A job line comes from systemd's Finished/Failed message, a snapshot line only from restic's own
 * "snapshot <id> saved", and a check line only from "no errors were found". `none` stays unknown.
 */
export function parseResticReceipts(input: string): Partial<Record<ResticCheck, Observation>> {
  const lines = input.trim().split(/\r?\n/);
  if (lines[0] !== "restic-v1") throw new Error("Not a restic receipt.");
  const [asOfKey, asOf] = (lines[1] ?? "").split("|");
  const reference = Number(asOf);
  if (asOfKey !== "as-of" || !/^\d{10}$/.test(asOf) || reference > Math.floor(Date.now() / 1000) + 300) {
    throw new Error("Invalid restic receipt clock.");
  }
  const result: Partial<Record<ResticCheck, Observation>> = {};
  for (const line of lines.slice(2)) {
    const [id, value, outcome] = line.split("|");
    if (!(resticChecks as readonly string[]).includes(id)) continue;
    if (value === "none") continue;
    const epoch = Math.floor(Number(value));
    if (!/^\d{10}(?:\.\d+)?$/.test(value) || epoch > reference) throw new Error(`Invalid ${id} timestamp.`);
    if (outcome !== "passed" && outcome !== "failed") throw new Error(`Invalid ${id} outcome.`);
    result[id as ResticCheck] = { observedAt: new Date(epoch * 1000).toISOString().replace(".000Z", "Z"), outcome };
  }
  return result;
}
