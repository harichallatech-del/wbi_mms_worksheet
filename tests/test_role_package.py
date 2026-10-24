from __future__ import annotations

import sys
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "shared"))

from wbi_role_layout import BLOCKS, LOOKUP_RANGE, QUEUE_RANGE, ROLE_SHEETS, padded_lookup_values, support_range
from wbi_submit_queue import ALLOWED, normalize_role_users

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
BOOKS = {
    "manager": PACKAGE / "excel" / "workbooks" / "WBI_Manager.xlsx",
    "stock-monitor": PACKAGE / "excel" / "workbooks" / "WBI_Stock_Monitor.xlsx",
    "operators": PACKAGE / "excel" / "workbooks" / "WBI_Operators.xlsx",
}

def sheet_names(path: Path) -> tuple[list[str], dict[str, str], zipfile.ZipFile]:
    archive = zipfile.ZipFile(path)
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = workbook.findall("x:sheets/x:sheet", NS)
    return [s.attrib["name"] for s in sheets], {s.attrib["name"]: s.attrib.get("state", "visible") for s in sheets}, archive

class RoleWorkbookTests(unittest.TestCase):
    def test_exact_role_tabs_are_separate_visible_workbooks(self):
        self.assertEqual(set(BOOKS), set(ROLE_SHEETS))
        for role, path in BOOKS.items():
            self.assertTrue(path.is_file(), f"Missing {path}")
            names, states, archive = sheet_names(path)
            try:
                self.assertIsNone(archive.testzip())
                self.assertEqual(names, ROLE_SHEETS[role])
                self.assertEqual(set(states.values()), {"visible"})
            finally:
                archive.close()

    def test_support_blocks_are_on_role_screens_not_extra_tabs(self):
        self.assertEqual(LOOKUP_RANGE, "AA2:AR55")
        self.assertEqual(QUEUE_RANGE, "AS2:BA2001")
        self.assertEqual(support_range(55, 22), "BC4:BX2003")
        self.assertEqual(support_range(63, 6), "BK4:BP2003")
        self.assertEqual([b.dataset for b in BLOCKS["manager"]["Dashboard"]], ["Production_BW", "Production_HB", "Operator_Shift", "Machine_OEE", "Audit_Log"])
        for role, path in BOOKS.items():
            names, _, archive = sheet_names(path)
            try:
                self.assertEqual(set(names), set(ROLE_SHEETS[role]))
                self.assertGreater(len(archive.namelist()), 5)
            finally:
                archive.close()

    def test_requested_form_controls_and_security_notes_exist_in_workbooks(self):
        text = "".join(
            archive.read(name).decode("utf-8", errors="ignore")
            for path in BOOKS.values()
            for archive in [zipfile.ZipFile(path)]
            for name in archive.namelist()
            if name.endswith(".xml")
        )
        for phrase in ("Raw material", "Weight (kg)", "Mobile number", "Login role", "Downtime", "Cost", "Inquiry ID", "Queue ID"):
            self.assertIn(phrase, text)

    def test_admin_manager_only_items_and_stock_monitor_read_only_copy_are_present(self):
        for phrase in ("Passkeys", "Login users", "Stock-monitor account", "read only"):
            found = False
            for path in BOOKS.values():
                with zipfile.ZipFile(path) as archive:
                    text = "".join(archive.read(name).decode("utf-8", errors="ignore") for name in archive.namelist() if name.endswith(".xml"))
                    found |= phrase.casefold() in text.casefold()
            self.assertTrue(found, phrase)

class RoleLayoutAndQueueTests(unittest.TestCase):
    def test_lookup_values_are_fixed_width_and_include_active_account_columns(self):
        sample = {"Form_Lookups": [["Rod", "10 G", "Normal", "BW-A", "HB-B", "BW 1", "HB 1", "Day", "Other", "Other", "planned", "Store A", "Op A", "login user", "Create", "new", "BW 1", "operator"]]}
        matrix = padded_lookup_values(sample)
        self.assertEqual(len(matrix), 54)
        self.assertTrue(all(len(row) == 18 for row in matrix))
        self.assertEqual(matrix[0][11:13], ["Store A", "Op A"])
        self.assertEqual(matrix[-1], [None] * 18)

    def test_endpoint_allowlist_accepts_real_forms_and_rejects_path_escape(self):
        good = ("/stock-positions", "/stock-positions/12", "/manufacturing-bw", "/manufacturing-hb/4", "/admin/machines", "/admin/auth-users", "/raw-materials/by-name", "/raw-materials/9", "/contact-inquiries/123/status", "/contact-inquiries/123/whatsapp")
        bad = ("https://evil.invalid", "/admin/auth-users/../../x", "/audit-logs", "/passkeys", "/raw-materials/abc/def")
        for value in good: self.assertIsNotNone(ALLOWED.fullmatch(value), value)
        for value in bad: self.assertIsNone(ALLOWED.fullmatch(value), value)

    def test_dropdown_sync_keeps_active_names_only_and_never_exposes_phone(self):
        stock, operators, manager_rows = normalize_role_users({"data": [
            {"name":"Store Account","phone":"555-0100","role":"stock-monitor","is_active":True},
            {"name":"Operator A","phone":"555-0101","role":"operator","is_active":True},
            {"name":"Disabled","phone":"555-0102","role":"operator","is_active":False},
            {"name":"Manager","phone":"555-0103","role":"manager","is_active":True},
        ]})
        self.assertEqual(stock, ["Store Account"])
        self.assertEqual(operators, ["Operator A"])
        self.assertEqual(manager_rows[2], ["Disabled", "555-0102", "operator", "No"])
        self.assertNotIn("555-0100", stock + operators)

if __name__ == "__main__":
    unittest.main()
