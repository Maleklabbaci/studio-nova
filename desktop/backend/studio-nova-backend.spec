# PyInstaller spec for the embedded Studio Nova server.
# Build (per OS, on the matching runner):  npm run build:backend
# Output: desktop/backend-dist/studio-nova-backend/studio-nova-backend[.exe]
import os
import sys

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

ROOT = os.path.abspath(os.path.join(SPECPATH, "..", ".."))
BACKEND = os.path.join(ROOT, "backend")

# collect_submodules() only finds packages that are importable *right now*,
# and silently returns [] for the rest. During a build, sys.path holds the
# spec's own directory (desktop/backend) - not the Django project - so
# without this line the "apps"/"doory" collections come back empty and the
# frozen server ships hollow: Django apps are referenced by string in the
# settings, static analysis never sees them, and the sidecar only fails
# later, at django.setup() inside the smoke test. Put the project on the
# path first, then verify below that nothing critical went missing.
sys.path.insert(0, BACKEND)

datas = [
    # The bundled backend tree, laid out under the bundle root exactly like
    # the checkout (doory/, apps/, data/ side by side). This matters twice:
    # the settings compute BASE_DIR from their own file location, which in
    # the frozen app is the bundle root, so data files (catalogue seeds,
    # manifests) must sit at <root>/data - and having the sources as real
    # files means imports never depend solely on static analysis finding
    # every dynamically-loaded Django module (app configs, middleware,
    # management commands are all referenced by string).
    (os.path.join(BACKEND, "data"), "data"),
    (os.path.join(BACKEND, "doory"), "doory"),
    (os.path.join(BACKEND, "apps"), "apps"),
]
if os.path.isdir(os.path.join(BACKEND, "templates")):
    datas.append((os.path.join(BACKEND, "templates"), "templates"))
# Django app templates, migrations-adjacent data and package data files.
for package in ("django", "rest_framework", "drf_spectacular", "unfold", "corsheaders", "django_filters"):
    datas += collect_data_files(package)

hiddenimports = []
for package in ("doory", "apps", "uvicorn", "channels", "pycrdt", "rest_framework", "drf_spectacular", "corsheaders", "django_filters", "unfold", "environ", "whitenoise"):
    hiddenimports += collect_submodules(package)
hiddenimports += ["doory.settings.desktop", "doory.asgi", "doory.wsgi"]

# pycrdt ships a native extension that the realtime stack imports when
# the ASGI app loads. Force its binaries, data and submodules into the
# bundle instead of trusting static analysis alone to pick up the
# extension - and even if it ever goes missing, run_server now degrades
# to plain HTTP instead of dying at serve time.
extra_binaries = []
for package in ("pycrdt",):
    _pkg_datas, _pkg_binaries, _pkg_hidden = collect_all(package)
    datas += _pkg_datas
    extra_binaries += _pkg_binaries
    hiddenimports += _pkg_hidden
# The native extension itself, named explicitly: as a Python extension
# module it travels via import analysis, not via collect_dynamic_libs,
# so name it to be sure it lands in the bundle on every OS.
hiddenimports += ["pycrdt._pycrdt"]

# Never ship a hollow sidecar again: if first-party collection silently
# missed a Django app, fail the build here - loudly, at packaging time -
# instead of letting the smoke test (or worse, a user) discover it.
_required = [
    "apps.core", "apps.accounts", "apps.designs", "apps.assets",
    "apps.gallery", "apps.elements", "apps.fonts", "apps.brand",
    "apps.sharing", "apps.exports", "apps.collab",
    "doory.settings.desktop", "doory.asgi",
]
_missing = [name for name in _required if name not in hiddenimports]
if _missing:
    raise SystemExit(
        f"studio-nova-backend.spec: hidden-import collection missed {_missing}; "
        "refusing to build an embedded server without its Django apps."
    )

a = Analysis(
    [os.path.join(SPECPATH, "run_server.py")],
    pathex=[BACKEND, SPECPATH],
    binaries=extra_binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["psycopg2", "boto3", "botocore", "storages", "playwright", "gunicorn", "channels_redis"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="studio-nova-backend",
    console=True,
    disable_windowed_traceback=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="studio-nova-backend")
