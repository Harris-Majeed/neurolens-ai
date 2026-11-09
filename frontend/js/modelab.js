(() => {
  "use strict";
  const A = window.App;
  const el = A.el;
  const pct = (x) => (x == null ? "\u2013" : (x * 100).toFixed(1) + "%");
  const fix = (x, d) => (x == null ? "\u2013" : Number(x).toFixed(d));
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const REGIONS = [["WT", "Whole tumor"], ["TC", "Tumor core"], ["ET", "Enhancing tumor"]];

  function card(title, children) {
    const c = el("section", "card");
    if (title) c.append(el("h2", "", title));
    children.forEach((x) => c.append(x));
    return c;
  }

  function list(items) {
    const ul = el("ul", "list");
    items.forEach((t) => ul.append(el("li", "", t)));
    return ul;
  }

  function table(headers, rows) {
    const wrap = el("div", "tbl-wrap");
    const t = el("table", "table");
    const thead = el("thead");
    const hr = el("tr");
    headers.forEach((h, i) => hr.append(el("th", i ? "num" : "", h)));
    thead.append(hr);
    const tb = el("tbody");
    rows.forEach((r) => {
      const tr = el("tr");
      r.forEach((c, i) => tr.append(el("td", i ? "num" : "", String(c))));
      tb.append(tr);
    });
    t.append(thead, tb);
    wrap.append(t);
    return wrap;
  }

  function metricCards(items) {
    const box = el("div", "metrics");
    items.forEach((it) => {
      const c = el("div", "metric card");
      c.append(el("div", "metric-label", it[0]), el("div", "metric-value", it[1]),
        el("div", "metric-sub muted", it[2]));
      box.append(c);
    });
    return box;
  }

  // a card with a chart image; the whole card removes itself if the image file is missing
  function chartCard(title, src, caption) {
    const c = el("section", "card");
    c.append(el("h2", "", title));
    const f = el("figure", "imgbox");
    const img = el("img");
    img.alt = caption;
    img.loading = "lazy";
    img.addEventListener("error", () => c.remove());
    img.src = src;
    f.append(img, el("figcaption", "muted", caption));
    c.append(f);
    return c;
  }

  A.ui = { card: card, list: list, table: table, chartCard: chartCard };

  function classifierSection(m) {
    const out = [];
    const cls = m.classes, cm = m.confusion_matrix, pc = m.per_class;
    out.push(el("h2", "section-title", "2D classifier: ResNet18"));
    out.push(metricCards([
      ["Test accuracy", pct(m.test_accuracy), m.n_test + " held-out test images"],
      ["Balanced accuracy", pct(m.balanced_accuracy), "Mean recall over the four classes"],
      ["Validation accuracy", pct(m.val_accuracy), "Optimistic; used to pick the checkpoint"],
    ]));

    const perClass = card("Per-class results (test set)", [
      table(["Class", "Precision", "Recall", "F1", "Images"],
        cls.map((c) => [A.nice(c), pct(pc[c].precision), pct(pc[c].recall), pct(pc[c]["f1-score"]), pc[c].support])),
      el("p", "hint", "Recall is the share of real cases of a class that the model found. Precision is the share of its predictions for that class that were correct."),
    ]);

    const t = el("table", "cm");
    const hr = el("tr");
    hr.append(el("th", "", ""));
    cls.forEach((c) => hr.append(el("th", "", "Predicted " + A.nice(c))));
    t.append(hr);
    cm.forEach((row, i) => {
      const tr = el("tr");
      tr.append(el("th", "row", "True " + A.nice(cls[i])));
      const total = sum(row);
      row.forEach((v, j) => {
        const td = el("td", i === j ? "diag" : "");
        const share = total ? v / total : 0;
        const base = i === j ? "var(--accent)" : "var(--bad)";
        td.style.background = "color-mix(in srgb, " + base + " " + Math.round(share * 80 + (v ? 5 : 0)) + "%, var(--panel2))";
        td.append(el("span", "n", String(v)), el("span", "p", pct(share)));
        tr.append(td);
      });
      t.append(tr);
    });

    const recall = cls.map((c, i) => cm[i][i] / (sum(cm[i]) || 1));
    const w = recall.indexOf(Math.min.apply(null, recall));
    const row = cm[w];
    const missed = sum(row) - row[w];
    const where = cls.map((c, j) => [c, row[j]])
      .filter((p, j) => j !== w && p[1] > 0)
      .sort((a, b) => b[1] - a[1])
      .map((p) => p[1] + " as " + A.nice(p[0]).toLowerCase());
    let finding = "Weakest class: " + A.nice(cls[w]).toLowerCase() + ". " + missed + " of " + sum(row) +
      " were missed (" + where.join(", ") + ").";
    const ni = cls.indexOf("notumor");
    if (ni >= 0 && ni !== w && row[ni] > 0) finding += " Labelling a tumor as no tumor is the most serious kind of error.";
    const cmCard = card("Confusion matrix (test set)", [t, el("p", "hint", finding)]);

    const grid = el("div", "lab-grid");
    grid.append(perClass, cmCard);
    out.push(grid);

    const protocol = card("Data and protocol", [list([
      "Data: Kaggle Brain Tumor MRI Dataset, 7,200 images in four classes. 187 byte-identical duplicate files were removed (7,013 unique); none were shared between the original Training and Testing folders.",
      "Split: 4,614 training and 815 validation images (a stratified split of the original Training folder) and 1,584 test images (the original Testing folder, evaluated once at the end).",
      "Model: ResNet18 pretrained on ImageNet with all layers fine-tuned, 224 \u00D7 224 input, flip, small rotation, shift and contrast augmentation, label smoothing 0.1, AdamW with a one-cycle schedule, 12 epochs. The checkpoint was chosen by validation accuracy (epoch 7).",
      "Caveat: the dataset has no patient identifiers, so slices of one patient can appear on both sides of a split. Validation accuracy is optimistic and the test accuracy probably is too.",
    ])]);
    const curves = chartCard("Training curves", "assets/learning_curves.png", "Loss and accuracy per epoch (train and validation)");
    const grid2 = el("div", "lab-grid");
    grid2.append(protocol, curves);
    out.push(grid2);
    return out;
  }

  function segSection(s) {
    const out = [];
    const sm = s.summary;
    const n = s.n_test_patients;
    const dice = REGIONS.map((r) => sm[r[0]]["Dice mean"]);
    out.push(el("h2", "section-title", "3D segmentation: SegResNet on BraTS 2023 gliomas"));
    out.push(metricCards([
      ["Whole tumor Dice", fix(dice[0], 3), "mean over " + n + " test patients"],
      ["Tumor core Dice", fix(dice[1], 3), "mean over " + n + " test patients"],
      ["Enhancing tumor Dice", fix(dice[2], 3), "mean over " + n + " test patients"],
      ["Mean of the three", fix(sum(dice) / 3, 3), "validation, chosen checkpoint: " + fix(s.val_mean_dice, 3)],
    ]));

    const KEYS = [
      ["Dice mean", "Dice (mean)", 3], ["Dice std", "Dice (std)", 3], ["Dice median", "Dice (median)", 3],
      ["Dice min", "Dice (worst patient)", 3], ["IoU mean", "IoU (mean)", 3], ["Sensitivity", "Sensitivity", 3],
      ["Precision", "Precision", 3], ["Volume corr", "Volume correlation", 3],
      ["Mean abs vol error (cm3)", "Mean volume error (cm\u00B3)", 1],
    ];
    const summaryCard = card("Test results by region", [
      table(["Metric", "Whole tumor", "Tumor core", "Enhancing"],
        KEYS.map((k) => [k[1]].concat(REGIONS.map((r) => fix(sm[r[0]][k[0]], k[2]))))),
      el("p", "hint", "Dice and IoU measure overlap with the expert outline (1.0 is perfect). Where the expert mask is empty and the model also predicts nothing, the BraTS convention scores 1.0."),
    ]);

    const cases = (s.per_case || []).slice().sort((a, b) => a.WT_dice - b.WT_dice);
    const perCase = card("Per-patient results (worst first)", [
      table(["Patient", "WT Dice", "TC Dice", "ET Dice", "WT expert cm\u00B3", "WT model cm\u00B3"],
        cases.map((c) => [c.case, fix(c.WT_dice, 2), fix(c.TC_dice, 2), fix(c.ET_dice, 2),
          fix(c.WT_vol_true, 1), fix(c.WT_vol_pred, 1)])),
    ]);
    const grid = el("div", "lab-grid");
    grid.append(summaryCard, perCase);
    out.push(grid);

    const notes = [
      "Data: BraTS 2023 adult glioma MRI with four sequences (T1n, T1c, T2w, T2-FLAIR) at 1 mm voxels and expert masks. A random subset of 100 of the 1,133 patients was used (the first scan of each), not the full dataset. The split is by patient: 70 training, 15 validation, 15 test.",
      "Model: SegResNet (MONAI), 4.7 million parameters, with three sigmoid outputs for the overlapping regions whole tumor, tumor core and enhancing tumor. Trained on 96 \u00D7 96 \u00D7 96 patches (two thirds centred on tumor) with a Dice plus cross-entropy loss, AdamW and a cosine schedule for 120 epochs (about 85 minutes on a Colab T4). Whole-brain predictions use a sliding window.",
      "Checkpoint: epoch " + s.checkpoint_epoch + ", chosen by validation mean Dice (" + fix(s.val_mean_dice, 3) +
        ") on 15 patients. The results above come from 15 different patients that were never used for training or checkpoint choice.",
    ];
    if (sm.ET["Dice min"] === 0) {
      notes.push("One test patient has no enhancing tumor in the expert mask while the model predicted a small amount. That scores an enhancing-tumor Dice of 0 for the patient and lowers the average.");
    }
    notes.push("With 15 test patients, one training run and one split, these scores carry wide uncertainty. They are not comparable with BraTS challenge leaderboards, which use different data and a hidden test set.");
    out.push(card("Data and protocol", [list(notes)]));

    const charts = el("div", "lab-grid");
    charts.append(
      chartCard("Training curves", "assets/seg_training_curves.png", "Training loss and validation Dice per region"),
      chartCard("Test Dice per patient", "assets/seg_test_dice_boxplot.png", "Distribution over the 15 test patients"),
      chartCard("Test examples", "assets/seg_test_examples.png", "Worst, median and best test cases (expert on the left, prediction in the middle)"));
    out.push(charts);
    return out;
  }

  A.register("model", (root) => {
    const head = el("div", "page-head");
    const titles = el("div");
    titles.append(el("h1", "", "Model Lab"),
      el("p", "muted", "Measured performance, evaluation protocol and known limitations of both models."));
    head.append(titles);
    const body = el("div");
    body.append(el("p", "muted", "Loading measured results..."));
    root.append(head, body);

    (async () => {
      let info;
      try {
        info = await A.fetchJSON("/api/model-info");
      } catch (e) {
        if (document.body.contains(body)) body.replaceChildren(card("", [el("p", "", "Could not load results: " + e.message)]));
        return;
      }
      if (!document.body.contains(body)) return;
      body.replaceChildren();
      if (info.classifier) {
        classifierSection(info.classifier).forEach((x) => body.append(x));
      } else {
        body.append(card("2D classifier", [el("p", "", "docs/metrics_2d.json was not found.")]));
      }
      if (info.segmentation) {
        segSection(info.segmentation).forEach((x) => body.append(x));
      } else {
        body.append(card("3D segmentation", [el("p", "", "docs/seg_test_metrics.json was not found. Download it from Google Drive (neuroscan-ai/segmentation) and run scripts/collect_results.py.")]));
      }
      body.append(card("Limitations", [list([
        "Both models are research prototypes trained on public datasets. They are not medical devices.",
        "The test sets are small (1,584 images; 15 patients) and every number comes from a single training run, so small differences should not be over-read.",
        "The 2D dataset has no patient identifiers, so test slices may come from patients seen in training. Real-world accuracy is likely lower.",
        "The 2D classifier has only four outcomes. It cannot recognise other conditions, and a tumor labelled no tumor is its most serious error.",
        "The segmentation model handles gliomas only and expects skull-stripped, co-registered 1 mm BraTS-style volumes. The demo shows precomputed predictions for four test patients.",
      ])]));
    })();
  });
})();