import type { Observation } from "./briefing.ts";

export const demoDate = new Date("2026-11-19T12:00:00Z");
export const demoEvidence: Readonly<Record<string, Observation>> = {
  "mint-forgejo-script": { observedAt: "2026-11-19T10:00:00Z", outcome: "failed" },
  "mint-forgejo-service": { observedAt: "2026-11-19T10:00:00Z", outcome: "passed" },
  "mint-forgejo-timer": { observedAt: "2026-11-19T10:00:00Z", outcome: "passed" },
  "pi5-restic-job": { observedAt: "2026-11-18T12:00:00Z", outcome: "passed" },
  "mint-prox-pull-job": { observedAt: "2026-11-18T12:00:00Z", outcome: "passed" },
  "pi5-backup": { observedAt: "2026-11-18T12:00:00Z", outcome: "passed" },
  "mint-check": { observedAt: "2026-11-18T12:00:00Z", outcome: "passed" },
  "nextcloud-guest": { observedAt: "2026-11-18T12:00:00Z", outcome: "passed" },
  "nextcloud-files": { observedAt: "2026-11-08T18:00:00Z", outcome: "passed" },
  "forgejo-archive": { observedAt: "2026-11-18T10:00:00Z", outcome: "passed" },
  "forgejo-present": { observedAt: "2026-11-18T10:00:00Z", outcome: "passed" },
  "forgejo-guest": { observedAt: "2026-11-19T10:00:00Z", outcome: "passed" },
  "forgejo-boot": { observedAt: "2026-10-15T10:00:00Z", outcome: "passed" },
};
