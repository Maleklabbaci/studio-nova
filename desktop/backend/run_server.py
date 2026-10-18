#!/usr/bin/env python3
"""Studio Nova desktop sidecar: the Django backend, embedded per install.

Electron spawns this (packaged with PyInstaller, see
studio-nova-backend.spec) and proxies the app's /api, /media and /ws
traffic to it. Everything stateful — SQLite database, media, the Django
secret — lives in the per-user data directory, never in the install
folder:

  STUDIO_NOVA_DATA_DIR   where the database/media/secret live (required)
  STUDIO_NOVA_BACKEND_PORT  loopback port to serve on (default 49317)
  SITE_URL               the desktop app origin, for CSRF (Electron sets it)

First start runs the migrations and the local catalogue seeds (elements,
templates, audio — all bundled data); network-backed syncs (fonts,
models) are best-effort and never block startup. Later starts migrate
only, so updating the app updates the local database in place.
"""

from __future__ import annotations

import contextlib
import os
import secrets
import sys
from pathlib import Path


def _backend_dir() -> Path:
    """The Django project root: next to this file in a checkout, bundled by PyInstaller when packaged."""
    here = Path(__file__).resolve().parent
    candidates = [here / "backend", here.parent.parent / "backend", here]
    for candidate in candidates:
        if (candidate / "doory" / "asgi.py").is_file():
            return candidate
    return here


def _data_dir() -> Path:
    raw = os.environ.get("STUDIO_NOVA_DATA_DIR", "")
    if not raw:
        raise SystemExit("STUDIO_NOVA_DATA_DIR is not set: refusing to start without a data directory.")
    data = Path(raw).expanduser()
    (data / "media").mkdir(parents=True, exist_ok=True)
    return data


def _secret_key(data: Path) -> str:
    """One random Django secret per install, generated on first start and reused afterwards."""
    store = data / "secret-key.txt"
    try:
        existing = store.read_text(encoding="utf-8").strip()
        if len(existing) >= 32:
            return existing
    except OSError:
        pass
    value = secrets.token_urlsafe(64)
    store.write_text(value, encoding="utf-8")
    with contextlib.suppress(OSError):
        store.chmod(0o600)
    return value


# (marker file, commands) run once per install; failures are logged, never fatal:
# a desktop that starts with an empty catalogue is better than one that does not start.
# Bundled-data catalogues run before serving; the ones that download
# (fonts, models) run in a background thread so first launch stays fast.
_LOCAL_SEEDS = (
    ("elements.seeded", (("seed_elements", ()), ("sync_element_packs", ()))),
    ("templates.seeded", (("seed_templates", ()),)),
    ("audio.seeded", (("sync_audio", ()),)),
)
_NETWORK_SEEDS = (
    ("fonts.seeded", (("sync_fonts", "--popular", "100"),)),
    ("models.seeded", (("sync_models", ()),)),
)


def _prepare_database() -> None:
    from django.core.management import call_command

    call_command("migrate", interactive=False, verbosity=0)
    call_command("collectstatic", interactive=False, verbosity=0)


def _run_seed_group(data: Path, group) -> None:
    from django.core.management import call_command

    for marker_name, commands in group:
        marker = data / marker_name
        if marker.exists():
            continue
        succeeded = True
        for name, *args in commands:
            try:
                call_command(name, *args)
            except Exception as exc:  # a failed seed must not brick the install
                print(f"[studio-nova-backend] seed {name} failed: {exc}", flush=True)
                succeeded = False
        if succeeded:
            marker.write_text("ok\n", encoding="utf-8")


def main() -> None:
    data = _data_dir()
    backend = _backend_dir()
    sys.path.insert(0, str(backend))

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "doory.settings.desktop")
    os.environ["STUDIO_NOVA_DATA_DIR"] = str(data)
    os.environ["DJANGO_SECRET_KEY"] = _secret_key(data)
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{data / 'studio-nova.sqlite3'}")
    os.environ.setdefault("MEDIA_ROOT", str(data / "media"))
    os.environ.setdefault("SITE_URL", "http://127.0.0.1:48291")

    import django

    django.setup()
    _prepare_database()
    _run_seed_group(data, _LOCAL_SEEDS)

    import threading

    import uvicorn

    # Fonts and the (server-side copy of the) background-removal model
    # download in the background; the editor works without them meanwhile.
    threading.Thread(target=_run_seed_group, args=(data, _NETWORK_SEEDS), daemon=True).start()

    port = int(os.environ.get("STUDIO_NOVA_BACKEND_PORT", "49317"))
    uvicorn.run("doory.asgi:application", host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
