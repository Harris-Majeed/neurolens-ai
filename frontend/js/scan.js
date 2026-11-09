(() => {
  "use strict";
  const A = window.App;

  A.register("scan", (root) => {
    const el = A.el;
    const head = el("div", "page-head");
    const titles = el("div");
    titles.append(el("h1", "", "New Scan & Samples"),
      el("p", "muted", "Upload your own MRI slice or run one of the benchmark images."));
    head.append(titles);

    // ---- upload ----
    const up = el("section", "card");
    up.append(el("h2", "", "Upload an MRI slice"));
    const drop = el("label", "drop");
    drop.tabIndex = 0;
    const inp = el("input");
    inp.type = "file";
    inp.accept = "image/png,image/jpeg";
    inp.hidden = true;
    drop.append(inp, el("strong", "", "Drop an MRI slice here"),
      el("span", "muted", "or click to browse \u00B7 JPG or PNG \u00B7 max 10 MB"));
    inp.addEventListener("change", () => { A.uploadFile(inp.files[0]); inp.value = ""; });
    drop.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); }
    });
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => A.uploadFile(e.dataTransfer.files[0]));
    up.append(drop, el("p", "hint",
      "Uploads are processed in memory by the server and are not saved. Do not upload real patient data."));

    // ---- benchmark samples ----
    const bench = el("section", "card");
    bench.append(el("h2", "", "Benchmark samples"),
      el("p", "muted", "Images from the held-out test set. They were picked because the model classified them correctly with high confidence, so they show the model at its best. Upload your own slices to see typical behavior."));
    const grid = el("div", "bench-grid");
    bench.append(grid);
    const draw = () => {
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

    // ---- tips ----
    const tips = el("section", "card");
    tips.append(el("h2", "", "What works"));
    const ul = el("ul", "tips");
    [
      "Single 2D brain MRI slices (axial, sagittal or coronal), saved as JPG or PNG. T1 contrast-enhanced images are typical for the training data.",
      "The model knows only four outcomes: glioma, meningioma, pituitary adenoma, no tumor. Anything else (other tumor types, CT scans, non-brain images) will still be forced into one of them.",
      "Full 3D volumes are not accepted here. The 3D Segmentation Lab uses built-in demo cases.",
      "Results are research output and can be wrong. See Model Lab for measured accuracy and known weaknesses.",
    ].forEach((t) => ul.append(el("li", "", t)));
    tips.append(ul);

    root.append(head, up, bench, tips);
    draw();
    A.listen("nl:samples", draw);
  });
})();