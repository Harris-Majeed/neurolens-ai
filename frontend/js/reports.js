(() => {
  "use strict";
  const A = window.App;
  const el = A.el;
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const recs = new Map();       // study id -> full result with images, this session only

  document.addEventListener("nl:history", () => {
    if (!A.last) return;
    recs.set(A.last.entry.id, A.last);
    while (recs.size > 10) recs.delete(recs.keys().next().value);
  });
  const getRec = (id) => recs.get(id) || (A.last && A.last.entry.id === id ? A.last : null);

  const button = (label, cls, fn) => {
    const b = el("button", cls, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };

  function buildReport(h, rec) {
    const art = el("article", "card report");
    const rh = el("div", "report-head");
    const t = el("div");
    t.append(el("div", "brand-name", (window.APP && window.APP.name) || "NeuroLens AI"),
      el("div", "muted", "Study report \u00B7 research output"));
    rh.append(t, el("div", "muted mono", "Generated " + new Date().toLocaleString()));
    art.append(rh);

    art.append(el("div", "report-notice",
      "Research output only. This report is not a diagnosis and must not be used for clinical decisions. A qualified clinician must interpret any imaging."));

    art.append(el("h2", "", "Study"));
    const dl = el("dl", "info");
    const row = (k, v) => dl.append(el("dt", "", k), el("dd", "", v));
    row("Study ID", h.id);
    row("Source file", h.name);
    row("Run at", new Date(h.time).toLocaleString());
    row("Response time", h.ms + " ms");
    row("Model input", "224 \u00D7 224, RGB");
    if (h.truth) row("Benchmark label", A.nice(h.truth) + " (" + (h.truth === h.label ? "match" : "mismatch") + ")");
    art.append(dl);

    art.append(el("h2", "", "Result"));
    const big = el("div", "report-result", A.nice(h.label));
    big.style.color = A.COLORS[h.label] || "";
    art.append(big, el("p", "muted", pct(h.confidence) + " model confidence (top probability)"));
    const rows = Object.entries(h.probabilities).sort((a, b) => b[1] - a[1]).map((p) => [A.nice(p[0]), pct(p[1])]);
    art.append(A.ui.table(["Class", "Probability"], rows));

    art.append(el("h2", "", "Images"));
    if (rec) {
      const g = el("div", "report-images");
      [["data:image/png;base64," + rec.data.original_png, "Original (resized to 224 \u00D7 224)"],
       ["data:image/png;base64," + rec.data.heatmap_png, "Grad-CAM attention map (not a tumor outline)"]].forEach((p) => {
        const f = el("figure");
        const i = el("img");
        i.src = p[0];
        i.alt = p[1];
        f.append(i, el("figcaption", "", p[1]));
        g.append(f);
      });
      art.append(g);
    } else {
      art.append(el("p", "muted", "Images are kept only for the current browser session. Run the study again to include them in a report."));
    }

    art.append(el("h2", "", "How to read this result"));
    const per = (A.status && A.status.per_class) || {};
    const pc = per[h.label];
    const notes = [];
    if (h.confidence < 0.7) notes.push("The top probability is below 70%, so treat this result as unreliable.");
    if (pc) {
      const n = A.nice(h.label).toLowerCase();
      notes.push("On the held-out test set, predictions of " + n + " were correct " + pct(pc.precision) +
        " of the time, and " + pct(pc.recall) + " of real " + n + " cases were found.");
    }
    if (h.label === "notumor") notes.push("A \u201Cno tumor\u201D result does not rule out a tumor.");
    notes.push("The probabilities describe how the model weighs four fixed options for this one 2D slice. They are not the chance that a patient has a condition, and they can be confidently wrong.");
    notes.push("The Grad-CAM overlay shows where the model's attention was. It does not show where a tumor is.");
    art.append(A.ui.list(notes));

    if (A.status) {
      art.append(el("h2", "", "Model performance (held-out test set)"));
      const perf = [];
      if (A.status.test_accuracy != null) perf.push("Test accuracy " + pct(A.status.test_accuracy) + " on 1,584 images (ResNet18, four classes).");
      if (A.status.validation_accuracy != null) perf.push("Validation accuracy " + pct(A.status.validation_accuracy) + ", which is optimistic because the dataset has no patient identifiers.");
      const classes = Object.keys(per);
      if (classes.length) perf.push("Recall by class: " + classes.map((c) => A.nice(c) + " " + pct(per[c].recall)).join(", ") + ".");
      art.append(A.ui.list(perf));
    }

    art.append(el("h2", "", "Limitations"));
    art.append(A.ui.list([
      "Research prototype trained on a public dataset. It is not a medical device and has not been reviewed by any regulator.",
      "The model sees one 2D slice and has only four possible outcomes. It cannot recognise other conditions, and it can miss tumors.",
      "Results from uploaded images depend on image quality, sequence and orientation, which can differ from the training data.",
    ]));
    return art;
  }

  A.register("reports", (root) => {
    const head = el("div", "page-head no-print");
    const titles = el("div");
    titles.append(el("h1", "", "Reports"),
      el("p", "muted", "A printable one-page summary of a study. Use Print and choose \u201CSave as PDF\u201D to keep a copy."));
    head.append(titles);
    root.append(head);

    if (!A.history.length) {
      const empty = el("section", "card empty-state no-print");
      empty.append(el("h2", "", "No studies yet"),
        el("p", "muted", "Run a benchmark scan or upload an MRI slice, then return here to create a report."));
      const r = el("div", "page-actions");
      r.append(button("Choose a benchmark scan", "btn primary", () => A.go("scan")));
      empty.append(r);
      root.append(empty);
      return;
    }

    let id = A.reportTarget;
    if (!A.history.some((h) => h.id === id)) {
      id = A.last && A.history.some((h) => h.id === A.last.entry.id) ? A.last.entry.id : A.history[0].id;
    }
    A.reportTarget = id;
    const entry = A.history.find((h) => h.id === id);

    const bar = el("div", "filters no-print");
    const lab = el("label");
    const sel = el("select");
    A.history.forEach((h) => {
      const o = el("option", "", h.id + " \u00B7 " + A.nice(h.label) + " \u00B7 " + new Date(h.time).toLocaleTimeString());
      o.value = h.id;
      sel.append(o);
    });
    sel.value = id;
    sel.addEventListener("change", () => { A.reportTarget = sel.value; A.route(); });
    lab.append(document.createTextNode("Study"), sel);
    bar.append(lab, button("Print / save as PDF", "btn primary", () => window.print()));
    root.append(bar, buildReport(entry, getRec(id)));
  });
})();