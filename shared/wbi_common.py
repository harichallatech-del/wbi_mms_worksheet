"""Shared, read-only WBI-MMS API extraction and schema normalization."""
from __future__ import annotations

import os
import json
import logging
import time
from datetime import date, datetime, timezone
from typing import Any
from urllib.parse import urljoin

import requests

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"), override=False)
except ImportError:
    pass

PAGE_SIZE = 200
DATA_CAPACITY = 2000
TABLES = {
    "Production_BW": ["manufacturing_id","date","operator_id","operator","machine_id","machine","shift_id","shift","product_id","product","status","weight_produced_kg","start_time","end_time","downtime_minutes","downtime_reason","good_weight_kg","scrap_weight_kg","rejection_reason","rework_flag","quality_percent","created_at"],
    "Production_HB": ["manufacturing_id","date","operator_id","operator","machine_id","machine","shift_id","shift","product_id","product","status","weight_produced_kg","start_time","end_time","downtime_minutes","downtime_reason","good_weight_kg","scrap_weight_kg","rejection_reason","rework_flag","quality_percent","created_at"],
    "Stock_Movements": ["stock_position_id","date","time","raw_material_id","raw_material_name","weight_kg"],
    "Stock_Levels": ["raw_material_id","raw_material_name","current_level_kg","min_level_kg","max_level_kg","status","computed_at"],
    "Machine_OEE": ["machine_id","machine","records","downtime_minutes","availability_percent","quality_percent","performance_percent","oee_percent"],
    "Maintenance": ["maintenance_id","maintenance_date","machine_id","machine","machine_type","maintenance_type","description","downtime_minutes","cost","performed_by"],
    "Reference_Data": ["entity_type","entity_id","name","type","code","is_active","ideal_rate_per_hour","location"],
    "Audit_Log": ["time","user","action","entity_type","record_id","details"],
    "Inquiries": ["inquiry_id","name","phone","email","company","product","quantity","source","status","whatsapp_sent","submitted_at","updated_at"],
    "Login_Users": ["name","phone","role","is_active"],
    "Passkeys_Safe": ["user_name","device_name","device_type","last_used_at","created_at"],
    "Operator_Shift": ["rank_by_produced_kg","line","shift","operator","records","produced_kg","good_kg","scrap_kg","downtime_minutes","quality_percent","period_start","period_end"],
    "Replenishment": ["raw_material_id","raw_material_name","current_level_kg","min_level_kg","max_level_kg","status","gap_to_min_kg","recommended_action"],
    "Data_Quality": ["source","record_id","date","check","severity","detail"],
    "Downtime_Analysis": ["source","line","machine","reason","records","downtime_minutes","produced_kg"],
    "AI_Shift_Brief": ["line","shift","records","produced_kg","good_kg","scrap_kg","quality_percent","downtime_minutes","data_quality_issues","briefing_prompt"],
    "Form_Lookups": ["raw_material","product","status","bw_operator","hb_operator","bw_machine","hb_machine","shift","downtime_reason","rejection_reason","maintenance_type","stock_monitor_login","operator_login","admin_entity","action","inquiry_status","all_machine","login_role"],
    "Refresh_Log": ["run_started_at","run_finished_at","source","status","rows_loaded","error_summary","last_successful_refresh"],
}
INTERACTIVE_TABS = ["Production_BW_Form","Production_HB_Form","Stock_Form","Stock_Threshold_Form","Maintenance_Form","Admin_Form","Action_Queue","Browse_Production","Browse_Stock","Browse_Maintenance","Browse_Reference"]


class WBIError(RuntimeError):
    pass


def configure_logging() -> logging.Logger:
    """Configure console and append-only JSONL logs; never log tokens or response bodies."""
    logger = logging.getLogger("wbi_refresh")
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    logger.addHandler(console)
    log_path = os.getenv("WBI_LOG_FILE", "logs/refresh.jsonl")
    try:
        from pathlib import Path
        path = Path(log_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(path, encoding="utf-8")
        class JsonFormatter(logging.Formatter):
            def format(self, record: logging.LogRecord) -> str:
                return json.dumps({"timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"), "level": record.levelname, "message": record.getMessage(), "stage": getattr(record, "stage", "refresh")}, ensure_ascii=False)
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    except OSError as exc:
        logger.warning("Could not open local log file (%s); console logging remains enabled.", exc)
    return logger


