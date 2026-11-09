(() => {
  "use strict";
  const A = window.App;
  const pct = (x) => (x * 100).toFixed(1) + "%";
  let mode = "overlay";          // overlay | original | split
  let opacity = 60;
  const cache = new Map();       // study id -> full result with images (this session only)

  const show = (rec) => {
    A.last = rec;
    if (location.hash === "#/workspace") A.route(); else A.go("workspace");
  };

  A.openStudy = (entry) => {
    const rec = cache.get(entry.id);
    if (rec) return show(rec);
    const s = A.samples.find((x) => x.name === entry.name);
    if (s) { A.toast("Images are kept only for the current session. Re-running this sample as a new study."); return A.runSample(s); }
    A.toast("Images of uploaded studies are not stored. Upload the file again to view it.", "warn");
  };

  // every new study is cached and opened in the workspace
  document.addEventListener("nl:history", () => {
    if (!A.last) return;
    cache.set(A.last.entry.id, A.last);
    while (cache.size > 10) cache.delete(cache.keys().next().value);
    if (location.hash !== "#/workspace") A.go("workspace");
  });

  A.register("workspace", (root) => {
    const el = A.el;
    const btn = (text, cls, fn) => { const b = el("button", cls, text); b.type = "button"; b.addEventListener("click", fn); return b; };

    const head = el("div", "page-head");
    const titles = el("div");
    titles.append(el("h1", "", "MRI Workspace"),
      el("p", "muted", "Classification result and Grad-CAM attention map for the selected study."));
    const acts = el("div", "page-actions");
    acts.append(btn("Benchmark scans", "btn ghost", () => A.go("scan")),
                btn("+ Analyze another MRI", "btn primary", () => A.pickFile()));
    head.append(titles, acts);
    root.append(head);

    if (!A.last) {
      const empty = el("section", "card empty-state");
      empty.append(el("h2", "", "No study loaded"),
        el("p", "muted", "Run a benchmark scan or upload an MRI slice to open it here."));
      const row = el("div", "page-actions");
      row.append(btn("Choose a benchmark scan", "btn primary", () => A.go("scan")),
                 btn("Upload MRI image", "btn ghost", () => A.pickFile()));
      empty.append(row);
      root.append(empty);
      return;
    }

    const entry = A.last.entry, d = A.last.data;
    A.listen("nl:history", () => A.route());

    // ---- left: study info ----
    const info = el("section", "card");
    info.append(el("h2", "", "Study"));
    const dl = el("dl", "info");
    const row = (k, v) => dl.append(el("dt", "", k), el("dd", "", v));
    row("Study ID", entry.id);
    row("Source", entry.name);
    row("Run at", new Date(entry.time).toLocaleString());
    row("Response time", entry.ms + " ms");
    row("Model input", "224 \u00D7 224, RGB");
    if (entry.truth) row("Benchmark label", A.nice(entry.truth));
    info.append(dl);

    // ---- center: viewer ----
    const mid = el("section", "card");
    const base = "data:image/png;base64," + d.original_png;
    const heat = "data:image/png;base64," + d.heatmap_png;
    const viewerBox = el("div");
    const slider = el("input");
    slider.type = "range"; slider.min = 0; slider.max = 100; slider.value = opacity;
    const sliderVal = el("span", "", opacity + "%");

    const drawViewer = () => {
      viewerBox.replaceChildren();
      const pane = (src, label) => {
        const f = el("figure", "pane");
        const v = el("div", "viewer");
        const i = el("img");
        i.src = src; i.alt = label;
        v.append(i);
        f.append(v, el("figcaption", "muted", label));
        return f;
      };
      if (mode === "split") {
        const g = el("div", "split");
        g.append(pane(base, "Original (resized)"), pane(heat, "Grad-CAM overlay"));
        viewerBox.append(g);
      } else {
        const v = el("div", "viewer");
        const b = el("img");
        b.src = base; b.alt = "MRI slice";
        v.append(b);
        if (mode === "overlay") {
          const h = el("img");
          h.src = heat; h.alt = "Grad-CAM overlay"; h.id = "heatImg";
          h.style.opacity = opacity / 100;
          v.append(h);
        }
        viewerBox.append(v);
      }
      slider.disabled = mode !== "overlay";
    };

    const modes = [["overlay", "Grad-CAM overlay"], ["original", "Original"], ["split", "Side by side"]];
    const seg = el("div", "seg");
    const segBtns = modes.map(([id, label]) => btn(label, mode === id ? "on" : "", () => {
      mode = id;
      segBtns.forEach((x, i) => x.classList.toggle("on", modes[i][0] === id));
      drawViewer();
    }));
    seg.append(...segBtns);
    const bar = el("div", "toolbar");
    bar.append(seg, el("span", "muted", "Attention map for the predicted class"));

    slider.addEventListener("input", () => {
      opacity = Number(slider.value);
      sliderVal.textContent = opacity + "%";
      const h = document.getElementById("heatImg");
      if (h) h.style.opacity = opacity / 100;
    });
    const lab = el("label");
    lab.append(document.createTextNode("Overlay opacity"), slider);
    const controls = el("div", "controls");
    controls.append(lab, sliderVal);
    const legendLabels = el("div", "legend-labels muted");
    legendLabels.append(el("span", "", "Low influence"), el("span", "", "High influence"));
    mid.append(bar, viewerBox, controls, el("div", "legend-bar"), legendLabels,
      el("p", "hint", "Red and yellow mark the regions that influenced this prediction most. This is an attention map, not a tumor outline, and it can highlight surrounding anatomy."));

    // ---- right: result ----
    const res = el("section", "card");
    res.append(el("h2", "", "Result"));
    const lbl = el("div", "res-label", A.nice(d.label));
    lbl.style.color = A.COLORS[d.label] || "";
    res.append(lbl, el("div", "res-conf", pct(d.confidence) + " model confidence"));
    if (entry.truth) {
      res.append(el("div", "res-truth",
        "Benchmark label: " + A.nice(entry.truth) + " (" + (entry.truth === d.label ? "match" : "mismatch") + ")"));
    }
    Object.entries(d.probabilities).sort((a, b) => b[1] - a[1]).forEach(([c, p], i) => {
      const wrap = el("div", "bar" + (i === 0 ? " top" : ""));
      const r = el("div", "row");
      r.append(el("span", "", A.nice(c)), el("span", "", pct(p)));
      const track = el("div", "track");
      const fill = el("div", "fill");
      fill.style.width = (p * 100).toFixed(1) + "%";
      track.append(fill);
      wrap.append(r, track);
      res.append(wrap);
    });
    const notes = [];
    if (d.confidence < 0.7) notes.push(["Low confidence: treat this result as unreliable.", true]);
    if (d.label === "notumor") notes.push(["A \u201Cno tumor\u201D result does not rule out a tumor. On our test set, 20 of 386 gliomas were labelled no tumor.", false]);
    if (d.label === "meningioma") notes.push(["On our test set, 42 of 386 gliomas were labelled meningioma, so glioma cannot be excluded.", false]);
    notes.push(["The model reads a single 2D slice from a four-class dataset and can be wrong. Educational demo only.", false]);
    notes.forEach(([t, warn]) => res.append(el("p", "hint" + (warn ? " warn" : ""), t)));

    const grid = el("div", "ws-grid");
    grid.append(info, mid, res);
    root.append(grid);
    drawViewer();
  });
})();