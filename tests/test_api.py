import io
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
CLASSES = ["glioma", "meningioma", "notumor", "pituitary"]


@pytest.fixture(scope="module")
def client():
    import main
    return TestClient(main.app)


def _png(size, mode="RGB"):
    color = 128 if mode == "L" else (128, 128, 128)
    buf = io.BytesIO()
    Image.new(mode, size, color).save(buf, format="PNG")
    return buf.getvalue()


def test_status(client):
    r = client.get("/api/status")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "ready"
    assert sorted(d["classes"]) == CLASSES
    assert 0.9 < d["test_accuracy"] < 1.0


def test_samples_are_listed_and_exist(client):
    items = client.get("/api/samples").json()
    assert items, "no benchmark samples found in frontend/samples"
    for s in items:
        assert s["true_label"] in CLASSES
        assert (FRONTEND / "samples" / s["name"]).is_file()


def test_predict_on_benchmark_samples(client):
    for s in client.get("/api/samples").json():
        data = (FRONTEND / "samples" / s["name"]).read_bytes()
        r = client.post("/api/predict", files={"file": (s["name"], data, "image/jpeg")})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["label"] == s["true_label"], s["name"]
        assert abs(sum(d["probabilities"].values()) - 1.0) < 1e-3
        assert abs(d["confidence"] - max(d["probabilities"].values())) < 1e-6
        assert d["heatmap_png"] and d["original_png"]


def test_predict_accepts_grayscale_png(client):
    r = client.post("/api/predict", files={"file": ("gray.png", _png((64, 64), "L"), "image/png")})
    assert r.status_code == 200, r.text


def test_predict_rejects_non_image(client):
    r = client.post("/api/predict", files={"file": ("x.jpg", b"this is not an image", "image/jpeg")})
    assert r.status_code == 400


def test_predict_rejects_tiny_image(client):
    r = client.post("/api/predict", files={"file": ("tiny.png", _png((16, 16)), "image/png")})
    assert r.status_code == 400


def test_predict_rejects_oversized_upload(client):
    big = b"\0" * (10 * 1024 * 1024 + 1)
    r = client.post("/api/predict", files={"file": ("big.jpg", big, "image/jpeg")})
    assert r.status_code == 413


def test_predict_requires_a_file(client):
    assert client.post("/api/predict").status_code == 422


def test_model_info_is_consistent(client):
    info = client.get("/api/model-info").json()
    c = info["classifier"]
    cm = c["confusion_matrix"]
    total = sum(sum(row) for row in cm)
    correct = sum(cm[i][i] for i in range(len(cm)))
    assert total == c["n_test"]
    assert abs(correct / total - c["test_accuracy"]) < 1e-9
    s = info["segmentation"]
    assert s is not None
    assert s["n_test_patients"] == 15 and len(s["per_case"]) == 15


def test_segmentation_demo_cases(client):
    d = client.get("/api/seg/cases").json()
    assert d["skipped"] == []
    assert len(d["cases"]) == 4
    for m in d["cases"]:
        assert set(m["dice"]) == {"WT", "TC", "ET"}
        assert m["base_url"].startswith("/seg_demo/")
    m = d["cases"][0]
    x, y, z = m["shape"]
    r = client.get(m["base_url"] + "/pred.bin")
    assert r.status_code == 200 and len(r.content) == x * y * z


def test_frontend_is_served_and_complete(client):
    r = client.get("/")
    assert r.status_code == 200 and "neurolens" in r.text.lower()
    refs = re.findall(r'(?:src|href)="((?:js/|css/)[^"]+|config\.js)"', r.text)
    assert refs, "index.html references no scripts or styles"
    for ref in refs:
        assert (FRONTEND / ref).is_file(), "missing " + ref
        assert client.get("/" + ref).status_code == 200


def test_figures_quoted_in_the_app_match_the_metrics_file(client):
    """docs.js and workspace.js quote these numbers. If you retrain, update both files."""
    c = client.get("/api/model-info").json()["classifier"]
    assert c["classes"] == CLASSES
    assert c["confusion_matrix"][0] == [323, 42, 20, 1]
    assert sum(c["confusion_matrix"][0]) == 386