def fail_with_log(stage: str, error: Exception) -> int:
    logger = configure_logging()
    logger.error("Refresh failed at %s: %s", stage, str(error), extra={"stage": stage})
    print(f"ERROR [{stage}]: {error}\nSee {os.getenv('WBI_LOG_FILE', 'logs/refresh.jsonl')} for details. No success was recorded.", flush=True)
    return 1


def _sum_or_none(rows: list[list[Any]], index: int) -> float | None:
    vals = [r[index] for r in rows if index < len(r) and isinstance(r[index], (int, float))]
    return float(sum(vals)) if vals else None


def build_derived_tabs(data: dict[str, list[list[Any]]]) -> None:
    """Produce cross-platform add-on views using the same normalized source rows."""
    from collections import defaultdict
    operator = defaultdict(list)
    downtime = defaultdict(list)
    dq: list[list[Any]] = []
    for sheet, line in (("Production_BW", "BW"), ("Production_HB", "HB")):
        for r in data.get(sheet, []):
            date_value, op, machine, shift = r[1], r[3], r[5], r[7]
            rec_id, produced, good, scrap, down = r[0], r[11], r[16], r[17], r[14]
            operator[(line, shift or "Unspecified", op or "Unspecified")].append(r)
            if isinstance(down, (int, float)) and down > 0:
                downtime[(sheet, line, machine or "Unspecified", r[15] or "Unspecified")].append(r)
            if not rec_id: dq.append([sheet, "", date_value, "missing_record_id", "warning", "Record has no manufacturing ID; duplicate detection may be incomplete."])
            if not date_value: dq.append([sheet, rec_id, "", "missing_date", "error", "Required production date is blank."])
            if not op: dq.append([sheet, rec_id, date_value, "missing_operator", "warning", "Operator label is blank."])
            if not machine: dq.append([sheet, rec_id, date_value, "missing_machine", "warning", "Machine label is blank."])
            if not shift: dq.append([sheet, rec_id, date_value, "missing_shift", "warning", "Shift label is blank."])
            if not isinstance(produced, (int, float)) or produced <= 0: dq.append([sheet, rec_id, date_value, "invalid_produced_weight", "error", "Produced weight must be a positive number of kg."])
            if isinstance(down, (int, float)) and down < 0: dq.append([sheet, rec_id, date_value, "negative_downtime", "error", "Downtime cannot be negative."])
            if isinstance(produced, (int, float)) and isinstance(good, (int, float)) and good > produced: dq.append([sheet, rec_id, date_value, "good_exceeds_produced", "error", "Good weight exceeds produced weight."])
            if isinstance(produced, (int, float)) and isinstance(scrap, (int, float)) and scrap > produced: dq.append([sheet, rec_id, date_value, "scrap_exceeds_produced", "error", "Scrap weight exceeds produced weight."])
            if isinstance(good, (int, float)) and isinstance(scrap, (int, float)) and good + scrap > produced: dq.append([sheet, rec_id, date_value, "good_plus_scrap_exceeds_produced", "warning", "Good plus scrap exceeds produced weight; confirm source definitions."])
            if isinstance(produced, (int, float)) and isinstance(good, (int, float)) and produced > 0 and good / produced > 1: dq.append([sheet, rec_id, date_value, "quality_above_100_percent", "error", "Calculated good-to-produced ratio exceeds 100%."])
    # Repeated identifiers are reported without exposing personal data.
    for sheet in ("Production_BW", "Production_HB"):
        seen: set[str] = set()
        for r in data.get(sheet, []):
            key = str(r[0] or "")
            if key and key in seen: dq.append([sheet, key, r[1], "duplicate_record_id", "error", "Record ID occurs more than once in the fetched dataset."])
            if key: seen.add(key)

    op_rows = []
    for (line, shift, name), group in operator.items():
        produced, scrap = _sum_or_none(group, 11) or 0, _sum_or_none(group, 17) or 0
        good_value = sum((r[16] if isinstance(r[16], (int, float)) else r[11] if isinstance(r[11], (int, float)) else 0) for r in group)
        dates = [r[1] for r in group if r[1] not in (None, "")]
        op_rows.append([0, line, shift, name, len(group), produced, good_value, scrap, _sum_or_none(group, 14) or 0, good_value / produced if produced else None, min(dates) if dates else None, max(dates) if dates else None])
    op_rows.sort(key=lambda r: (r[1], r[2], -(r[5] or 0)))
    rank_group: tuple[str, str] | None = None
    rank = 0
    for row in op_rows:
        group_key = (row[1], row[2])
        rank = rank + 1 if group_key == rank_group else 1
        rank_group = group_key
        row[0] = rank
    data["Operator_Shift"] = op_rows

    rep_rows = []
    for r in data.get("Stock_Levels", []):
        current, minimum, maximum = r[2], r[3], r[4]
        gap = max(0, float(minimum) - float(current)) if isinstance(current, (int, float)) and isinstance(minimum, (int, float)) else None
        status = str(r[5] or "unknown").lower()
        if status == "low": action = f"Review reorder; at least {gap:.2f} kg to minimum" if gap is not None else "Review reorder; threshold value unavailable"
        elif status == "over": action = "Review excess stock and storage capacity"
        elif status == "ok": action = "No threshold action"
        else: action = "Confirm threshold/status with stock owner"
        rep_rows.append([r[0], r[1], current, minimum, maximum, r[5], gap, action])
    data["Replenishment"] = rep_rows

    down_rows = []
    for (source, line, machine, reason), group in sorted(downtime.items(), key=lambda x: str(x[0])):
        down_rows.append([source, line, machine, reason, len(group), _sum_or_none(group, 14) or 0, _sum_or_none(group, 11) or 0])
    for r in data.get("Maintenance", []):
        mins = r[7]
        if isinstance(mins, (int, float)) and mins > 0:
            down_rows.append(["Maintenance", r[4] or "Unspecified", r[3] or "Unspecified", r[5] or "Unspecified", 1, mins, None])
    data["Downtime_Analysis"] = down_rows

    # Aggregate-only payload and prompt: no employee IDs, phones, credentials, or raw descriptions.
    dq_count = len(dq)
    brief_rows = []
    shift_groups = defaultdict(list)
    for row in op_rows: shift_groups[(row[1], row[2])].append(row)
    for (line, shift), group in sorted(shift_groups.items()):
        records = sum(r[4] for r in group)
        produced = sum(r[5] or 0 for r in group)
        good = sum(r[6] or 0 for r in group)
        scrap = sum(r[7] or 0 for r in group)
        down = sum(r[8] or 0 for r in group)
        quality = good / produced if produced else None
        brief_rows.append([line, shift, records, produced, good, scrap, quality, down, dq_count,
                           "Summarize these de-identified aggregates. State scope and missing data; do not infer causes. Ask follow-up questions; manager review required."])
    data["AI_Shift_Brief"] = brief_rows
    data["Data_Quality"] = dq

    refs = data.get("Reference_Data", [])
    def names(entity: str, kind: str | None = None) -> list[str]:
        result = []
        for r in refs:
            active = r[5] if len(r) > 5 else True
            if (active is False or active == 0 or str(active).strip().lower() in ("false", "no", "inactive", "0")):
                continue
            if r[0] == entity and r[2] not in (None, "") and (kind is None or str(r[3] or "").upper() == kind):
                result.append(str(r[2]))
        return sorted(set(result), key=str.casefold)
    materials = data.get("Stock_Levels", [])
    material_names = sorted({str(r[1]) for r in materials if len(r) > 1 and r[1] not in (None, "")}, key=str.casefold)
    shifts = sorted({str(r[7]) for key in ("Production_BW", "Production_HB") for r in data.get(key, []) if r[7] not in (None, "")}, key=str.casefold) or ["Day", "Night"]
    users = data.get("Login_Users", [])
    def is_active_user(row: list[Any]) -> bool:
        value = row[3] if len(row) > 3 else True
        return not (value is False or value == 0 or str(value).strip().lower() in ("false", "no", "inactive", "0"))
    stock_users = sorted({str(r[0]) for r in users if len(r) > 2 and str(r[2]).lower() == "stock-monitor" and r[0] and is_active_user(r)}, key=str.casefold)
    operator_users = sorted({str(r[0]) for r in users if len(r) > 2 and str(r[2]).lower() == "operator" and r[0] and is_active_user(r)}, key=str.casefold)
    bw_machines, hb_machines = names("machine", "BW"), names("machine", "HB")
    lookup_columns = [
        material_names or ["5.5 MM Rod", "Powder", "Carbide Die"],
        names("product") or ["10 G", "12 G", "16 G", "20 G"],
        names("status") or ["Annealed", "Non-Annealed", "Normal"],
        names("operator", "BW") or ["BW-Nirmal", "BW-Sahil", "BW-Sandeep", "BW-Shivam"],
        names("operator", "HB") or ["HB-Abhishek", "HB-Nitesh", "HB-Ravi"],
        bw_machines or ["BW 1", "BW 2"], hb_machines or ["HB 1", "HB 2"], shifts,
        ["Breakdown", "Setup / Changeover", "Material Shortage", "No Operator", "Maintenance", "Power Cut", "Other"],
        ["Tensile Fail", "Dimensional", "Surface Defect", "Coating Defect", "Other"], ["planned", "unplanned"],
        stock_users, operator_users, ["status", "product", "operator", "machine", "login user"],
        ["Create", "Update", "Delete"], ["new", "contacted", "quoted", "closed"],
        bw_machines + hb_machines or ["BW 1", "BW 2", "HB 1", "HB 2"], ["manager", "stock-monitor", "operator"],
    ]
    data["Form_Lookups"] = [[col[i] if i < len(col) else None for col in lookup_columns] for i in range(max(map(len, lookup_columns), default=0))]


