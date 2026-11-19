import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBriefing, nextcloudBackupCoverage } from "../lab-ops/briefing.ts";
import { parseArchiveReceipts } from "./archive-receipts.ts";

test("a successful inventory scan that finds no archive reports a coverage gap", () => {
  const checkedAt = "2025-01-01T12:00:00Z";
  const scannedAt = Date.parse(checkedAt) / 1_000;
  const receipt = [
    "receipt-v1", "as-of|" + scannedAt, "nextcloud-guest|" + (scannedAt - 60),
    "nextcloud-files|missing", "forgejo-present|missing",
  ].join("\n");
  const evidence = parseArchiveReceipts(receipt);
  assert.deepEqual(evidence["nextcloud-files"], { observedAt: checkedAt, outcome: "failed" });
  assert.equal(nextcloudBackupCoverage(buildBriefing(evidence, new Date(checkedAt))), "gap");
  assert.throws(() => parseArchiveReceipts(receipt.replace("as-of|", "as-of|invalid|")));
});
