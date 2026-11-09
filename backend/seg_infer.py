"""NeuroScan AI - 3D brain tumor segmentation (SegResNet, BraTS 2023 GLI). CPU inference."""
import numpy as np
import nibabel as nib
import torch
from monai.networks.nets import SegResNet
from monai.inferers import sliding_window_inference

MODS = ["t1n", "t1c", "t2w", "t2f"]


class SegmentationError(ValueError):
    """Raised for inputs the model cannot handle (message is safe to show to users)."""


class TumorSegmenter:
    def __init__(self, weights_path, device="cpu"):
        b = torch.load(weights_path, map_location=device, weights_only=True)
        a = b["arch"]
        self.net = SegResNet(
            spatial_dims=a["spatial_dims"], init_filters=a["init_filters"],
            in_channels=a["in_channels"], out_channels=a["out_channels"],
            dropout_prob=a["dropout_prob"], blocks_down=tuple(a["blocks_down"]),
            blocks_up=tuple(a["blocks_up"]),
        )
        self.net.load_state_dict(b["state_dict"])
        self.net.to(device).eval()
        self.device = device
        self.roi = tuple(b["roi"])
        self.epoch = b["epoch"]

    @staticmethod
    def load_inputs(paths):
        """paths: dict modality -> NIfTI file path. Returns (array(4,X,Y,Z), spacing, affine)."""
        missing = [m for m in MODS if m not in paths]
        if missing:
            raise SegmentationError("Missing MRI sequence(s): " + ", ".join(m.upper() for m in missing)
                                    + ". The model needs T1n, T1c, T2w and T2-FLAIR (t2f).")
        try:
            imgs = [nib.load(paths[m]) for m in MODS]
        except Exception:
            raise SegmentationError("Could not read one of the files as NIfTI (.nii or .nii.gz).")
        shape = imgs[0].shape
        if len(shape) != 3:
            raise SegmentationError("Each file must be a single 3D volume.")
        if max(shape) > 320 or min(shape) < 64:
            raise SegmentationError(f"Unexpected volume size {shape}; BraTS-style volumes (about 240x240x155) are expected.")
        for m, im in zip(MODS, imgs):
            if im.shape != shape or not np.allclose(im.affine, imgs[0].affine, atol=1e-3):
                raise SegmentationError(f"{m.upper()} is not co-registered with the other sequences (different shape or geometry).")
        spacing = tuple(float(z) for z in imgs[0].header.get_zooms()[:3])
        if max(abs(s - 1.0) for s in spacing) > 0.1:
            raise SegmentationError(f"Voxel spacing {spacing} mm; the model expects 1 mm isotropic (BraTS preprocessing).")
        codes = "".join(nib.aff2axcodes(imgs[0].affine))
        if codes != "LPS":
            raise SegmentationError(f"Orientation {codes} is not supported; the model was trained on BraTS files in LPS orientation.")
        arr = np.stack([im.get_fdata(dtype=np.float32) for im in imgs])
        return arr, spacing, imgs[0].affine

    @staticmethod
    def preprocess(arr):
        """Crop to the brain, clip at the 99.5th percentile, z-score each sequence inside the brain."""
        brain = (arr != 0).any(axis=0)
        if brain.sum() < 100000:
            raise SegmentationError("The volume looks empty or not skull-stripped (BraTS-style, skull-stripped input is expected).")
        idx = np.argwhere(brain)
        lo = np.maximum(idx.min(0) - 2, 0)
        hi = np.minimum(idx.max(0) + 3, brain.shape)
        sl = tuple(slice(a, b) for a, b in zip(lo, hi))
        img = arr[(slice(None),) + sl].copy()
        brain = brain[sl]
        for c in range(4):
            ch = img[c]
            ch = np.minimum(ch, np.percentile(ch[brain], 99.5))
            v = ch[brain]
            ch[brain] = (v - v.mean()) / (v.std() + 1e-6)
            ch[~brain] = 0
            img[c] = ch
        return img, lo, hi

    @torch.no_grad()
    def predict(self, paths, overlap=0.5, threshold=0.5):
        arr, spacing, affine = self.load_inputs(paths)
        full_shape = arr.shape[1:]
        img, lo, hi = self.preprocess(arr)
        x = torch.from_numpy(img).unsqueeze(0).to(self.device)
        logits = sliding_window_inference(x, roi_size=self.roi, sw_batch_size=1, predictor=self.net,
                                          overlap=overlap, mode="gaussian")
        reg = (torch.sigmoid(logits.float())[0].cpu().numpy() > threshold)      # (3, crop): WT, TC, ET
        lab_c = np.zeros(reg.shape[1:], np.uint8)                               # 1 necrotic, 2 edema, 3 enhancing
        lab_c[reg[0]] = 2
        lab_c[reg[1]] = 1
        lab_c[reg[2]] = 3
        labels = np.zeros(full_shape, np.uint8)
        labels[tuple(slice(a, b) for a, b in zip(lo, hi))] = lab_c
        vox = float(np.prod(spacing)) / 1000.0
        return {
            "labels": labels,
            "regions_cropped": reg,
            "crop": (lo.tolist(), hi.tolist()),
            "shape": tuple(full_shape),
            "spacing": spacing,
            "affine": affine,
            "volumes_cm3": {
                "whole_tumor": round(int(reg[0].sum()) * vox, 2),
                "tumor_core": round(int(reg[1].sum()) * vox, 2),
                "enhancing_tumor": round(int(reg[2].sum()) * vox, 2),
            },
        }
