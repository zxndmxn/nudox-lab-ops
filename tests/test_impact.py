from datetime import datetime, timezone, timedelta
from pathlib import Path
import unittest
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from impact import assess_evidence, downstream_impact, assemble_graph, ROOT


class ImpactTests(unittest.TestCase):
    def test_impact_handles_cycle_and_keeps_unrelated_nodes_out(self):
        edges = [{"from": "a", "to": "b"}, {"from": "b", "to": "a"},
                 {"from": "b", "to": "c"}, {"from": "x", "to": "y"}]
        self.assertEqual(downstream_impact("a", edges), ["b", "c"])

    def test_all_source_links_resolve_and_edges_have_endpoints(self):
        graph = assemble_graph()
        ids = {n["id"] for n in graph["nodes"]}
        self.assertEqual(len(ids), len(graph["nodes"]))
        for node in graph["nodes"]:
            ref = node["source"]
            self.assertLessEqual(ref["line"], len((ROOT / ref["path"]).read_text().splitlines()))
            self.assertGreater(ref["line"], 0)
        for edge in graph["edges"]:
            self.assertIn(edge["from"], ids)
            self.assertIn(edge["to"], ids)
        self.assertFalse(graph["nudox"]["queryVerified"])

    def test_missing_stale_future_and_failed_are_distinct(self):
        now = datetime(2026, 11, 18, tzinfo=timezone.utc)
        self.assertEqual(assess_evidence(None, now), "unknown")
        self.assertEqual(assess_evidence({"observedAt": "2026-10-01T00:00:00Z", "result": "passed"}, now), "stale")
        self.assertEqual(assess_evidence({"observedAt": "2026-12-01T00:00:00Z", "result": "passed"}, now), "invalid")
        self.assertEqual(assess_evidence({"observedAt": "2026-11-17T00:00:00Z", "result": "failed"}, now), "failed")
        self.assertEqual(assess_evidence({"observedAt": "2026-11-17", "result": "passed"}, now), "invalid")
        self.assertEqual(assess_evidence({"observedAt": "nonsense", "result": "passed"}, now), "invalid")

    def test_script_change_does_not_claim_input_datasets_are_changed(self):
        graph = assemble_graph()
        impacted = downstream_impact("script", graph["edges"])
        self.assertIn("restore", impacted)
        self.assertNotIn("config", impacted)
        self.assertNotIn("database", impacted)


if __name__ == "__main__":
    unittest.main()
