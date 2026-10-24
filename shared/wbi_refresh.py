"""Fetch WBI data once, commit a local SQLite snapshot, then publish selected role files."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone

from wbi_common import WBIError, configure_logging, fail_with_log, fetch_all
from wbi_sqlite import load_snapshot, persist_snapshot

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", choices=("excel", "google"), required=True)
    parser.add_argument("--role", choices=("manager", "stock-monitor", "operators"), action="append", help="Repeat to publish selected role workbook(s); default publishes all three.")
    parser.add_argument("--publish-existing", action="store_true", help="Publish the last committed SQLite snapshot without calling WBI APIs.")
    return parser.parse_args()

def run() -> None:
    args = parse_args()
    logger = configure_logging()
    if args.publish_existing:
        data = load_snapshot()
        logger.info("Using the last committed SQLite snapshot", extra={"stage": "sqlite_read"})
    else:
        data, metadata = fetch_all()
        persist_snapshot(data, metadata)
        data = load_snapshot()
        logger.info("Committed refreshed WBI data to SQLite", extra={"stage": "sqlite_write"})
    if args.platform == "excel":
        from wbi_publish_excel import publish
    else:
        from wbi_publish_google import publish
    count = publish(data, args.role)
    logger.info("Published %s dataset rows across requested role workbook(s)", count, extra={"stage": "publish"})
    print(f"Refresh complete. Published {count} dataset rows. SQLite: data/wbi_operations.db")

def main() -> None:
    try:
        run()
    except Exception as exc:
        raise SystemExit(fail_with_log("role_publish", exc)) from None

if __name__ == "__main__":
    main()
