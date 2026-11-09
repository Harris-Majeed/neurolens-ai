"""API routes for the demo pages: segmentation demo cases and measured model results."""
import json
import math
from pathlib import Path

from fastapi import APIRouter

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "frontend" / "seg_demo"
DOCS = ROOT / "docs"
FILES = ("flair", "t1c", "pred", "gt")

router = APIRouter(tags=["demo"])


def _clean(obj):
    """Make a structure JSON-safe: NaN and infinity become None."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    return obj


def _read_json(path: Path):
    if not path.exists():
        return None
    try:
        return _clean(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return None


def _load_case(folder: Path):
    meta_path = folder / "meta.json"
    if not meta_path.exists():
        return None, "meta.json missing"
    meta = json.loads(meta_path.read_text())
    x, y, z = meta["shape"]
    expected = x * y * z
    for name in FILES:
        f = folder / f"{name}.bin"
        if not f.exists():
            return None, f"{name}.bin missing"
        if f.stat().st_size != expected:
            return None, f"{name}.bin has {f.stat().st_size} bytes, expected {expected}"
    meta["id"] = folder.name
    meta["base_url"] = f"/seg_demo/{folder.name}"
    return meta, None


@router.get("/api/seg/cases")
def cases():
    ok, skipped = [], []
    if DEMO.exists():
        for folder in sorted(p for p in DEMO.iterdir() if p.is_dir()):
            meta, problem = _load_case(folder)
            if meta:
                ok.append(meta)
            else:
                skipped.append({"case": folder.name, "problem": problem})
    ok.sort(key=lambda m: -m["dice"]["WT"])
    return {
        "cases": ok,
        "skipped": skipped,
        "note": "Predictions are precomputed on held-out test patients; no live 3D inference.",
    }


@router.get("/api/model-info")
def model_info():
    return {
        "classifier": _read_json(DOCS / "metrics_2d.json"),
        "segmentation": _read_json(DOCS / "seg_test_metrics.json"),
    }