def _pick(obj: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in obj and obj[key] is not None:
            return obj[key]
    return default


def _date_serial(value: Any) -> Any:
    """Return the shared Excel/Sheets date serial so date criteria work on both platforms."""
    if value is None or value == "":
        return value
    if isinstance(value, (int, float)):
        return value
    try:
        d = date.fromisoformat(str(value)[:10])
        return (d - date(1899, 12, 30)).days
    except (TypeError, ValueError):
        return value


def _records(payload: Any) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)], {}
    if not isinstance(payload, dict):
        return [], {}
    for key in ("items", "records", "results", "data"):
        val = payload.get(key)
        if isinstance(val, list):
            return [x for x in val if isinstance(x, dict)], payload
        if isinstance(val, dict):
            rows, meta = _records(val)
            if rows:
                return rows, {**payload, **meta}
    return [], payload


def _api_base() -> str:
    base = os.getenv("WBI_API_BASE_URL", "").strip().rstrip("/")
    if not base:
        raise WBIError("Set WBI_API_BASE_URL to the WBI API origin or /api base URL.")
    if not base.endswith("/api"):
        base += "/api"
    return base + "/"


class WBIClient:
    def __init__(self) -> None:
        token = os.getenv("WBI_API_TOKEN", "").strip()
        if not token:
            raise WBIError("Set WBI_API_TOKEN to a short-lived token for a dedicated, least-privileged reporting account.")
        self.base = _api_base()
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/json"})

    def get(self, path: str, params: dict[str, Any] | None = None, optional: bool = False) -> Any:
        url = urljoin(self.base, path.lstrip("/"))
        for attempt in range(4):
            response = self.session.get(url, params=params, timeout=(10, 60))
            if response.status_code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(min(2 ** attempt, 8))
                continue
            if optional and response.status_code in (403, 404, 405):
                return None
            if response.status_code in (401, 403):
                raise WBIError(f"Authorization failure {response.status_code} for {path}; verify the account role and endpoint access.")
            if not response.ok:
                raise WBIError(f"API request failed ({response.status_code}) for {path}. Check endpoint availability and backend logs.")
            if not response.content:
                return None
            return response.json()
        raise WBIError(f"Request retries exhausted for {path}.")

    def paged(self, path: str, optional: bool = False) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        page = 1
        while len(rows) < DATA_CAPACITY:
            params = {"page": page, "pageSize": PAGE_SIZE}
            if os.getenv("WBI_FROM_DATE"):
                params["from"] = os.environ["WBI_FROM_DATE"]
            if os.getenv("WBI_TO_DATE"):
                params["to"] = os.environ["WBI_TO_DATE"]
            payload = self.get(path, params, optional=optional)
            if payload is None:
                return []
            batch, meta = _records(payload)
            if len(rows) + len(batch) > DATA_CAPACITY:
                raise WBIError(f"{path} exceeds the safe template capacity of {DATA_CAPACITY} records; narrow the date window or increase capacity.")
            rows.extend(batch)
            total_pages = _pick(meta, "totalPages", "total_pages", "lastPage")
            if not batch or (total_pages is not None and page >= int(total_pages)) or len(batch) < PAGE_SIZE:
                break
            if len(rows) >= DATA_CAPACITY:
                raise WBIError(f"{path} reached the safe template capacity of {DATA_CAPACITY} records; narrow the date window or increase capacity.")
            page += 1
        return rows


