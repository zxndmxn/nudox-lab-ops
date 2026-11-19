import { readFileSync } from "node:fs";
import { loadLocalEvidence } from "../lab-ops/evidence.ts";

const [evidence, report, ...extra] = process.argv.slice(2);
if (!evidence || !report || extra.length) {
  throw new Error("Usage: node dashboard/merge-drift.ts LOCAL-EVIDENCE.json DRIFT-RECEIPT.txt");
}
const observations = loadLocalEvidence(evidence);
const lines = readFileSync(report, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/);
const clock = /^as-of\|(\d{10})$/.exec(lines[1] ?? "");
if (lines.length !== 5 || lines[0] !== "forgejo-drift-v1" || !clock) {
  throw new Error("Incomplete Forgejo drift receipt.");
}
const occurred = new Date(Number(clock[1]) * 1000);
if (occurred > new Date()) throw new Error("Forgejo drift receipt is dated in the future.");
const observedAt = occurred.toISOString().replace(".000Z", "Z");
for (const [index, id] of ["mint-forgejo-script", "mint-forgejo-service", "mint-forgejo-timer"].entries()) {
  const [check, state, ...rest] = lines[index + 2].split("|");
  if (check !== id || rest.length || (state !== "passed" && state !== "failed" && state !== "unknown")) {
    throw new Error("Invalid Forgejo drift result.");
  }
  delete observations[id];
  if (state !== "unknown") observations[id] = { observedAt, outcome: state };
}
console.log(JSON.stringify(observations, null, 2));
