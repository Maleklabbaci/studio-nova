"""Network policy for the print browser.

Standard library only: this module is also imported by the sandboxed worker process, which must not
need Django. Chromium may load `data:` URLs and plain GET requests to a short list of origins and
path prefixes (our own `/media/` and `/static/`); every other request is blocked and counted.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import unquote, urlsplit

DEFAULT_PORTS = {"http": 80, "https": 443}


def normalize_origin(value: str) -> str | None:
    """`scheme://host:port` with default ports spelled out, or None when `value` is not an http(s) origin."""
    try:
        parts = urlsplit(value.strip())
        port = parts.port
    except ValueError:
        return None
    if parts.scheme not in DEFAULT_PORTS or not parts.hostname:
        return None
    return f"{parts.scheme}://{parts.hostname.lower()}:{port or DEFAULT_PORTS[parts.scheme]}"


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str
    fetch: bool = False  # True: the worker must fetch it itself (no redirects) instead of letting Chromium


@dataclass(frozen=True)
class RequestPolicy:
    allowed_origins: frozenset[str]
    path_prefixes: tuple[str, ...]

    @classmethod
    def build(
        cls, origins: list[str] | tuple[str, ...], path_prefixes: list[str] | tuple[str, ...]
    ) -> RequestPolicy:
        normalized = {origin for origin in map(normalize_origin, origins) if origin}
        prefixes = tuple(
            prefix if prefix.endswith("/") else prefix + "/" for prefix in path_prefixes if prefix
        )
        return cls(frozenset(normalized), prefixes)

    def evaluate(self, url: str, method: str = "GET") -> Decision:
        scheme = url[:5].lower()
        if scheme == "data:":
            return Decision(True, "data-url")
        if url == "about:blank":
            return Decision(True, "blank")
        try:
            parts = urlsplit(url)
            parts.port  # noqa: B018 - raises ValueError on a malformed port
        except ValueError:
            return Decision(False, "malformed-url")
        if parts.scheme not in DEFAULT_PORTS:
            return Decision(False, f"scheme-{parts.scheme or 'none'}")
        if method.upper() != "GET":
            return Decision(False, "method")
        if parts.username is not None or parts.password is not None:
            return Decision(False, "credentials-in-url")
        origin = normalize_origin(url)
        if origin is None or origin not in self.allowed_origins:
            return Decision(False, "origin")
        path = unquote(parts.path)
        if "\\" in path or "\x00" in path or any(segment in {".", ".."} for segment in path.split("/")):
            return Decision(False, "path-traversal")
        if not any(path.startswith(prefix) for prefix in self.path_prefixes):
            return Decision(False, "path")
        return Decision(True, "same-origin", fetch=True)