def normalize_production(records: list[dict[str, Any]]) -> list[list[Any]]:
    out = []
    for r in records:
        produced = _pick(r, "weight_produced", "weight_produced_kg", "produced_weight", "weight")
        good = _pick(r, "good_weight", "good_weight_kg")
        scrap = _pick(r, "scrap_weight", "scrap_weight_kg")
        out.append([
            _pick(r,"manufacturing_id","id"), _date_serial(_pick(r,"date","calendar_date")),
            _pick(r,"operator_id"), _pick(r,"operator_name","operator"),
            _pick(r,"machine_id"), _pick(r,"machine_name","machine"),
            _pick(r,"shift_id"), _pick(r,"shift_name","shift"),
            _pick(r,"product_id"), _pick(r,"product_name","product"),
            _pick(r,"status_name","status"), produced,
            _pick(r,"start_time"), _pick(r,"end_time"),
            _pick(r,"downtime_minutes"), _pick(r,"downtime_reason"),
            good, scrap, _pick(r,"rejection_reason"),
            _pick(r,"rework_flag","needs_rework"),
            _pick(r,"quality_percent"), _pick(r,"created_at")
        ])
    return out


_SENSITIVE_AUDIT_KEYS = {"phone", "mobile", "email", "address", "aadhaar", "aadhaar_number", "emergency_contact", "public_key", "credential_id", "otp", "challenge"}


