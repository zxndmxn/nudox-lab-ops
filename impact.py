"""Pure graph/evidence operations. Never connects to a host or executes a backup."""
from __future__ import annotations

from configparser import ConfigParser
from datetime import datetime, timezone, timedelta
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent


def read_unit(path: Path) -> ConfigParser:
    unit = ConfigParser(interpolation=None)
    with path.open(encoding="utf-8") as stream:
        unit.read_file(stream)
    return unit


def parse_timer(path: Path) -> dict:
    timer = read_unit(path)
    return {"calendar": timer["Timer"]["OnCalendar"],
            "persistent": timer["Timer"].getboolean("Persistent"),
            "delaySeconds": timer["Timer"].getint("RandomizedDelaySec")}


def parse_service(path: Path) -> str:
    return read_unit(path)["Service"]["ExecStart"]


def downstream_impact(node_id: str, edges: list[dict]) -> list[str]:
    """Reachability in the declared operational dependency graph, cycle-safe."""
    reached, pending = {node_id}, [node_id]
    while pending:
        current = pending.pop()
        for edge in edges:
            if edge["from"] == current and edge["to"] not in reached:
                reached.add(edge["to"])
                pending.append(edge["to"])
    return sorted(reached - {node_id})


def assess_evidence(observation: dict | None, now: datetime,
                    max_age: timedelta = timedelta(days=14)) -> str:
    """Keep missing, stale and invalid observations apart from reported outcomes."""
    if not observation or observation.get("observedAt") is None:
        return "unknown"
    try:
        at = datetime.fromisoformat(observation["observedAt"].replace("Z", "+00:00"))
        if at.tzinfo is None or now.tzinfo is None or at > now:
            return "invalid"
        if now - at > max_age:
            return "stale"
    except (ValueError, TypeError, AttributeError):
        return "invalid"
    return observation.get("result") if observation.get("result") in {"passed", "failed"} else "unknown"


def source_ref(file: str, marker: str) -> dict:
    lines = (ROOT / file).read_text(encoding="utf-8").splitlines()
    return {"path": file, "line": next(i for i, line in enumerate(lines, 1) if marker in line)}


def assemble_graph() -> dict:
    schedule = parse_timer(ROOT / "fixtures/backup.timer")
    command = parse_service(ROOT / "fixtures/backup.service")
    specs = [
        ("timer", "Backup timer", "Schedule", "fixtures/backup.timer", "OnCalendar", "Runs on the 5th, 15th and 25th at 07:00, with up to " + str(schedule["delaySeconds"] // 60) + " minutes of random delay. Missed runs are persistent. Time zone is determined by the executing host."),
        ("service", "Backup service", "Job", "fixtures/backup.service", "ExecStart", command),
        ("config", "Service configuration", "Data", "fixtures/backup.sh", "input: /srv/demo/config", "Synthetic configuration source; no private data copied."),
        ("database", "Database export", "Data", "fixtures/backup.sh", "input: /srv/demo/database-export", "An export is a separate recovery prerequisite. A file existing does not prove application consistency."),
        ("script", "Backup script", "Script", "fixtures/backup.sh", "phases:", "Reviewed flow annotation. Shell calls are not compiler-verified by this pilot."),
        ("repository", "Encrypted repository", "Storage", "fixtures/backup.sh", "destination:", "Synthetic destination. Last snapshot and integrity check are unknown."),
        ("retention", "Retention policy", "Policy", "fixtures/backup.sh", "phases:", "Retention failure is distinct from backup creation. No prune operation is implemented."),
        ("notification", "Backup notification", "Signal", "fixtures/backup.sh", "Notification success", "Delivery is independent of backup and restore results."),
        ("restore", "Restore test", "Evidence", "impact.py", "def assess_evidence", "No restore test has been observed. A backup snapshot alone cannot establish recoverability."),
    ]
    nodes = [{"id": i, "label": label, "kind": kind, "host": "demo-host",
              "source": source_ref(file, marker), "detail": detail,
              "evidence": {"lastRun": None, "lastSnapshot": None, "lastCheck": None, "lastRestore": None}}
             for i, label, kind, file, marker, detail in specs]
    relationships = [("timer", "service", "schedules"), ("service", "script", "launches"),
                     ("config", "script", "included by"), ("database", "script", "consumed by"),
                     ("script", "repository", "writes backup"), ("repository", "retention", "subject to"),
                     ("retention", "notification", "reports outcome"),
                     ("repository", "restore", "requires recovery test")]
    edges = [{"from": a, "to": b, "relationship": label,
              "basis": "unit-file" if a in {"timer", "service"} else "reviewed-annotation"}
             for a, b, label in relationships]
    return {"title": "Backup impact map", "mode": "synthetic local fixture",
            "nodes": nodes, "edges": edges, "nudox": {"connected": False, "queryVerified": False}}


def build() -> None:
    graph = assemble_graph()
    output = ROOT / "dist"
    output.mkdir(exist_ok=True)
    (output / "graph.json").write_text(json.dumps(graph, indent=2), encoding="utf-8")
    template = (ROOT / "viewer.html").read_text(encoding="utf-8")
    # Safe even if a future label includes an HTML closing-script sequence.
    payload = json.dumps(graph).replace("<", "\\u003c")
    (output / "index.html").write_text(template.replace("__GRAPH_DATA__", payload), encoding="utf-8")
    import shutil
    shutil.copytree(ROOT / "fixtures", output / "fixtures", dirs_exist_ok=True)
    shutil.copy2(ROOT / "impact.py", output / "impact.py")
    print(f"Built {output / 'index.html'}; {len(graph['nodes'])} nodes, {len(graph['edges'])} declared edges")


if __name__ == "__main__":
    build()
