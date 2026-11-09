import base64, io
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import matplotlib.cm as cm_lib
from PIL import Image
from torchvision import models, transforms


class NeuroScanClassifier:
    """ResNet18 brain-tumor classifier with Grad-CAM. CPU inference."""

    def __init__(self, ckpt_path, device="cpu"):
        ck = torch.load(ckpt_path, map_location=device, weights_only=True)
        self.device = device
        self.classes = ck["classes"]
        self.size = ck["img_size"]
        self.val_acc = ck.get("val_acc")

        net = models.resnet18(weights=None)
        net.fc = nn.Sequential(nn.Dropout(0.3), nn.Linear(net.fc.in_features, len(self.classes)))
        net.load_state_dict(ck["state_dict"])
        self.model = net.eval().to(device)

        self.tf = transforms.Compose([
            transforms.Resize((self.size, self.size)),
            transforms.ToTensor(),
            transforms.Normalize(ck["mean"], ck["std"]),
        ])
        self._acts = None
        self._grads = None
        self.model.layer4[-1].register_forward_hook(self._hook)

    def _hook(self, module, inp, out):
        self._acts = out.detach()
        out.register_hook(lambda g: setattr(self, "_grads", g.detach()))

    def predict(self, image):
        """image: PIL.Image or file path. Returns a JSON-friendly dict."""
        if not isinstance(image, Image.Image):
            image = Image.open(image)
        img = image.convert("RGB")
        x = self.tf(img).unsqueeze(0).to(self.device)

        self.model.zero_grad()
        with torch.enable_grad():
            logits = self.model(x)
            idx = int(logits.argmax(1))
            logits[0, idx].backward()
        probs = torch.softmax(logits.detach(), dim=1)[0].cpu().numpy()

        w = self._grads.mean(dim=(2, 3), keepdim=True)
        cam = F.relu((w * self._acts).sum(dim=1, keepdim=True))
        cam = F.interpolate(cam, size=(self.size, self.size), mode="bilinear", align_corners=False)[0, 0]
        cam = ((cam - cam.min()) / (cam.max() - cam.min() + 1e-8)).cpu().numpy()

        base = np.array(img.resize((self.size, self.size))) / 255.0
        heat = cm_lib.jet(cam)[..., :3]
        overlay = np.clip(0.55 * base + 0.45 * heat, 0, 1)

        return {
            "label": self.classes[idx],
            "confidence": float(probs[idx]),
            "probabilities": {c: float(p) for c, p in zip(self.classes, probs)},
            "heatmap_png": self._to_b64(overlay),
            "original_png": self._to_b64(base),
        }

    @staticmethod
    def _to_b64(arr):
        buf = io.BytesIO()
        Image.fromarray((arr * 255).astype(np.uint8)).save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
