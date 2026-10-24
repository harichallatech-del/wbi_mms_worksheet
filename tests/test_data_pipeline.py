from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "shared"))

import wbi_common
from wbi_common import TABLES, WBIClient, WBIError, build_derived_tabs, normalize_production


def production_row(record_id: int, operator: str, produced: float, good: float | None, *, down: float = 0, date: int = 45500):
    row = [None] * len(TABLES["Production_BW"])
    values = {0: record_id, 1: date, 2: 10, 3: operator, 4: 20, 5: "BW-1", 6: 1, 7: "Day", 8: 3,
              9: "5.5 mm", 10: "Normal", 11: produced, 14: down, 15: "Setup", 16: good, 17: 1.0,
              19: False, 20: None}
    for index, value in values.items():
        row[index] = value
    return row


class NormalizeTests(unittest.TestCase):
    def test_normalize_production_maps_api_aliases_and_excel_date(self):
        result = normalize_production([{
            "manufacturing_id": 41, "calendar_date": "2024-01-01", "operator_name": "Operator A",
            "machine_name": "BW-1", "shift_name": "Day", "product_name": "5.5 mm",
            "status_name": "Normal", "weight_produced": 15.5, "good_weight": 14.5,
            "rework_flag": True,
        }])[0]
        self.assertEqual(result[0], 41)
        self.assertEqual(result[1], 45292)
        self.assertEqual(result[3], "Operator A")
        self.assertEqual(result[11], 15.5)
        self.assertIs(result[19], True)

    def test_normalize_production_preserves_nulls(self):
        result = normalize_production([{"id": 7, "weight_produced": 1}])[0]
        self.assertIsNone(result[1])
        self.assertIsNone(result[16])
        self.assertIsNone(result[17])

    def test_paged_fetch_follows_total_pages(self):
        client = WBIClient.__new__(WBIClient)
        calls = []

        def fake_get(path, params=None, optional=False):
            calls.append(params["page"])
            batch = [{"id": i} for i in range(200)] if params["page"] == 1 else [{"id": 200}]
            return {"items": batch, "totalPages": 2}

        client.get = fake_get
        records = client.paged("manufacturing-bw")
        self.assertEqual(len(records), 201)
        self.assertEqual(calls, [1, 2])

    def test_paged_fetch_fails_instead_of_truncating_at_capacity(self):
        client = WBIClient.__new__(WBIClient)
        client.get = lambda *args, **kwargs: {"items": [{"id": 1}, {"id": 2}, {"id": 3}], "totalPages": 1}
        with patch.object(wbi_common, "DATA_CAPACITY", 2):
            with self.assertRaisesRegex(WBIError, "exceeds the safe template capacity"):
                client.paged("manufacturing-bw")

    def test_http_authorization_errors_are_explicit_and_do_not_echo_credentials(self):
        class Response:
            status_code = 401
            ok = False
            content = b"private response body"

        class Session:
            headers = {"Authorization": "Bearer never-print-this"}
            def get(self, *args, **kwargs):
                return Response()

        client = WBIClient.__new__(WBIClient)
        client.base = "https://wbi.example/api/"
        client.session = Session()
        with self.assertRaises(WBIError) as caught:
            client.get("manufacturing-bw")
        self.assertIn("Authorization failure 401", str(caught.exception))
        self.assertNotIn("never-print-this", str(caught.exception))
        self.assertNotIn("private response body", str(caught.exception))

    def test_transient_server_error_is_retried_then_returns_json(self):
        class Response:
            def __init__(self, status_code, body):
                self.status_code = status_code
                self.ok = status_code < 400
                self.content = b"present"
                self.body = body
            def json(self):
                return self.body

        class Session:
            headers = {}
            calls = 0
            def get(self, *args, **kwargs):
                self.calls += 1
                if self.calls == 1:
                    return Response(503, {})
                return Response(200, {"items": []})

        client = WBIClient.__new__(WBIClient)
        client.base = "https://wbi.example/api/"
        client.session = Session()
        with patch("wbi_common.time.sleep"):
            self.assertEqual(client.get("manufacturing-bw"), {"items": []})
        self.assertEqual(client.session.calls, 2)


class DerivedTabTests(unittest.TestCase):
    def test_builds_ranks_quality_stock_recommendations_and_dynamic_lookups(self):
        data = {sheet: [] for sheet in TABLES}
        data["Production_BW"] = [
            production_row(1, "Asha", 100, 90, down=10),
            production_row(2, "Asha", 50, None),
            production_row(3, "Bala", 30, 25),
        ]
        data["Stock_Levels"] = [[9, "Rod", 4.0, 10.0, 30.0, "low", "now"]]
        data["Reference_Data"] = [
            ["operator", 1, "Asha", "BW", None, True, None, None],
            ["machine", 2, "BW-1", "BW", None, True, None, None],
            ["product", 3, "5.5 mm", None, None, True, None, None],
        ]
        build_derived_tabs(data)
        self.assertEqual(data["Operator_Shift"][0][3], "Asha")
        self.assertEqual(data["Operator_Shift"][0][5], 150)
        self.assertAlmostEqual(data["Operator_Shift"][0][6], 140)
        self.assertAlmostEqual(data["Operator_Shift"][0][9], 140 / 150)
        self.assertEqual(data["Replenishment"][0][6], 6.0)
        self.assertEqual(data["Data_Quality"], [])
        lookups = data["Form_Lookups"]
        self.assertIn("Asha", [r[3] for r in lookups])
        self.assertIn("BW-1", [r[5] for r in lookups])
        self.assertIn("Rod", [r[0] for r in lookups])
        self.assertEqual(len(lookups[0]), 18)

    def test_data_quality_flags_duplicate_identifier_and_invalid_quantities(self):
        data = {sheet: [] for sheet in TABLES}
        bad = production_row(5, "Asha", -3, 5, down=-2)
        data["Production_BW"] = [bad, list(bad)]
        build_derived_tabs(data)
        codes = {row[3] for row in data["Data_Quality"]}
        self.assertIn("invalid_produced_weight", codes)
        self.assertIn("negative_downtime", codes)
        self.assertIn("duplicate_record_id", codes)


if __name__ == "__main__":
    unittest.main()
