import sys, time
import numpy as np, nibabel as nib, torch
from huggingface_hub import HfApi, hf_hub_download

sys.path.insert(0, "backend")
from seg_infer import TumorSegmenter, MODS

REPO = "MedOtter/brats2023-gli-dataset"
CASE = "BraTS-GLI-01233-000"          # one of the 15 held-out test patients

# Look up the real file paths in the repository instead of guessing them
print("Looking up files for", CASE, "...")
all_files = HfApi().list_repo_files(REPO, repo_type="dataset")
case_files = {f.split("-")[-1].replace(".nii.gz", ""): f
              for f in all_files if f.endswith(".nii.gz") and f"/{CASE}/" in f}
print("Found:", sorted(case_files))
missing = [k for k in MODS + ["seg"] if k not in case_files]
if missing:
    sys.exit(f"Missing in repository: {missing}")

print("Downloading (about 11 MB)...")
dl = {k: hf_hub_download(REPO, f, repo_type="dataset", local_dir="test_data")
      for k, f in case_files.items()}
paths = {m: dl[m] for m in MODS}
seg_path = dl["seg"]

print("Torch threads:", torch.get_num_threads())
t0 = time.time()
seg = TumorSegmenter("models/NeuroScan_Seg3D_SegResNet.pth", device="cpu")
print(f"Model loaded in {time.time() - t0:.1f}s")

gt = np.rint(np.asarray(nib.load(seg_path).dataobj)).astype(np.uint8)
print("Expert volumes cm3: WT %.2f  TC %.2f  ET %.2f" % (
    (gt > 0).sum() / 1000, ((gt == 1) | (gt == 3)).sum() / 1000, (gt == 3).sum() / 1000))

for overlap in (0.25, 0.5):
    t0 = time.time()
    out = seg.predict(paths, overlap=overlap)
    dt = time.time() - t0
    p, g = out["labels"] > 0, gt > 0
    dice = 2 * (p & g).sum() / (p.sum() + g.sum())
    print(f"overlap {overlap}: {dt:.1f}s | volumes {out['volumes_cm3']} | WT Dice vs expert {dice:.3f}")