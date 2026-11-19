"""Build a local inventory of homelab source files for a Nudox indexing trial."""

import argparse
import hashlib
import json
import os
from pathlib import Path


AREAS = {
    "hosts": ("Hardware/Machines",),
    "network": ("Access & Network",),
    "services": ("Services",),
}
KINDS = {
    ".md": "note",
    ".timer": "timer",
    ".service": "service-unit",
    ".sh": "script",
    ".py": "script",
}


def included_name(name: str) -> bool:
    return not name.startswith(".") and name.casefold() != "personal"


def inventory(vault: Path) -> dict[str, list[dict]]:
    result = {}
    for area, roots in AREAS.items():
        records = []
        for name in roots:
            root = vault / name
            if not root.is_dir() or root.resolve() != root:
                raise FileNotFoundError(root)
            candidates = []
            for directory, dirs, names in os.walk(root):
                parent = Path(directory)
                dirs[:] = [
                    name for name in dirs
                    if included_name(name) and (parent / name).resolve() == parent / name
                ]
                candidates.extend(parent / name for name in names if included_name(name))
            for path in sorted(candidates):
                if path.is_symlink() or not path.is_file():
                    continue
                kind = KINDS.get(path.suffix.casefold())
                if not kind or path.resolve() != path:
                    continue
                relative = path.relative_to(vault).as_posix()
                records.append({
                    "id": hashlib.sha256(relative.encode()).hexdigest()[:20],
                    "kind": kind,
                    "path": relative,
                })
        result[area] = records
    return result


def write_index(areas: dict[str, list[dict]], output: Path) -> None:
    package = output / "package"
    package.mkdir(parents=True, exist_ok=True)
    (output / "sources.json").write_text(json.dumps(areas, indent=2), encoding="utf-8")
    (package / "package.json").write_text(json.dumps({
        "name": "homelab-vault-index", "version": "0.1.0", "private": True,
        "type": "module", "types": "index.ts",
    }, indent=2), encoding="utf-8")
    source = [
        'export type Source = { id: string; kind: string };',
        'export type Area = "hosts" | "network" | "services";',
    ]
    for area, records in areas.items():
        redacted = [{k: record[k] for k in ("id", "kind")} for record in records]
        source.append(
            f"export const {area}Sources: readonly Source[] = "
            + json.dumps(redacted, indent=2) + ";"
        )
    source.extend([
        "export function sourcesFor(area: Area): readonly Source[] {",
        "  return { hosts: hostsSources, network: networkSources,"
        " services: servicesSources }[area];",
        "}",
        "export function countSources(area: Area, kind: string): number {",
        "  return sourcesFor(area).filter((source) => source.kind === kind).length;",
        "}",
    ])
    (package / "index.ts").write_text("\n".join(source) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("homelab", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    vault = args.homelab.resolve(strict=True)
    output = args.output.resolve()
    if output.is_relative_to(vault):
        parser.error("the generated index must live outside the vault")
    areas = inventory(vault)
    write_index(areas, output)
    for area, records in areas.items():
        print(f"{area}: {len(records)} source files")


if __name__ == "__main__":
    main()
