"""Copy result files (metrics JSON and chart images) into the project."""
import pathlib
import shutil

root = pathlib.Path(__file__).resolve().parent.parent
docs = root / "docs"
assets = root / "frontend" / "assets"
downloads = pathlib.Path.home() / "Downloads"
docs.mkdir(exist_ok=True)
assets.mkdir(parents=True, exist_ok=True)

# (file stem, extension, destination folder, required)
WANT = [
    ("seg_test_metrics", ".json", docs, True),
    ("learning_curves", ".png", assets, False),
    ("confusion_matrix", ".png", assets, False),
    ("seg_training_curves", ".png", assets, False),
    ("seg_test_dice_boxplot", ".png", assets, False),
    ("seg_test_examples", ".png", assets, False),
    ("gradcam_correct", ".png", assets, False),
    ("gradcam_missed_glioma", ".png", assets, False),
]


def newest(folder, stem, ext):
    hits = [p for p in folder.rglob(stem + "*" + ext) if p.is_file()]
    return max(hits, key=lambda p: p.stat().st_mtime) if hits else None


for stem, ext, dest, required in WANT:
    target = dest / (stem + ext)
    if target.exists():
        print(f"OK       {target.name} (already in {dest.name})")
        continue
    src = newest(docs, stem, ext) or newest(downloads, stem, ext)
    if src:
        shutil.copy(src, target)
        print(f"COPIED   {target.name}  from {src.parent}")
    else:
        print(("MISSING  " if required else "optional ") + f"{target.name}  not found in docs or Downloads")