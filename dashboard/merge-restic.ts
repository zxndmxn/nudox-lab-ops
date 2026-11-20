import { readFileSync } from "node:fs";
import { loadLocalEvidence } from "../lab-ops/evidence.ts";
import { resticReceiptUpdates } from "./restic-receipts.ts";

const [evidencePath, ...receipts] = process.argv.slice(2);
if (!evidencePath || !receipts.length) {
  throw new Error("Usage: node dashboard/merge-restic.ts LOCAL-EVIDENCE.json RECEIPT.txt [RECEIPT.txt...]");
}
const observations = loadLocalEvidence(evidencePath);
for (const receipt of receipts) {
  for (const [id, value] of Object.entries(resticReceiptUpdates(readFileSync(receipt, "utf8").replace(/^\uFEFF/, "")))) {
    if (value === null) delete observations[id];
    else observations[id] = value;
  }
}
console.log(JSON.stringify(observations, null, 2));
