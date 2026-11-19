import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBriefing, nextcloudBackupCoverage } from "./briefing.ts";
import { parseEvidence } from "./evidence.ts";
import { compareBriefings, previewCoverageAlert } from "./changes.ts";

const now = new Date("2026-11-19T12:00:00Z");
const fresh = { observedAt: "2026-11-19T11:00:00Z", outcome: "passed" } as const;
const stale = { observedAt: "2026-11-08T11:00:00Z", outcome: "passed" } as const;

test("a current guest archive does not cover stale Nextcloud files", () => {
  const briefing = buildBriefing({ "nextcloud-guest": fresh, "nextcloud-files": stale }, now);
  assert.equal(nextcloudBackupCoverage(briefing), "gap");
  assert.equal(briefing.find((row) => row.id === "nextcloud-restore")?.state, "unknown");
});

test("coverage needs affirmative evidence for both archives", () => {
  assert.equal(nextcloudBackupCoverage(buildBriefing({ "nextcloud-guest": fresh }, now)), "unknown");
  assert.equal(nextcloudBackupCoverage(buildBriefing({
    "nextcloud-guest": fresh,
    "nextcloud-files": fresh,
  }, now)), "current");
});

test("job evidence does not stand in for snapshot evidence", () => {
  const briefing = buildBriefing(parseEvidence({ "pi5-restic-job": fresh }), now);
  assert.equal(briefing.find((row) => row.id === "pi5-restic-job")?.state, "current");
  assert.equal(briefing.find((row) => row.id === "pi5-backup")?.state, "unknown");
});

test("evidence cannot carry arbitrary fields, timestamps or check IDs", () => {
  assert.throws(() => parseEvidence({ "forgejo-guest": { ...fresh, payload: "private" } }));
  assert.throws(() => parseEvidence({ "private-hostname": fresh }));
  assert.throws(() => parseEvidence({
    "forgejo-guest": { ...fresh, observedAt: "2026-02-30T00:00:00Z" },
  }));
});

test("notification previews follow coverage transitions and ignore steady state", () => {
  const good = buildBriefing({ "nextcloud-guest": fresh, "nextcloud-files": fresh }, now);
  const gap = buildBriefing({ "nextcloud-guest": fresh, "nextcloud-files": stale }, now);
  assert.deepEqual(compareBriefings(good, gap).map(({ id, before, after }) =>
    [id, before, after]), [["nextcloud-files", "current", "stale"]]);
  assert.match(previewCoverageAlert(good, gap)?.title ?? "", /gap/);
  assert.equal(previewCoverageAlert(gap, gap), null);
  assert.match(previewCoverageAlert(gap, good)?.title ?? "", /restored/);
  assert.equal(previewCoverageAlert(gap, buildBriefing({}, now)), null);
});
