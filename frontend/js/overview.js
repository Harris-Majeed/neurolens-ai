(() => {
  "use strict";
  const A = window.App;
  const pct = (x) => (x * 100).toFixed(1) + "%";

  A.register("overview", (root) => {
    const el = A.el;

    // ---- header ----
    const head = el("div", "page-head");
    const titles = el("div");
    titles.append(el("h1", "", "Brain MRI Intelligence"),
      el("p", "muted", "AI-assisted classification and explainable imaging workspace for neuro-oncology research."));
    const acts = el("div", "page-actions");
    const bHist = el("button", "btn ghost", "View history");
    bHist.type = "button";
    bHist.addEventListener("click", () => A.go("history"));
    const bNew = el("button", "btn primary", "+ Analyze new MRI");
    bNew.type = "button";
    bNew.addEventListener("click", () => A.pickFile());
    acts.append(bHist, bNew);
    head.append(titles, acts);

    // ---- benchmark studies ----
    const bench = el("section", "card");
    bench.append(el("h2", "", "Benchmark studies"),
      el("p", "muted", "Held-out test images from the Kaggle Brain Tumor MRI dataset. Click one to run the classifier."));
    const grid = el("div", "bench-grid");
    bench.append(grid);
    const drawBench = () => {
      grid.replaceChildren();
      if (!A.samples.length) { grid.append(el("p", "muted", "No benchmark images found.")); return; }
      A.samples.forEach((s) => {
        const card = el("button", "bench-card");
        card.type = "button";
        const tag = el("span", "pill", A.nice(s.true_label));
        tag.style.color = A.COLORS[s.true_label] || "";
        const img = el("img");
        img.src = A.sampleUrl(s);
        img.alt = A.sampleTitle(s);
        card.append(tag, img, el("div", "bench-name", A.sampleTitle(s)), el("div", "bench-run", "Instant test \u2192"));
        card.addEventListener("click", () => A.runSample(s));
        grid.append(card);
      });
    };

    // ---- recent activity ----
    const act = el("section", "card");
    const actHead = el("div", "card-head");
    const actTitles = el("div");
    actTitles.append(el("h2", "", "Recent study activity"),
      el("p", "muted", "Studies run in this browser. Response time includes the network round trip."));
    const viewAll = el("button", "link", "View all \u2192");
    viewAll.type = "button";
    viewAll.addEventListener("click", () => A.go("history"));
    actHead.append(actTitles, viewAll);
    const table = el("table", "table");
    const thead = el("thead");
    const hr = el("tr");
    ["Study ID", "Predicted class", "Confidence", "Response time", "Actions"].forEach((h) => hr.append(el("th", "", h)));
    thead.append(hr);
    const tbody = el("tbody");
    table.append(thead, tbody);
    act.append(actHead, table);

    const drawTable = () => {
      tbody.replaceChildren();
      if (!A.history.length) {
        const tr = el("tr");
        const td = el("td", "muted empty", "No studies yet. Run a benchmark scan or upload an image.");
        td.colSpan = 5;
        tr.append(td);
        tbody.append(tr);
        return;
      }
      A.history.slice(0, 5).forEach((h) => {
        const tr = el("tr");
        const cls = el("span", "pill", A.nice(h.label));
        cls.style.color = A.COLORS[h.label] || "";
        const c1 = el("td");
        c1.append(cls);
        const open = el("button", "link", "Open in viewer \u2192");
        open.type = "button";
        open.addEventListener("click", () => A.openStudy(h));
        const c5 = el("td");
        c5.append(open);
        tr.append(el("td", "mono", h.id), c1, el("td", "", pct(h.confidence)), el("td", "mono", h.ms + " ms"), c5);
        tbody.append(tr);
      });
    };

    // ---- upload card ----
    const up = el("section", "card upload-card");
    up.append(el("div", "up-icon", "\u21EA"), el("h2", "", "Have your own MRI slice?"),
      el("p", "muted", "Upload an axial, sagittal or coronal slice (JPG or PNG, max 10 MB) to classify it and see the Grad-CAM attention map. Do not upload real patient data."));
    const upBtn = el("button", "btn primary wide", "+ Upload MRI image");
    upBtn.type = "button";
    upBtn.addEventListener("click", () => A.pickFile());
    up.append(upBtn);
    const two = el("div", "two-col");
    two.append(act, up);

    // ---- metric cards (from the backend, i.e. our measured results) ----
    const metrics = el("div", "metrics");
    const drawMetrics = () => {
      metrics.replaceChildren();
      const card = (label, value, sub) => {
        const c = el("div", "metric card");
        c.append(el("div", "metric-label", label), el("div", "metric-value", value), el("div", "metric-sub muted", sub));
        metrics.append(c);
      };
      const s = A.status;
      if (!s) { card("Model", "--", "Waiting for the backend"); return; }
      const pc = s.per_class || {};
      const classes = Object.keys(pc);
      const total = classes.reduce((a, c) => a + pc[c].support, 0);
      card("Test accuracy", s.test_accuracy != null ? pct(s.test_accuracy) : "--", total + " held-out test images");
      card("Validation accuracy", s.validation_accuracy != null ? pct(s.validation_accuracy) : "--",
        "Optimistic: slices of one patient can sit in both train and validation");
      if (classes.length) {
        const weak = classes.reduce((a, b) => (pc[a].recall <= pc[b].recall ? a : b));
        const missed = pc[weak].support - Math.round(pc[weak].recall * pc[weak].support);
        card("Weakest class: " + A.nice(weak), pct(pc[weak].recall) + " recall",
          missed + " of " + pc[weak].support + " missed on the test set");
      }
      card("Model", "ResNet18", "ImageNet transfer learning, CPU inference");
    };

    root.append(head, bench, two, metrics);
    drawBench(); drawTable(); drawMetrics();
    A.listen("nl:samples", drawBench);
    A.listen("nl:history", drawTable);
    A.listen("nl:status", drawMetrics);
  });
})();