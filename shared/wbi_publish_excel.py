"""Publish a committed WBI snapshot to role workbooks in OneDrive via Microsoft Graph."""
from __future__ import annotations

import os
from urllib.parse import quote
from typing import Any

import requests

from wbi_common import WBIError
from wbi_role_layout import BLOCKS, CAPACITY, LOOKUP_RANGE, ROLE_SHEETS, padded_lookup_values, support_range

GRAPH = "https://graph.microsoft.com/v1.0"
CHUNK = 250

def _setting(role: str) -> str:
    return {"manager": "WBI_M365_MANAGER_FILE_PATH", "stock-monitor": "WBI_M365_STOCK_MONITOR_FILE_PATH", "operators": "WBI_M365_OPERATORS_FILE_PATH"}[role]

def _token() -> str:
    tenant = os.getenv("MS_GRAPH_TENANT_ID", "").strip()
    client = os.getenv("MS_GRAPH_CLIENT_ID", "").strip()
    secret = os.getenv("MS_GRAPH_CLIENT_SECRET", "").strip()
    if not all((tenant, client, secret)):
        raise WBIError("Set the Microsoft Graph tenant, client ID, and client secret in a secret store or environment.")
    response = requests.post(f"https://login.microsoftonline.com/{quote(tenant, safe='')}/oauth2/v2.0/token", data={
        "client_id": client,
        "client_secret": secret,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }, timeout=(10, 45))
    if not response.ok:
        raise WBIError(f"Microsoft identity token request failed ({response.status_code}); check tenant consent and app permissions.")
    return str(response.json().get("access_token", ""))

def _headers(token: str, session_id: str | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json", "Content-Type": "application/json"}
    if session_id:
        headers["workbook-session-id"] = session_id
    return headers

def _workbook_url(drive_id: str, file_path: str) -> str:
    encoded = quote(file_path.strip("/"), safe="/")
    return f"{GRAPH}/drives/{quote(drive_id, safe='')}/root:/{encoded}:/workbook"

def _request(session: requests.Session, method: str, url: str, headers: dict[str, str], **kwargs):
    response = session.request(method, url, headers=headers, timeout=(10, 90), **kwargs)
    if not response.ok:
        message = ""
        try:
            message = response.json().get("error", {}).get("message", "")
        except Exception:
            pass
        raise WBIError(f"Microsoft Graph {method} failed ({response.status_code}) for workbook range. {message[:240]}")
    return response

def _write_range(session: requests.Session, base: str, token: str, session_id: str, sheet: str, address: str, values: list[list[Any]]) -> None:
    worksheet = quote(sheet, safe="")
    url = f"{base}/worksheets('{worksheet}')/range(address='{address}')"
    for offset in range(0, len(values), CHUNK):
        batch = values[offset:offset + CHUNK]
        start_row, end_row = int(address.split(":")[0][1:]) + offset, int(address.split(":")[0][1:]) + offset + len(batch) - 1
        first_col, last_col = address.split(":")
        col_start = "".join(ch for ch in first_col if ch.isalpha())
        col_end = "".join(ch for ch in last_col if ch.isalpha())
        chunk_address = f"{col_start}{start_row}:{col_end}{end_row}"
        chunk_url = f"{base}/worksheets('{worksheet}')/range(address='{chunk_address}')"
        _request(session, "PATCH", chunk_url, _headers(token, session_id), json={"values": batch})

def _matrix(rows: list[list[Any]], width: int, capacity: int = CAPACITY) -> list[list[Any]]:
    if len(rows) > capacity:
        raise WBIError(f"A dataset exceeds the {capacity}-row workbook capacity; narrow the refresh window or increase the layout capacity.")
    matrix = [[v for v in row[:width]] + [None] * max(0, width - len(row)) for row in rows]
    matrix.extend([[None] * width for _ in range(capacity - len(matrix))])
    return matrix

def _roles(selected: list[str] | None) -> list[str]:
    roles = selected or list(ROLE_SHEETS)
    for role in roles:
        if role not in ROLE_SHEETS:
            raise WBIError(f"Unknown role {role!r}; choose manager, stock-monitor, or operators.")
    return roles

def publish(data: dict[str, list[list[Any]]], roles: list[str] | None = None) -> int:
    drive_id = os.getenv("MS_GRAPH_DRIVE_ID", "").strip()
    if not drive_id:
        raise WBIError("Set MS_GRAPH_DRIVE_ID to the OneDrive or SharePoint drive containing the role workbooks.")
    token = _token()
    session = requests.Session()
    published = 0
    from wbi_common import TABLES
    for role in _roles(roles):
        env_key = _setting(role)
        file_path = os.getenv(env_key, "").strip()
        if not file_path:
            raise WBIError(f"Set {env_key} to the workbook path relative to the selected Graph drive.")
        base = _workbook_url(drive_id, file_path)
        created = _request(session, "POST", f"{base}/createSession", _headers(token), json={"persistChanges": True})
        session_id = str(created.json().get("id", ""))
        if not session_id:
            raise WBIError(f"Microsoft Graph did not return a workbook session for {role}.")
        headers = _headers(token, session_id)
        try:
            response = _request(session, "GET", f"{base}/worksheets?$select=name", headers)
            actual = [item["name"] for item in response.json().get("value", [])]
            if set(actual) != set(ROLE_SHEETS[role]):
                raise WBIError(f"Excel workbook for {role} has tabs {actual}; expected exactly {ROLE_SHEETS[role]}.")
            lookups = [["" if v is None else v for v in row] for row in padded_lookup_values(data)]
            for sheet, blocks in BLOCKS[role].items():
                _write_range(session, base, token, session_id, sheet, LOOKUP_RANGE, lookups)
                for block in blocks:
                    width = len(TABLES[block.dataset])
                    values = _matrix(data.get(block.dataset, []), width)
                    _write_range(session, base, token, session_id, sheet, support_range(block.start_col, width), values)
                    published += len(data.get(block.dataset, []))
            print(f"Published {role} screens to Excel ({sum(len(v) for v in BLOCKS[role].values())} data blocks).")
        finally:
            try:
                _request(session, "POST", f"{base}/closeSession", headers, json={})
            except Exception:
                pass
    return published
