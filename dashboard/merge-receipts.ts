import { readFileSync } from "node:fs";
import { loadLocalEvidence } from "../lab-ops/evidence.ts";
import { archiveChecks, parseArchiveReceipts } from "./archive-receipts.ts";

const [evidencePath, receipt, ...extra] = process.argv.slice(2);
if (!evidencePath || !receipt || extra.length) {
  throw new Error("Usage: node dashboard/merge-receipts.ts LOCAL-EVIDENCE.json LOCAL-RECEIPT.txt");
}
const observations = loadLocalEvidence(evidencePath);
const bytes = readFileSync(receipt);
const text = bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))
  ? bytes.toString("utf16le").slice(1)
  : bytes.toString("utf8").replace(/^\uFEFF/, "");
const archives = parseArchiveReceipts(text);
for (const check of archiveChecks) delete observations[check];
console.log(JSON.stringify({ ...observations, ...archives }, null, 2));
