// Lab Ops local app: serves the dashboard on 127.0.0.1 and runs the lab scripts from buttons on the page.
// Usage: node dashboard/serve.ts [--data DIR] [--port 4174]
// DIR holds the private live files and scripts (default %LOCALAPPDATA%\NudoxLabOps). Nothing leaves this machine.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = opt("--data", join(process.env.LOCALAPPDATA ?? "", "NudoxLabOps"));
const port = Number(opt("--port", "4174"));
const bash = "C:/Program Files/Git/bin/bash.exe";
const origin = `http://127.0.0.1:${port}`;

let running: string | null = null;
let lastJob: string | null = null;
let ok = false;
let log: string[] = [];

function sshKeys(): number {
  const r = spawnSync(bash, ["--noprofile", "--norc", join(data, "lab-ssh-status.sh")], { encoding: "utf8", windowsHide: true, timeout: 20000 });
  const m = /Keys unlocked in this login: (\d+)/.exec(r.stdout ?? "");
  return m ? Number(m[1]) : 0;
}
let keysCache = { at: 0, value: 0 };
function keys() {
  if (Date.now() - keysCache.at > 15000 && !running) keysCache = { at: Date.now(), value: sshKeys() };
  return keysCache.value;
}
const nudoxRunning = () => (spawnSync("tasklist", ["/fi", "imagename eq lindsey.exe"], { encoding: "utf8", windowsHide: true }).stdout ?? "").includes("lindsey.exe");

function run(job: string, extra: string[]) {
  running = job; ok = false; log = []; lastJob = job;
  const push = (chunk: Buffer) => {
    for (const line of chunk.toString("utf8").split(/\r?\n/)) if (line.trim()) log.push(line.replace(/\x1b\[[0-9;]*m/g, ""));
    log = log.slice(-200);
  };
  if (!nudoxRunning()) {
    log.push("Starting Nudox...");
    spawn("cmd.exe", ["/d", "/c", join(data, "Start Nudox for Lab Ops.cmd")], { windowsHide: true, detached: true, stdio: "ignore" }).unref();
  }
  const child = spawn(process.execPath, [join(data, "refresh-live.mjs"), repo, ...extra], { windowsHide: true, env: process.env });
  child.stdout.on("data", push);
  child.stderr.on("data", push);
  child.on("close", (code) => { ok = code === 0; log.push(ok ? "Done." : `Stopped (exit ${code}).`); running = null; keysCache.at = 0; });
}

function send(res: ServerResponse, status: number, body: string | object, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
function page(res: ServerResponse, file: string) {
  const path = join(data, file);
  if (!existsSync(path)) return send(res, 404, `<p style="font-family:system-ui">No ${file} yet. Click Refresh.</p>`, "text/html");
  send(res, 200, readFileSync(path, "utf8"), "text/html; charset=utf-8");
}

createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", origin);
  if (req.method === "POST") {
    // Only this page may trigger jobs.
    if (req.headers.origin !== origin) return send(res, 403, { error: "Cross-origin request refused." });
    if (url.pathname === "/api/unlock") {
      // Opens a visible terminal so you type your passphrases yourself.
      spawn("cmd.exe", ["/d", "/c", "start", "Lab SSH Unlock", bash, "--noprofile", "--norc", join(data, "unlock-lab-ssh.sh")],
        { detached: true, stdio: "ignore" }).unref();
      keysCache.at = 0;
      return send(res, 200, { ok: true });
    }
    if (running) return send(res, 409, { error: `Already running: ${running}` });
    if (url.pathname === "/api/refresh") { run("refresh", []); return send(res, 200, { ok: true }); }
    if (url.pathname === "/api/mock") { run("mock", ["--mock"]); return send(res, 200, { ok: true }); }
    return send(res, 404, { error: "Unknown action." });
  }
  if (url.pathname === "/") return page(res, "Lab Ops live.html");
  if (url.pathname === "/mock") return page(res, "Lab Ops mock.html");
  if (url.pathname === "/api/status") {
    const live = join(data, "Lab Ops live.html");
    return send(res, 200, { running, lastJob, ok, log, keys: keys(), nudox: nudoxRunning(),
      builtAt: existsSync(live) ? statSync(live).mtime.toISOString() : null });
  }
  send(res, 404, "Not found", "text/plain");
}).listen(port, "127.0.0.1", () => console.log(`Lab Ops: ${origin}`));
