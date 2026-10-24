"""Local SQLite snapshot store shared by the Excel and Google Sheets publishers."""
from __future__ import annotations

import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from wbi_common import TABLES, WBIError

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "data" / "schema"
DEFAULT_DB = ROOT / "data" / "wbi_operations.db"
BOOL_FIELDS = {"rework_flag", "is_active"}


def database_path() -> Path:
    path = Path(os.getenv("WBI_SQLITE_DB", str(DEFAULT_DB))).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(database_path(), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 30000")
    # DELETE journaling keeps the synced database self-contained; WAL would add sidecar files.
    conn.execute("PRAGMA journal_mode = DELETE")
    return conn


def _quote(identifier: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", identifier):
        raise WBIError(f"Invalid SQLite identifier in workbook schema: {identifier!r}")
    return f'"{identifier}"'


def initialize() -> None:
    with connect() as conn:
        for schema_file in sorted(SCHEMA_DIR.glob("*.sql")):
            conn.executescript(schema_file.read_text(encoding="utf-8"))
        conn.execute(
            "INSERT INTO schema_version(component,version,installed_at) VALUES(?,?,?) "
            "ON CONFLICT(component) DO NOTHING",
            ("wbi_sqlite", 1, datetime.now(timezone.utc).isoformat(timespec="seconds")),
        )
        for sheet, headers in TABLES.items():
            table = "snapshot_" + sheet.lower()
            columns = [f'{_quote("row_index")} INTEGER PRIMARY KEY', f'{_quote("record_key")} TEXT']
            columns.extend(f"{_quote(h)} ANY" for h in headers)
            conn.execute(f"CREATE TABLE IF NOT EXISTS {_quote(table)} ({', '.join(columns)})")


def persist_snapshot(data: dict[str, list[list[Any]]], metadata: dict[str, str]) -> str:
    """Replace the current API snapshot atomically and keep one refresh-run record."""
    initialize()
    missing = set(TABLES).difference(data)
    if missing:
        raise WBIError(f"SQLite snapshot is missing required datasets: {', '.join(sorted(missing))}")
    for sheet, headers in TABLES.items():
        for row in data[sheet]:
            if len(row) != len(headers):
                raise WBIError(f"SQLite row shape does not match {sheet} schema.")

    run_id = str(uuid.uuid4())
    started = metadata.get("started_at") or datetime.now(timezone.utc).isoformat(timespec="seconds")
    finished = metadata.get("finished_at") or datetime.now(timezone.utc).isoformat(timespec="seconds")
    count = sum(len(data[sheet]) for sheet in TABLES)
    conn = connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "INSERT INTO refresh_runs(refresh_id,started_at,finished_at,source,status,rows_loaded) VALUES(?,?,?,?,?,?)",
            (run_id, started, finished, "WBI-MMS API", "success", count),
        )
        for sheet, headers in TABLES.items():
            table = "snapshot_" + sheet.lower()
            conn.execute(f"DELETE FROM {_quote(table)}")
            insert_cols = ["row_index", "record_key", *headers]
            placeholders = ",".join("?" for _ in insert_cols)
            sql = f"INSERT INTO {_quote(table)} ({','.join(_quote(c) for c in insert_cols)}) VALUES ({placeholders})"
            rows = []
            for ix, values in enumerate(data[sheet], start=1):
                key = values[0] if values else None
                rows.append((ix, None if key is None else str(key), *values))
            if rows:
                conn.executemany(sql, rows)
            conn.execute(
                "INSERT INTO snapshot_table_status(table_name,refresh_id,row_count,updated_at) VALUES(?,?,?,?) "
                "ON CONFLICT(table_name) DO UPDATE SET refresh_id=excluded.refresh_id,row_count=excluded.row_count,updated_at=excluded.updated_at",
                (sheet, run_id, len(rows), finished),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return run_id


def load_snapshot() -> dict[str, list[list[Any]]]:
    """Read the committed snapshot in workbook column order and preserve bool fields."""
    initialize()
    result: dict[str, list[list[Any]]] = {}
    with connect() as conn:
        for sheet, headers in TABLES.items():
            table = "snapshot_" + sheet.lower()
            cursor = conn.execute(
                f"SELECT {','.join(_quote(c) for c in headers)} FROM {_quote(table)} ORDER BY row_index"
            )
            rows: list[list[Any]] = []
            for record in cursor.fetchall():
                values = list(record)
                for index, header in enumerate(headers):
                    if header in BOOL_FIELDS and values[index] is not None:
                        values[index] = bool(values[index])
                rows.append(values)
            result[sheet] = rows
    return result


def latest_refresh() -> dict[str, Any] | None:
    initialize()
    with connect() as conn:
        row = conn.execute("SELECT * FROM refresh_runs ORDER BY finished_at DESC LIMIT 1").fetchone()
        return dict(row) if row else None


if __name__ == "__main__":
    initialize()
    print(f"Initialized WBI SQLite database at {database_path()}")
