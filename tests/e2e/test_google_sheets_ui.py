"""Optional smoke test for an imported, authorized Google Sheets workbook.

This checks the actual browser shell and Apps Script menu. It is intentionally
read-only: Excel/Sheets grid rendering is canvas-based and writes would require
live WBI business data and user authorization.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    state_file = os.getenv("PLAYWRIGHT_STORAGE_STATE", "").strip()
    if state_file and Path(state_file).is_file():
        return {**browser_context_args, "storage_state": state_file}
    return browser_context_args


@pytest.mark.e2e
def test_imported_google_sheet_and_wbi_menu_are_available(page: Page):
    sheet_url = os.getenv("WBI_SHEETS_UI_URL", "").strip()
    if not sheet_url:
        pytest.skip("Set WBI_SHEETS_UI_URL to an imported WBI Google Sheet to run the browser smoke test.")
    if not os.getenv("PLAYWRIGHT_STORAGE_STATE", "").strip():
        pytest.skip("Set PLAYWRIGHT_STORAGE_STATE to a local signed-in browser state for the target Sheet.")

    page.goto(sheet_url, wait_until="domcontentloaded")
    expect(page).to_have_url(re.compile(r"docs\.google\.com/spreadsheets"), timeout=30_000)
    expect(page).to_have_title(re.compile("Google Sheets"), timeout=30_000)
    expect(page.get_by_role("main")).to_be_visible(timeout=30_000)

    # Apps Script custom menus appear only after the bound script is saved and authorized.
    wbi_menu = page.get_by_role("menuitem", name="WBI Operations")
    expect(wbi_menu).to_be_visible(timeout=30_000)
    wbi_menu.click()
    expect(page.get_by_role("menuitem", name="Queue current form")).to_be_visible(timeout=10_000)
    expect(page.get_by_role("menuitem", name="Next page")).to_be_visible(timeout=10_000)
