import glob
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("monai")
nib = pytest.importorskip("nibabel")

from seg_infer import MODS, SegmentationError, TumorSegmenter  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
WEIGHTS = ROOT / "models" / "NeuroScan_Seg3D_SegResNet.pth"
CASE = "BraTS-GLI-01233-000"      # one of the 15 held-out test patients


def _find(suffix):
    hits = glob.glob(str(ROOT / "test_data" / "**" / f"{CASE}-{suffix}.nii.gz"), recursive=True)
    return hits[0] if hits else None


PATHS = {m: _find(m) for m in MODS}
SEG = _find("seg")
HAVE_DATA = all(PATHS.values()) and SEG is not None
needs_data = pytest.mark.skipif(not HAVE_DATA, reason="run scripts/test_seg.py once to download the test case")


@pytest.fixture(scope="module")
def segmenter():
    if not WEIGHTS.exists():
        pytest.skip("segmentation weights not found in models/")
    return TumorSegmenter(str(WEIGHTS), device="cpu")


def test_missing_sequence_gives_a_clear_error(segmenter):
    with pytest.raises(SegmentationError, match="T2F"):
        segmenter.predict({"t1n": "a.nii.gz", "t1c": "b.nii.gz", "t2w": "c.nii.gz"})


@pytest.fixture(scope="module")
def result(segmenter):
    return segmenter.predict(PATHS, overlap=0.25)


@needs_data
def test_labels_are_valid(result):
    assert set(np.unique(result["labels"]).tolist()) <= {0, 1, 2, 3}


@needs_data
def test_prediction_agrees_with_the_expert_mask(result):
    gt = np.rint(np.asarray(nib.load(SEG).dataobj)).astype(np.uint8)
    assert result["labels"].shape == gt.shape
    p, g = result["labels"] > 0, gt > 0
    dice = 2 * (p & g).sum() / (p.sum() + g.sum())
    assert dice > 0.88                       # measured 0.903 on this patient
    assert 80 < result["volumes_cm3"]["whole_tumor"] < 95   # expert volume is 87.6 cm3