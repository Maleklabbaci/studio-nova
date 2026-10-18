# PyInstaller spec for the embedded Studio Nova server.
# Build (per OS, on the matching runner):  npm run build:backend
# Output: desktop/backend-dist/studio-nova-backend/studio-nova-backend[.exe]
import os

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

ROOT = os.path.abspath(os.path.join(SPECPATH, "..", ".."))
BACKEND = os.path.join(ROOT, "backend")

datas = [
    # Catalogue seeds, model/audio manifests and other data files the
    # management commands read at first start.
    (os.path.join(BACKEND, "data"), os.path.join("backend", "data")),
]
# Django app templates, migrations-adjacent data and package data files.
for package in ("django", "rest_framework", "drf_spectacular", "unfold", "corsheaders", "django_filters"):
    datas += collect_data_files(package)

hiddenimports = []
for package in ("doory", "apps", "uvicorn", "channels", "pycrdt"):
    hiddenimports += collect_submodules(package)
hiddenimports += ["doory.settings.desktop", "doory.asgi", "doory.wsgi"]

a = Analysis(
    [os.path.join(SPECPATH, "run_server.py")],
    pathex=[BACKEND, SPECPATH],
    binaries=[],
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
