"""Add badges and a live-demo link under the README title. Safe to run once."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
LIVE = "https://neurolens-ai-gold.vercel.app/"
REPO = "https://github.com/Harris-Majeed/neurolens-ai"

BLOCK = f"""
[![Live demo](https://img.shields.io/badge/LIVE_DEMO-VERCEL-black?style=for-the-badge&logo=vercel)]({LIVE})
[![GitHub](https://img.shields.io/badge/GITHUB-REPOSITORY-181717?style=for-the-badge&logo=github)]({REPO})
[![PyTorch](https://img.shields.io/badge/PYTORCH-RESNET18-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![MONAI](https://img.shields.io/badge/MONAI-SEGRESNET_3D-1B5E20?style=for-the-badge)](https://monai.io/)
[![FastAPI](https://img.shields.io/badge/FASTAPI-BACKEND-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Test accuracy](https://img.shields.io/badge/TEST_ACCURACY-95.64%25-2ECC71?style=for-the-badge)](docs/metrics_2d.json)
[![Tests](https://img.shields.io/badge/TESTS-15_PASSING-2ECC71?style=for-the-badge)](tests/)

> **Live preview:** [{LIVE}]({LIVE})
> The hosted page is a static preview: the benchmark scans, Grad-CAM maps, Segmentation Lab and Model Lab show results precomputed from the real models. To analyze your own scans, [run it locally](#run-it-locally).
"""

text = README.read_text(encoding="utf-8")
if "img.shields.io" in text:
    print("README already has badges - skipping")
else:
    first, sep, rest = text.partition("\n")
    README.write_text(first + sep + BLOCK + rest, encoding="utf-8")
    print("README updated")