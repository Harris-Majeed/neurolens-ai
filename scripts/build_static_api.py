"""Record real API responses so the frontend can run as a static preview (e.g. on Vercel).

Also records the real inference time (CPU, this machine) for each benchmark scan.
Run from the project root:  python scripts/build_static_api.py
"""
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient

try:
    from backend.main import app
except ImportError:
    from main import app

OUT = ROOT / "frontend" / "static_api"
(OUT / "predict").mkdir(parents=True, exist_ok=True)


def save(path, data):
    path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"  {path.relative_to(ROOT)}  {path.stat().st_size / 1024:.0f} KB")


with TestClient(app) as c:
    for route, fname in [("/api/status", "status.json"),
                         ("/api/model-info", "model-info.json"),
                         ("/api/seg/cases", "seg-cases.json")]:
        r = c.get(route)
        r.raise_for_status()
        save(OUT / fname, r.json())

    r = c.get("/api/samples")
    r.raise_for_status()
    samples = r.json()
    save(OUT / "samples.json", samples)

    # warm-up call so the first scan is not slowed by one-time start-up work
    first = c.get("/samples/" + samples[0]["name"]).content
    c.post("/api/predict", files={"file": (samples[0]["name"], first, "image/jpeg")})

    for s in samples:
        img = c.get("/samples/" + s["name"])
        img.raise_for_status()
        t0 = time.perf_counter()
        r = c.post("/api/predict", files={"file": (s["name"], img.content, "image/jpeg")})
        ms = round((time.perf_counter() - t0) * 1000)
        r.raise_for_status()
        data = r.json()
        data["recorded_ms"] = ms
        print(f"  {s['name']}: {ms} ms")
        save(OUT / "predict" / (s["name"] + ".json"), data)

print("Done. Static API files written to frontend/static_api/")