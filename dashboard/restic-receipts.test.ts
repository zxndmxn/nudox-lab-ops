import assert from "node:assert/strict";
import test from "node:test";
import { parseResticReceipts, resticReceiptUpdates } from "./restic-receipts.ts";

test("restic receipts keep job, snapshot and check separate", () => {
  const parsed = parseResticReceipts("restic-v1\nas-of|1795150000\npi5-restic-job|1794748000|passed\npi5-backup|1794744360.5|passed\nmint-check|none\n");
  assert.equal(parsed["pi5-restic-job"]?.outcome, "passed");
  assert.equal(parsed["pi5-backup"]?.observedAt, "2026-11-15T12:06:00Z");
  assert.equal(parsed["mint-check"], undefined);
  const updates = resticReceiptUpdates("restic-v1\nas-of|1795150000\nmint-check|none");
  assert.deepEqual(updates, { "mint-check": null });
});

test("restic receipts reject future timestamps and bad outcomes", () => {
  assert.throws(() => parseResticReceipts("restic-v1\nas-of|1795150000\npi5-backup|1795160000|passed"));
  assert.throws(() => parseResticReceipts("restic-v1\nas-of|1795150000\npi5-backup|1795140000|maybe"));
  assert.throws(() => parseResticReceipts("receipt-v1\nas-of|1795150000"));
});