def _redact_audit_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): ("[redacted]" if any(token in str(k).casefold() for token in _SENSITIVE_AUDIT_KEYS) else _redact_audit_value(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact_audit_value(v) for v in value]
    return value


def _audit_detail(record: dict[str, Any]) -> str:
    detail = _pick(record, "details", "message")
    if detail not in (None, ""):
        if isinstance(detail, (dict, list)):
            return json.dumps(_redact_audit_value(detail), ensure_ascii=False, separators=(",", ":"))[:1000]
        return str(detail)[:1000]
    before = _pick(record, "before_data", "before")
    after = _pick(record, "after_data", "after")
    if before is None and after is None:
        return ""
    def parse(value: Any) -> Any:
        if isinstance(value, str):
            try: return json.loads(value)
            except json.JSONDecodeError: return value
        return value
    safe = {"before": _redact_audit_value(parse(before)), "after": _redact_audit_value(parse(after))}
    return json.dumps(safe, ensure_ascii=False, separators=(",", ":"))[:1000]


def normalize_data(client: WBIClient) -> tuple[dict[str, list[list[Any]]], dict[str, str]]:
    start = datetime.now(timezone.utc).isoformat(timespec="seconds")
    data: dict[str, list[list[Any]]] = {}
    data["Production_BW"] = normalize_production(client.paged("manufacturing-bw"))
    data["Production_HB"] = normalize_production(client.paged("manufacturing-hb"))

    stock = client.paged("stock-positions")
    data["Stock_Movements"] = [[_pick(r,"stock_position_id","id"), _date_serial(_pick(r,"date","calendar_date")), _pick(r,"time"), _pick(r,"raw_material_id"), _pick(r,"raw_material_name","item"), _pick(r,"weight","weight_kg")] for r in stock]
    stock_levels_payload = client.get("stock-levels")
    levels, _ = _records(stock_levels_payload)
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    data["Stock_Levels"] = [[_pick(r,"raw_material_id","id"), _pick(r,"raw_material_name","item","name"), _pick(r,"current_level_kg","current_level","weight"), _pick(r,"min_level_kg","min_level"), _pick(r,"max_level_kg","max_level"), _pick(r,"status"), _pick(r,"computed_at",default=stamp)] for r in levels]

    oee_payload = client.get("dashboard/oee", {"days": int(os.getenv("WBI_OEE_DAYS", "30"))})
    oee, _ = _records(oee_payload)
    data["Machine_OEE"] = [[_pick(r,"machine_id"), _pick(r,"machine_name","machine"), _pick(r,"records","record_count"), _pick(r,"downtime_minutes"), _pick(r,"availability_percent","availability"), _pick(r,"quality_percent","quality"), _pick(r,"performance_percent","performance"), _pick(r,"oee_percent","oee")] for r in oee]

    maint = client.paged("machine-maintenance", optional=True)
    data["Maintenance"] = [[_pick(r,"maintenance_id","id"), _date_serial(_pick(r,"maintenance_date","date")), _pick(r,"machine_id"), _pick(r,"machine_name","machine"), _pick(r,"machine_type"), _pick(r,"maintenance_type","type"), _pick(r,"description"), _pick(r,"downtime_minutes"), _pick(r,"cost"), _pick(r,"performed_by")] for r in maint]

    refs = []
    for entity, endpoint, keys in [
        ("product","admin/products",("product_id","id")),
        ("operator","admin/operators",("operator_id","id")),
        ("machine","admin/machines",("machine_id","id")),
        ("status","admin/status",("status_id","id")),
    ]:
        payload = client.get(endpoint, optional=True)
        rows, _ = _records(payload)
        for r in rows:
            refs.append([entity, _pick(r,*keys), _pick(r,"name","full_name"), _pick(r,"type"), _pick(r,"code","product_code","machine_code","employee_code"), _pick(r,"is_active"), _pick(r,"ideal_rate_per_hour"), _pick(r,"location")])
    data["Reference_Data"] = refs
    audit_payload = client.get("audit-logs", {"limit": 200}, optional=True)
    audit, _ = _records(audit_payload)
    data["Audit_Log"] = [[
        _pick(r, "created_at", "time", "timestamp"),
        _pick(r, "performed_by", "user_name", "user"),
        _pick(r, "action"),
        _pick(r, "entity_type", "entity"),
        _pick(r, "entity_id", "record_id"),
        _audit_detail(r),
    ] for r in audit[:200]]

    inquiries = client.paged("contact-inquiries", optional=True)
    data["Inquiries"] = [[
        _pick(r, "inquiry_id", "id"), _pick(r, "name"), _pick(r, "phone"),
        None, None, _pick(r, "product"), _pick(r, "quantity"), _pick(r, "source"),
        _pick(r, "status"), _pick(r, "whatsapp_sent", "whatsappSent"),
        _pick(r, "created_at", "submitted_at"), _pick(r, "updated_at"),
    ] for r in inquiries]

    users = client.paged("admin/auth-users", optional=True)
    data["Login_Users"] = [[
        _pick(r, "name"), _pick(r, "phone"), _pick(r, "role"), _pick(r, "is_active", default=True),
    ] for r in users]
    # The supplied API reference does not define a safe passkey-summary route.
    # Keep the table present but empty; never query or export credential material.
    data["Passkeys_Safe"] = []
    build_derived_tabs(data)
    finished = datetime.now(timezone.utc).isoformat(timespec="seconds")
    data["Refresh_Log"] = [[start, finished, "WBI-MMS API", "success", sum(len(v) for k,v in data.items() if k != "Refresh_Log"), "", finished]]
    for sheet, rows in data.items():
        if sheet != "Refresh_Log" and len(rows) > DATA_CAPACITY:
            raise WBIError(f"{sheet} exceeds the template capacity of {DATA_CAPACITY} rows; increase the model capacity before refresh.")
    return data, {"started_at": start, "finished_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}


def fetch_all() -> tuple[dict[str, list[list[Any]]], dict[str, str]]:
    return normalize_data(WBIClient())
