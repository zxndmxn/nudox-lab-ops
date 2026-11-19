// Lab Ops agent: hands the current briefing and local receipts to Codex and saves its findings for
// the dashboard. Codex works in a disposable copy (the only folder its sandbox can write), has no
// network or host access, and is told to only read. Addresses are redacted before it sees anything.
//
// Usage: node lab-ops/agent/investigate.ts --evidence EVIDENCE.json --out FINDINGS.json [--receipts DIR] [--nudox MCP_URL]
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBriefing, needsAttention, resticReadiness } from "../briefing.ts";
import { loadLocalEvidence } from "../evidence.ts";

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const evidencePath = opt("--evidence");
const outPath = opt("--out");
const receiptsDir = opt("--receipts");
const nudoxUrl = opt("--nudox") ?? process.env.LAB_OPS_NUDOX_MCP;
if (!evidencePath || !outPath) {
  throw new Error("Usage: node lab-ops/agent/investigate.ts --evidence EVIDENCE.json --out FINDINGS.json [--receipts DIR] [--nudox MCP_URL]");
}

function findCodex(): string {
  if (process.env.CODEX_BIN && existsSync(process.env.CODEX_BIN)) return process.env.CODEX_BIN;
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["codex"], { encoding: "utf8" });
  if (which.status === 0) return which.stdout.split(/\r?\n/)[0].trim();
  if (process.platform === "win32") {
    // The Codex desktop app ships the CLI inside its Store package, which cannot be listed directly.
    const loc = spawnSync("powershell.exe", ["-NoProfile", "-Command", "(Get-AppxPackage OpenAI.Codex).InstallLocation"], { encoding: "utf8", windowsHide: true });
    const exe = loc.stdout?.trim() && join(loc.stdout.trim().split(/\r?\n/).at(-1)!, "app", "resources", "codex.exe");
    if (exe && existsSync(exe)) return exe;
  }
  throw new Error("Codex is not installed. Install the Codex app or CLI, or set CODEX_BIN.");
}

// Hostnames and addresses never leave the machine in a prompt.
const redact = (text: string) => text
  .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>")
  .replace(/\b[\w.-]+@[\w.-]+\b/g, "<user@host>");

const now = new Date();
const briefing = buildBriefing(loadLocalEvidence(evidencePath), now);
const attention = needsAttention(briefing);
const work = mkdtempSync(join(tmpdir(), "lab-ops-agent-"));
try {
  mkdirSync(join(work, "receipts"));
  mkdirSync(join(work, "rules"));
  cpSync(fileURLToPath(new URL("../briefing.ts", import.meta.url)), join(work, "rules", "briefing.ts"));
  if (receiptsDir) {
    for (const name of readdirSync(receiptsDir).filter((n) => /\.(txt|diff|log)$/.test(n))) {
      writeFileSync(join(work, "receipts", name), redact(readFileSync(join(receiptsDir, name), "utf8")).slice(0, 40_000));
    }
  }
  const line = (row: (typeof briefing)[number]) =>
    `| ${row.id} | ${row.host} | ${row.label} | ${row.state} | ${row.observedAt ?? "none"} |`;
  writeFileSync(join(work, "briefing.md"), [
    `# Lab Ops briefing, ${now.toISOString()}`,
    "",
    `Restic backups: ${resticReadiness(briefing)}`,
    "",
    "## Needs attention (worst first)",
    "| Check ID | Host | Check | State | Last observed |", "| --- | --- | --- | --- | --- |",
    ...attention.map(line),
    "",
    "## All checks",
    "| Check ID | Host | Check | State | Last observed |", "| --- | --- | --- | --- | --- |",
    ...briefing.map(line),
    "",
    `Receipts in receipts/: ${readdirSync(join(work, "receipts")).join(", ") || "none"}`,
  ].join("\n"));

  const config = ["-c", 'model_reasoning_effort="medium"'];
  if (nudoxUrl) config.push("-c", `mcp_servers.nudox.url="${nudoxUrl}"`);
  const prompt = readFileSync(new URL("./PROMPT.md", import.meta.url), "utf8");
  const last = `${work}-result.json`; // outside the agent folder so Codex never reads its own output
  const child = spawn(findCodex(), [
    "exec", "-s", "workspace-write", "--skip-git-repo-check", "--ephemeral", "--json",
    "--color", "never", "-C", work,
    "--output-schema", fileURLToPath(new URL("./schema.json", import.meta.url)),
    "-o", last, ...config, "-",
  ], { stdio: ["pipe", "pipe", "inherit"], windowsHide: true });
  child.stdin.end(prompt);

  // Keep a readable trace of what the agent looked at, for the dashboard.
  const trace: { kind: string; text: string }[] = [];
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const raw = buffer.slice(0, i); buffer = buffer.slice(i + 1);
      try {
        const event = JSON.parse(raw);
        const item = event.item ?? {};
        if (event.type !== "item.completed") continue;
        if (item.type === "command_execution" && item.command) {
          const command = String(item.command).split(work).join(".")
            .replace(/^"?[^"]*?(pwsh|powershell)(\.exe)?"?\s+(-NoProfile\s+)?-Command\s+/i, "")
            .replace(/^['"]|['"]$/g, "");
          trace.push({ kind: "ran", text: command.slice(0, 160) });
          process.stderr.write(`  ran: ${String(item.command).slice(0, 100)}\n`);
        } else if (item.type === "mcp_tool_call") {
          if (item.server === "nudox") trace.push({ kind: "nudox", text: `${item.tool ?? "lookup"}` });
        } else if (item.type === "reasoning" && item.text) {
          trace.push({ kind: "thought", text: String(item.text).replace(/\s+/g, " ").slice(0, 200) });
        }
      } catch { /* non-JSON line */ }
    }
  });
  const code: number = await new Promise((resolve) => child.on("close", resolve));
  if (code !== 0 || !existsSync(last)) throw new Error(`Codex did not finish (exit ${code}).`);
  const result = JSON.parse(readFileSync(last, "utf8"));
  if (typeof result.summary !== "string" || !Array.isArray(result.findings)) throw new Error("Codex returned an unexpected shape.");
  writeFileSync(outPath, JSON.stringify({
    generatedAt: now.toISOString(),
    agent: "Codex",
    sandbox: "disposable copy",
    nudox: Boolean(nudoxUrl),
    summary: result.summary,
    findings: result.findings,
    trace: trace.slice(0, 40),
  }, null, 2));
  console.log(`Agent findings saved: ${result.findings.length} finding(s).`);
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(`${work}-result.json`, { force: true });
}
