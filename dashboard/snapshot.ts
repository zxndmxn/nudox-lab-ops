import { loadLocalEvidence } from "../lab-ops/evidence.ts";

const [file, at, ...extra] = process.argv.slice(2);
if (!file || extra.length) {
  throw new Error("Usage: node dashboard/snapshot.ts LOCAL-EVIDENCE.json [UTC date and time]");
}
const asOf = at ? new Date(at) : new Date();
if (!Number.isFinite(asOf.getTime()) || asOf > new Date()) {
  throw new Error("Snapshot time must be a valid date in the past or present.");
}
console.log(JSON.stringify({
  asOf: asOf.toISOString(),
  evidence: loadLocalEvidence(file),
}, null, 2));
