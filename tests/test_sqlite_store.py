from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "shared"))

from wbi_common import TABLES
import wbi_sqlite


def empty_snapshot():
    return {sheet: [] for sheet in TABLES}


def sample_production_row():
    row = [None] * len(TABLES["Production_BW"])
    row[0] = 123
    row[1] = 45292
    row[3] = "Test Operator"
    row[11] = 12.75
    row[19] = True
    return row


class SQLiteStoreTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="wbi-sqlite-tests-")
        self.old_db = os.environ.get("WBI_SQLITE_DB")
        os.environ["WBI_SQLITE_DB"] = str(Path(self.tempdir.name) / "test.db")
        wbi_sqlite.initialize()

    def tearDown(self):
        if self.old_db is None:
            os.environ.pop("WBI_SQLITE_DB", None)
        else:
            os.environ["WBI_SQLITE_DB"] = self.old_db
        self.tempdir.cleanup()

    def test_schemas_initialize_with_integrity_and_foreign_keys(self):
        with wbi_sqlite.connect() as conn:
            tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertTrue({"manufacturing_bw", "manufacturing_hb", "stock_position", "machine_maintenance"} <= tables)
            self.assertTrue({"snapshot_production_bw", "snapshot_stock_levels", "snapshot_form_lookups"} <= tables)
            self.assertIn("reference_form_choices", tables)
            self.assertEqual(conn.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(conn.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_source_reference_choices_are_seeded_and_not_authoritative(self):
        with wbi_sqlite.connect() as conn:
            raw = {row[0] for row in conn.execute("SELECT choice_value FROM reference_form_choices WHERE choice_group='raw_material'")}
            products = {row[0] for row in conn.execute("SELECT choice_value FROM reference_form_choices WHERE choice_group='product'")}
            operators = {row[0] for row in conn.execute("SELECT choice_value FROM reference_form_choices WHERE choice_group='operator'")}
            machines = {row[0] for row in conn.execute("SELECT choice_value FROM reference_form_choices WHERE choice_group='machine'")}
            statuses = {row[0] for row in conn.execute("SELECT choice_value FROM reference_form_choices WHERE choice_group='status'")}
            roles = {row[0] for row in conn.execute("SELECT choice_value FROM reference_form_choices WHERE choice_group='auth_role'")}
            rows = conn.execute("SELECT DISTINCT selectable FROM reference_form_choices").fetchall()
        self.assertEqual(raw, {"5.5 MM Rod", "Powder", "Carbide Die"})
        self.assertEqual(products, {"10 G", "12 G", "16 G", "20 G"})
        self.assertTrue({"Nitesh", "Abhishek", "Ravi", "Shivam", "Sandeep", "Sahil", "Nirmal", "HB-Abhishek", "HB-Nitesh", "HB-Ravi", "BW-Nirmal", "BW-Sahil", "BW-Sandeep", "BW-Shivam"} <= operators)
        self.assertEqual(machines, {"HB 1", "HB 2", "BW 1", "BW 2"})
        self.assertEqual(statuses, {"Normal", "Annealed", "Non-Annealed"})
        self.assertEqual(roles, {"dev", "manager", "operator", "stock-monitor"})
        self.assertEqual({row[0] for row in rows}, {0, 1})

    def test_product_descriptions_and_machine_floors_are_in_starter_reference_data(self):
        with wbi_sqlite.connect() as conn:
            notes = {row[0]: row[1] for row in conn.execute("SELECT choice_value,notes FROM reference_form_choices WHERE choice_group='product'")}
            machine_notes = {row[0]: row[1] for row in conn.execute("SELECT choice_value,notes FROM reference_form_choices WHERE choice_group='machine'")}
        self.assertIn("10 Gauge Wire", notes["10 G"])
        self.assertIn("20 Gauge Wire", notes["20 G"])
        self.assertIn("Floor B", machine_notes["BW 1"])
        self.assertIn("Floor A", machine_notes["HB 1"])

    def test_core_foreign_keys_are_enforced(self):
        with wbi_sqlite.connect() as conn:
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute("INSERT INTO manufacturing_bw(manufacturing_id, date_id, weight_produced) VALUES (1,999,10)")

    def test_bw_and_hb_keep_their_documented_lookup_models(self):
        with wbi_sqlite.connect() as conn:
            bw_fks = {r["table"] for r in conn.execute("PRAGMA foreign_key_list(manufacturing_bw)")}
            hb_fks = {r["table"] for r in conn.execute("PRAGMA foreign_key_list(manufacturing_hb)")}
            self.assertIn("operator", bw_fks)
            self.assertIn("product", bw_fks)
            self.assertIn("operators_list", hb_fks)
            self.assertIn("products_list", hb_fks)
            self.assertNotIn("operators_list", bw_fks)

    def test_empty_successful_refresh_clears_old_snapshot_and_updates_counts(self):
        original = empty_snapshot()
        original["Production_BW"] = [sample_production_row()]
        wbi_sqlite.persist_snapshot(original, {})
        wbi_sqlite.persist_snapshot(empty_snapshot(), {})
        self.assertEqual(wbi_sqlite.load_snapshot()["Production_BW"], [])
        with wbi_sqlite.connect() as conn:
            self.assertEqual(conn.execute("SELECT row_count FROM snapshot_table_status WHERE table_name='Production_BW'").fetchone()[0], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM refresh_runs WHERE status='success'").fetchone()[0], 2)

    def test_snapshot_round_trip_preserves_column_order_types_and_booleans(self):
        data = empty_snapshot()
        data["Production_BW"] = [sample_production_row()]
        data["Refresh_Log"] = [["start", "finish", "test", "success", 1, "", "finish"]]
        metadata = {"started_at": "2026-01-01T00:00:00Z", "finished_at": "2026-01-01T00:01:00Z"}
        refresh_id = wbi_sqlite.persist_snapshot(data, metadata)
        actual = wbi_sqlite.load_snapshot()
        self.assertTrue(refresh_id)
        self.assertEqual(actual["Production_BW"], data["Production_BW"])
        self.assertIs(actual["Production_BW"][0][19], True)
        self.assertEqual(actual["Refresh_Log"], data["Refresh_Log"])
        self.assertEqual(wbi_sqlite.latest_refresh()["refresh_id"], refresh_id)

    def test_bad_row_shape_does_not_replace_last_good_snapshot(self):
        good = empty_snapshot()
        good["Production_BW"] = [sample_production_row()]
        wbi_sqlite.persist_snapshot(good, {})
        bad = empty_snapshot()
        bad["Production_BW"] = [[1, 2]]
        with self.assertRaisesRegex(Exception, "row shape does not match"):
            wbi_sqlite.persist_snapshot(bad, {})
        self.assertEqual(wbi_sqlite.load_snapshot()["Production_BW"], good["Production_BW"])

    def test_database_binding_error_rolls_back_all_snapshot_tables(self):
        good = empty_snapshot()
        good["Production_BW"] = [sample_production_row()]
        wbi_sqlite.persist_snapshot(good, {})
        bad = empty_snapshot()
        invalid = sample_production_row()
        invalid[11] = object()  # sqlite3 cannot bind this value; error occurs after transaction starts.
        bad["Production_BW"] = [invalid]
        with self.assertRaises(sqlite3.ProgrammingError):
            wbi_sqlite.persist_snapshot(bad, {})
        self.assertEqual(wbi_sqlite.load_snapshot()["Production_BW"], good["Production_BW"])
        with wbi_sqlite.connect() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM refresh_runs").fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
