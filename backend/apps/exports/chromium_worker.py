"""Print worker: runs in its own short-lived process so a stuck or crashing browser can be killed.

Usage: `python -m apps.exports.chromium_worker <spec.json>`. The spec names the HTML input, the PDF and
report outputs and the policy. No Django here: only the standard library and Playwright's sync API.

Security model of the page that gets printed:
 * JavaScript is disabled for page content (the evaluate calls below are DevTools calls);
 * every request goes through `context.route`: `data:` URLs pass, same-origin `/media/` and `/static/`
   GETs are fetched by this process *without following redirects*, everything else is aborted and recorded;
 * Chromium cannot resolve host names at all (`--host-resolver-rules`), so even a routing bug has no
   network to reach; service workers, downloads and permissions are off.
"""

from __future__ import annotations

import json
import sys
import time
import traceback
from pathlib import Path
from typing import Any

from apps.exports.policy import RequestPolicy

WAIT_FOR_FONTS = """
(timeoutMs) => Promise.race([
  document.fonts.ready.then(() => true),
  new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
])
"""
MAX_RECORDED_REQUESTS = 50
LAUNCH_ARGS = (
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-first-run",
    "--mute-audio",
    "--force-color-profile=srgb",
    "--host-resolver-rules=MAP * ~NOTFOUND",
)


class RenderTimeout(Exception):
    pass


def run(spec: dict[str, Any]) -> dict[str, Any]:
    """Render `spec["html_path"]` to `spec["pdf_path"]` and return the report."""
    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import TimeoutError as PlaywrightTimeout
    from playwright.sync_api import sync_playwright

    policy = RequestPolicy.build(spec["allowed_origins"], spec["path_prefixes"])
    deadline = time.monotonic() + float(spec["timeout_s"])
    max_asset_bytes = int(spec["max_asset_bytes"])
    report: dict[str, Any] = {"status": "ok", "blocked": [], "blocked_total": 0, "allowed_total": 0}

    def remaining_ms() -> int:
        left = int((deadline - time.monotonic()) * 1000)
        if left <= 0:
            raise RenderTimeout
        return left

    def block(route, url: str, reason: str) -> None:
        report["blocked_total"] += 1
        if len(report["blocked"]) < MAX_RECORDED_REQUESTS:
            report["blocked"].append({"url": url[:300], "reason": reason})
        route.abort("blockedbyclient")

    def handle(route) -> None:
        request = route.request
        decision = policy.evaluate(request.url, request.method)
        if not decision.allowed:
            block(route, request.url, decision.reason)
            return
        report["allowed_total"] += 1
        if not decision.fetch:
            route.continue_()
            return
        try:
            response = route.fetch(max_redirects=0, timeout=min(remaining_ms(), 10_000))
            body = response.body()
        except (PlaywrightError, RenderTimeout):
            block(route, request.url, "fetch-failed")
            return
        if 300 <= response.status < 400:
            block(route, request.url, "redirect")
        elif len(body) > max_asset_bytes:
            block(route, request.url, "too-large")
        else:
            route.fulfill(response=response, body=body)

    options: dict[str, Any] = {
        "headless": True,
        "args": list(LAUNCH_ARGS),
        # Playwright adds --no-sandbox unless the sandbox is requested explicitly.
        "chromium_sandbox": not spec.get("no_sandbox"),
        "timeout": remaining_ms(),
    }
    if spec.get("executable_path"):
        options["executable_path"] = spec["executable_path"]

    try:
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(**options)
            except PlaywrightError as exc:
                return {**report, "status": "error", "kind": "unavailable", "message": str(exc)[:500]}
            try:
                context = browser.new_context(
                    java_script_enabled=False,
                    service_workers="block",
                    accept_downloads=False,
                    permissions=[],
                    bypass_csp=False,
                    ignore_https_errors=False,
                )
                context.route("**/*", handle)
                page = context.new_page()
                html = Path(spec["html_path"]).read_text(encoding="utf-8")
                page.set_content(html, wait_until="load", timeout=remaining_ms())
                fonts_ready = page.evaluate(WAIT_FOR_FONTS, min(remaining_ms(), 10_000))
                report["fonts_ready"] = bool(fonts_ready)
                remaining_ms()
                pdf = page.pdf(
                    width=f"{spec['width_px']}px",
                    height=f"{spec['height_px']}px",
                    print_background=True,
                    prefer_css_page_size=True,
                    margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                )
                Path(spec["pdf_path"]).write_bytes(pdf)
            finally:
                browser.close()
    except (PlaywrightTimeout, RenderTimeout):
        return {**report, "status": "error", "kind": "timeout", "message": "render deadline exceeded"}
    except PlaywrightError as exc:
        return {**report, "status": "error", "kind": "failed", "message": str(exc)[:500]}
    return report


def main(argv: list[str]) -> int:
    spec_path = Path(argv[1])
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    try:
        report = run(spec)
    except Exception as exc:  # last resort: the parent only trusts the report file
        traceback.print_exc()
        report = {"status": "error", "kind": "failed", "message": f"{type(exc).__name__}: {exc}"[:500]}
    Path(spec["report_path"]).write_text(json.dumps(report), encoding="utf-8")
    return 0 if report["status"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
