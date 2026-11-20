import { readFileSync } from "node:fs";
import { loadLocalEvidence } from "../lab-ops/evidence.ts";
import { parseResticReceipts, resticChecks } from "./restic-receipts.ts";

const [evidencePath, ...receipts] = process.argv.slice(2);
if (!evidencePath || !receipts.length) {
  throw new Error("Usage: node dashboard/merge-restic.ts LOCAL-EVIDENCE.json RECEIPT.txt [RECEIPT.txt...]");
}
const observations = loadLocalEvidence(evidencePath);
const found = Object.assign({}, ...receipts.map((path) => parseResticReceipts(readFileSync(path, "utf8").replace(/^﻿/, ""))));
// A receipt that says `none` clears stale evidence for that check.
for (const check of resticChecks) if (!(check in found)) delete observations[check];
console.log(JSON.stringify({ ...observations, ...found }, null, 2));
