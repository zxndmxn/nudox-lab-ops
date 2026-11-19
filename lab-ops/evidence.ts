import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { requirements, type Observation } from "./briefing.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const knownChecks = new Set(requirements.map(({ id }) => id));

/** Accept only known check IDs, UTC timestamps and pass/fail outcomes. */
export function parseEvidence(raw: unknown): Partial<Record<string, Observation>> {
  if (!isRecord(raw)) throw new Error("Evidence must be an object keyed by check ID.");
  const safe: Partial<Record<string, Observation>> = Object.create(null);
  for (const [id, row] of Object.entries(raw)) {
    if (!knownChecks.has(id)) throw new Error("Evidence contains an unknown check ID.");
    if (!isRecord(row) || Object.keys(row).length !== 2) {
      throw new Error("Each observation must contain only observedAt and outcome.");
    }
    const { observedAt, outcome } = row;
    if (outcome !== "passed" && outcome !== "failed") {
      throw new Error("Observation outcome must be passed or failed.");
    }
    if (typeof observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(observedAt)) {
      throw new Error("Use UTC timestamps like 2026-11-19T12:00:00Z.");
    }
    const stamp = new Date(observedAt);
    if (!Number.isFinite(stamp.getTime()) || stamp.toISOString() !== observedAt.replace("Z", ".000Z")) {
      throw new Error("Observation timestamp is invalid.");
    }
    safe[id] = { observedAt, outcome };
  }
  return safe;
}

/** Real exports belong outside the checkout and the Nudox package. */
export function readLocalExport(filename: string): unknown {
  const path = realpathSync(filename);
  const checkout = realpathSync(resolve(import.meta.dirname, ".."));
  const inside = relative(checkout, path);
  if (inside === "" || (!isAbsolute(inside) && inside !== ".." && !inside.startsWith(".." + sep))) {
    throw new Error("Keep evidence files outside the project checkout.");
  }
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

export function loadLocalEvidence(filename: string) {
  return parseEvidence(readLocalExport(filename));
}
