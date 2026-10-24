"""One source of truth for role workbook tabs and same-sheet support ranges."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

CAPACITY = 2000
QUEUE_RANGE = "AS2:BA2001"
LOOKUP_RANGE = "AA2:AR55"

ROLE_SHEETS = {
    "manager": ["Dashboard", "Stock Dashboard", "Stock Position", "Admin Settings", "Audit Log", "Inquiries"],
    "stock-monitor": ["Stock Dashboard", "Stock Positions"],
    "operators": ["Manufacturing BW", "Manufacturing HB", "Maintenance"],
}

ROLE_ENV = {
    "manager": "WBI_GOOGLE_MANAGER_SPREADSHEET_ID",
    "stock-monitor": "WBI_GOOGLE_STOCK_MONITOR_SPREADSHEET_ID",
    "operators": "WBI_GOOGLE_OPERATORS_SPREADSHEET_ID",
}

@dataclass(frozen=True)
class Block:
    dataset: str
    start_col: int  # Excel-style 1-based column number.

BLOCKS = {
    "manager": {
        "Dashboard": [Block("Production_BW", 55), Block("Production_HB", 78), Block("Operator_Shift", 101), Block("Machine_OEE", 114), Block("Audit_Log", 123)],
        "Stock Dashboard": [Block("Stock_Levels", 55), Block("Stock_Movements", 63)],
        "Stock Position": [Block("Stock_Movements", 55)],
        "Admin Settings": [Block("Reference_Data", 55), Block("Login_Users", 64), Block("Passkeys_Safe", 69)],
        "Audit Log": [Block("Audit_Log", 55)],
        "Inquiries": [Block("Inquiries", 55)],
    },
    "stock-monitor": {
        "Stock Dashboard": [Block("Stock_Levels", 55), Block("Stock_Movements", 63)],
        "Stock Positions": [Block("Stock_Movements", 55)],
    },
    "operators": {
        "Manufacturing BW": [Block("Production_BW", 55)],
        "Manufacturing HB": [Block("Production_HB", 55)],
        "Maintenance": [Block("Maintenance", 55)],
    },
}

LOOKUP_HEADERS = [
    "raw_material", "product", "status", "bw_operator", "hb_operator", "bw_machine", "hb_machine", "shift",
    "downtime_reason", "rejection_reason", "maintenance_type", "stock_monitor_login", "operator_login",
    "admin_entity", "action", "inquiry_status", "all_machine", "login_role",
]

def column_name(number: int) -> str:
    name = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        name = chr(65 + remainder) + name
    return name

def support_range(start_col: int, width: int, first_row: int = 4, last_row: int = CAPACITY + 3) -> str:
    start = column_name(start_col)
    end = column_name(start_col + width - 1)
    return f"{start}{first_row}:{end}{last_row}"

def values_for_dataset(data: dict[str, list[list[Any]]], dataset: str, width: int) -> list[list[Any]]:
    rows = data.get(dataset, [])
    return [list(row[:width]) + [None] * max(0, width - len(row)) for row in rows]

def padded_lookup_values(data: dict[str, list[list[Any]]]) -> list[list[Any]]:
    rows = data.get("Form_Lookups", [])
    result = [list(row[:len(LOOKUP_HEADERS)]) + [None] * max(0, len(LOOKUP_HEADERS) - len(row)) for row in rows[:54]]
    result.extend([[None] * len(LOOKUP_HEADERS) for _ in range(54 - len(result))])
    return result

def role_from_book_sheets(sheet_names: list[str]) -> str:
    names = set(sheet_names)
    matches = [role for role, expected in ROLE_SHEETS.items() if set(expected) == names]
    if len(matches) != 1:
        raise ValueError("Workbook tabs do not match one WBI role workbook screen list.")
    return matches[0]
