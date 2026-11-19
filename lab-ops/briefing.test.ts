import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBriefing, needsAttention, nextcloudBackupCoverage, resticReadiness } from "./briefing.ts";
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

test("a running Forgejo guest and boot receipt do not imply a working restored clone", () => {
  const rows = buildBriefing(parseEvidence({
    "forgejo-guest": fresh,
    "forgejo-boot": fresh,
  }), now);
  assert.equal(rows.find((row) => row.id === "forgejo-boot")?.state, "current");
  assert.equal(rows.find((row) => row.id === "forgejo-restore-http")?.state, "unknown");
  assert.equal(rows.find((row) => row.id === "forgejo-restore-clone")?.state, "unknown");
});

test("evidence cannot carry arbitrary fields, timestamps or check IDs", () => {
  assert.throws(() => parseEvidence({ "forgejo-guest": { ...fresh, payload: "private" } }));
  assert.throws(() => parseEvidence({ "private-hostname": fresh }));
  assert.throws(() => parseEvidence({
    "forgejo-guest": { ...fresh, observedAt: "2026-02-30T00:00:00Z" },
  }));
});

test("a working resolver and running guest can coexist with a failed proxy route", () => {
  const rows = buildBriefing(parseEvidence({
    "forgejo-dns": fresh,
    "forgejo-proxy-http": { ...fresh, outcome: "failed" },
    "forgejo-guest": fresh,
  }), now);
  for (const [id, state] of [["forgejo-dns", "current"], ["forgejo-proxy-http", "failed"], ["forgejo-guest", "current"]]) {
    assert.equal(rows.find((row) => row.id === id)?.state, state);
  }
});

test("a successful restic job does not verify backups without a new snapshot", () => {
  const chain = { "pi5-restic-job": fresh, "mint-check": fresh };
  assert.equal(resticReadiness(buildBriefing({ ...chain, "pi5-backup": stale }, now)), "gap");
  assert.equal(resticReadiness(buildBriefing(chain, now)), "unverified");
  assert.equal(resticReadiness(buildBriefing({ ...chain, "pi5-backup": fresh }, now)), "verified");
});

test("attention list puts failures first and restic chain checks ahead of others", () => {
  const rows = needsAttention(buildBriefing({
    "pi5-restic-job": fresh, "mint-check": fresh, "pi5-backup": stale,
    "nextcloud-files": stale,
    "mint-forgejo-script": { ...fresh, outcome: "failed" },
  }, now));
  assert.deepEqual(rows.slice(0, 3).map(({ id }) => id), ["mint-forgejo-script", "pi5-backup", "nextcloud-files"]);
  assert.ok(rows.every(({ state }) => state !== "current"));
});

test("notification previews follow restic readiness transitions and ignore steady state", () => {
  const chain = { "pi5-restic-job": fresh, "mint-check": fresh };
  const good = buildBriefing({ ...chain, "pi5-backup": fresh }, now);
  const gap = buildBriefing({ ...chain, "pi5-backup": stale }, now);
  assert.deepEqual(compareBriefings(good, gap).map(({ id, before, after }) =>
    [id, before, after]), [["pi5-backup", "current", "stale"]]);
  assert.match(previewCoverageAlert(good, gap)?.title ?? "", /need attention/);
  assert.equal(previewCoverageAlert(gap, gap), null);
  assert.match(previewCoverageAlert(gap, good)?.title ?? "", /verified again/);
  assert.equal(previewCoverageAlert(gap, buildBriefing({}, now)), null);
});
