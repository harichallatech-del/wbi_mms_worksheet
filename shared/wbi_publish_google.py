"""Publish one committed WBI SQLite snapshot to three role-specific Google Sheets."""
from __future__ import annotations

import os
from typing import Any

from wbi_common import WBIError
from wbi_role_layout import BLOCKS, CAPACITY, LOOKUP_RANGE, ROLE_ENV, ROLE_SHEETS, padded_lookup_values, support_range

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

def _service():
    key_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if not key_path or not os.path.isfile(key_path):
        raise WBIError("Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key stored outside this project.")
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    credentials = Credentials.from_service_account_file(key_path, scopes=SCOPES)
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)

def _cell(value: Any) -> Any:
    return "" if value is None else value

def _full_rows(rows: list[list[Any]], width: int) -> list[list[Any]]:
    if len(rows) > CAPACITY:
        raise WBIError(f"A dataset exceeds the {CAPACITY}-row workbook capacity; narrow the refresh window or increase the layout capacity.")
    full = [[_cell(v) for v in row[:width]] + [""] * max(0, width - len(row)) for row in rows]
    full.extend([[""] * width for _ in range(CAPACITY - len(full))])
    return full

def _role_ids(roles: list[str] | None) -> list[tuple[str, str]]:
    selected = roles or list(ROLE_SHEETS)
    configured = []
    for role in selected:
        if role not in ROLE_SHEETS:
            raise WBIError(f"Unknown role {role!r}; choose manager, stock-monitor, or operators.")
        sid = os.getenv(ROLE_ENV[role], "").strip()
        if not sid:
            raise WBIError(f"Set {ROLE_ENV[role]} to the imported Google Sheet ID for the {role} workbook.")
        configured.append((role, sid))
    return configured

def publish(data: dict[str, list[list[Any]]], roles: list[str] | None = None) -> int:
    service = _service()
    published = 0
    for role, spreadsheet_id in _role_ids(roles):
        meta = service.spreadsheets().get(spreadsheetId=spreadsheet_id, fields="sheets.properties.title").execute()
        names = [item["properties"]["title"] for item in meta.get("sheets", [])]
        if set(names) != set(ROLE_SHEETS[role]):
            raise WBIError(f"Google Sheet for {role} has tabs {names}; expected exactly {ROLE_SHEETS[role]}.")
        updates = []
        for sheet, blocks in BLOCKS[role].items():
            updates.append({"range": f"'{sheet}'!{LOOKUP_RANGE}", "majorDimension": "ROWS", "values": [[_cell(v) for v in row] for row in padded_lookup_values(data)]})
            for block in blocks:
                rows = data.get(block.dataset, [])
                width = len(rows[0]) if rows else _dataset_width(block.dataset)
                updates.append({"range": f"'{sheet}'!{support_range(block.start_col, width)}", "majorDimension": "ROWS", "values": _full_rows(rows, width)})
        service.spreadsheets().values().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"valueInputOption": "RAW", "data": updates, "includeValuesInResponse": False},
        ).execute()
        published += sum(len(data.get(b.dataset, [])) for blocks in BLOCKS[role].values() for b in blocks)
        print(f"Published {role} screens to Google Sheets ({len(updates)} synchronized ranges).")
    return published

def _dataset_width(name: str) -> int:
    from wbi_common import TABLES
    return len(TABLES[name])
