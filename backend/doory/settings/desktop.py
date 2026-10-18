"""Settings for the server embedded in the desktop application.

One Studio Nova backend per installed app, serving only that machine:
SQLite database, media and static files all live in the per-user data
directory the desktop launcher points to with STUDIO_NOVA_DATA_DIR, the
channel layer is the in-memory one (a single local process), and nothing
expects TLS, e-mail delivery or a reverse proxy. The Electron shell
proxies the SPA's same-origin /api, /media and /ws traffic here, so no
CORS is needed either.

Required environment (set by desktop/backend/run_server.py):
  STUDIO_NOVA_DATA_DIR  per-user writable directory (database, media…)
  DJANGO_SECRET_KEY     generated once by the launcher, kept in that dir
Optional:
  SITE_URL              the desktop app origin (CSRF), default http://127.0.0.1:48291
  SERVER_PDF_ENABLED    on only when a Chromium is available to exports
"""

from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .base import *
from .base import env

DATA_DIR = Path(env("STUDIO_NOVA_DATA_DIR", default=""))
if not DATA_DIR:
    raise ImproperlyConfigured("STUDIO_NOVA_DATA_DIR must point at the desktop data directory.")

DEBUG = False
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
SITE_URL = env("SITE_URL", default="http://127.0.0.1:48291")

# Everything the server writes stays inside the user's data directory.
DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{DATA_DIR / 'studio-nova.sqlite3'}")}
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(DATA_DIR / "media")))
STATIC_ROOT = DATA_DIR / "staticfiles"

# Plain HTTP on the loopback interface only: no TLS, no secure cookies.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[SITE_URL])
CORS_ALLOWED_ORIGINS = []

# No mail leaves a desktop install: accounts are local, so e-mail
# verification and password-reset-by-email stay off (the config endpoint
# reports email_verification=false for non-delivering backends).
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
EMAIL_SEND_ASYNC = False

# Real-time co-editing between windows of the same install works over the
# in-memory channel layer; REDIS_URL is never set here.
REDIS_URL = ""
CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer", "CONFIG": {"capacity": 2000}}
}

# Chromium is not bundled with the desktop sidecar yet, so server-side PDF
# stays off unless the launcher explicitly enables it; the editor's
# in-browser PDF export keeps working either way.
SERVER_PDF_ENABLED = env.bool("SERVER_PDF_ENABLED", default=False)
EXPORT_ALLOWED_ORIGINS = env.list(
    "EXPORT_ALLOWED_ORIGINS", default=[SITE_URL, "http://127.0.0.1", "http://localhost"]
)

# The background-removal model ships with the frontend bundle; the server
# only advertises a model when one is also installed in its media folder.
BACKGROUND_REMOVAL_ENABLED = env.bool("BACKGROUND_REMOVAL_ENABLED", default=True)
