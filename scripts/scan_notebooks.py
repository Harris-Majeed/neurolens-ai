"""Scan notebooks for private data before publishing. Writes nothing unless you pass --fix."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
PATTERNS = {
    "email address": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "Hugging Face token": re.compile(r"hf_[A-Za-z0-9]{20,}"),
    "GitHub token": re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    "API key": re.compile(r"(?i)(api[_-]?key|secret|password)\s*[:=]\s*['\"][^'\"]{6,}"),
    "Windows user path": re.compile(r"C:\\Users\\[^\\\s\"']+"),
    "Drive path": re.compile(r"/content/drive/MyDrive/[^\s\"']*"),
}
fix = "--fix" in sys.argv

for nb_path in sorted((root / "notebooks").glob("*.ipynb")):
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    hits = {}
    for i, cell in enumerate(nb.get("cells", [])):
        blobs = ["".join(cell.get("source", []))]
        for out in cell.get("outputs", []):
            blobs.append("".join(out.get("text", [])))
            data = out.get("data", {})
            blobs.append("".join(data.get("text/plain", [])))
        text = "\n".join(blobs)
        for name, rx in PATTERNS.items():
            for m in rx.findall(text) if rx.groups == 0 else [m.group(0) for m in rx.finditer(text)]:
                hits.setdefault(name, set()).add((i, m if isinstance(m, str) else str(m)))
    big = max((len(json.dumps(c.get("outputs", []))) for c in nb.get("cells", [])), default=0)
    print(f"\n{nb_path.name}: {len(nb.get('cells', []))} cells, size {nb_path.stat().st_size / 1e6:.1f} MB, "
          f"largest cell output {big / 1e6:.2f} MB")
    if not hits:
        print("  no matches found")
    for name, items in hits.items():
        for i, m in sorted(items)[:6]:
            shown = m if len(m) < 70 else m[:67] + "..."
            print(f"  cell {i}: {name}: {shown}")
    if fix:
        nb.get("metadata", {}).pop("widgets", None)
        out_path = nb_path.with_name(nb_path.stem + "_clean.ipynb")
        out_path.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
        print("  wrote", out_path.name)