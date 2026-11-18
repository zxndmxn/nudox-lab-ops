# Nudox Lab Map

A local backup dependency map using synthetic fixtures. Select a component to
trace what a change would affect, open its source, and see which recovery
checks lack evidence.

Run on Python 3.11 or newer:

```powershell
python -m unittest discover -s tests -v
python impact.py
```

Open `dist/index.html` in a browser. The demo reads fixture files and makes no
network calls. Repository source is synthetic. Recovery evidence is unknown.

Nudox integration is pending. The first acceptance check is a real symbol
query for `parse_timer` in this checkout, with its caller `assemble_graph`
verified against source. See `docs/codex-mcp.example.toml` for the remote MCP
configuration shape.
