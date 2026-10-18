"""The desktop (embedded, per-install) settings must stay local and self-contained."""

import importlib
import sys

import pytest


@pytest.fixture()
def desktop_settings(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_NOVA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("DJANGO_SECRET_KEY", "test-secret-key-for-desktop-settings-0123456789")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("MEDIA_ROOT", raising=False)
    sys.modules.pop("doory.settings.desktop", None)
    module = importlib.import_module("doory.settings.desktop")
    yield module
    sys.modules.pop("doory.settings.desktop", None)


def test_desktop_settings_keep_everything_in_the_data_dir(desktop_settings, tmp_path):
    assert str(desktop_settings.DATABASES["default"]["NAME"]) == str(tmp_path / "studio-nova.sqlite3")
    assert str(desktop_settings.MEDIA_ROOT) == str(tmp_path / "media")
    assert str(desktop_settings.STATIC_ROOT) == str(tmp_path / "staticfiles")


def test_desktop_settings_are_loopback_only_and_serverless(desktop_settings):
    assert desktop_settings.ALLOWED_HOSTS == ["127.0.0.1", "localhost"]
    assert desktop_settings.SESSION_COOKIE_SECURE is False
    assert desktop_settings.SECURE_SSL_REDIRECT is False
    assert desktop_settings.CORS_ALLOWED_ORIGINS == []
    # In-memory channels: no Redis in a desktop install.
    assert "InMemoryChannelLayer" in desktop_settings.CHANNEL_LAYERS["default"]["BACKEND"]
    # No mail delivery and no bundled Chromium in the sidecar.
    assert desktop_settings.EMAIL_BACKEND.endswith("locmem.EmailBackend")
    assert desktop_settings.SERVER_PDF_ENABLED is False
