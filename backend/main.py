"""NeuroScan AI - FastAPI backend (2D MRI classification + Grad-CAM)."""
import io
import json
import os
import sys
import threading
from pathlib import Path

import torch
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
from predict import NeuroScanClassifier  # noqa: E402
from seg_api import router as seg_router  # noqa: E402
from fastapi.middleware.gzip import GZipMiddleware  # noqa: E402

CKPT = ROOT / "models" / "NeuroScan_AI_resnet18.pth"
METRICS = ROOT / "docs" / "metrics_2d.json"
FRONTEND = ROOT / "frontend"
SAMPLES = FRONTEND / "samples"

MAX_BYTES = 10 * 1024 * 1024          # 10 MB upload limit
MAX_PIXELS = 50_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

DISCLAIMER = (
    "NeuroLens AI is an educational research demo. It is not a medical device and must not "
    "be used for diagnosis or treatment decisions. Consult a qualified clinician."
)

torch.set_num_threads(max(1, (os.cpu_count() or 2) // 2))
classifier = NeuroScanClassifier(str(CKPT), device="cpu")
infer_lock = threading.Lock()         # Grad-CAM hooks keep state on the model

test_metrics = {}
if METRICS.exists():
    with open(METRICS) as f:
        test_metrics = json.load(f)

app = FastAPI(title="NeuroScan AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("NEUROSCAN_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=5)
app.include_router(seg_router)


@app.get("/api/status")
def status():
    return {
        "status": "ready",
        "device": "cpu",
        "model": "ResNet18 (ImageNet transfer learning)",
        "classes": classifier.classes,
        "validation_accuracy": classifier.val_acc,
        "test_accuracy": test_metrics.get("test_accuracy"),
        "per_class": test_metrics.get("per_class"),
        "disclaimer": DISCLAIMER,
    }


@app.get("/api/samples")
def samples():
    if not SAMPLES.exists():
        return []
    out = []
    for p in sorted(SAMPLES.iterdir()):
        if p.suffix.lower() in {".jpg", ".jpeg", ".png"}:
            out.append({
                "name": p.name,
                "true_label": p.stem.rstrip("0123456789"),
                "url": f"/samples/{p.name}",
            })
    return out


@app.post("/api/predict")
def predict(file: UploadFile = File(...)):
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File too large (max 10 MB).")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "Could not read this file as an image (use JPG or PNG).")
    if min(img.size) < 32:
        raise HTTPException(400, "Image is too small.")

    with infer_lock:
        result = classifier.predict(img)
    result["disclaimer"] = DISCLAIMER
    return result


if SAMPLES.exists():
    app.mount("/samples", StaticFiles(directory=str(SAMPLES)), name="samples")

if (FRONTEND / "seg_demo").exists():
    app.mount("/seg_demo", StaticFiles(directory=str(FRONTEND / "seg_demo")), name="seg_demo")

if (FRONTEND / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND), html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {"message": "NeuroScan AI API is running. See /docs."}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)