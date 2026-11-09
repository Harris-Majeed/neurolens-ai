(() => {
  "use strict";
  const A = window.App;
  const el = A.el;
  const U = A.ui;
  const para = (t) => el("p", "para", t);
  const button = (label, cls, fn) => {
    const b = el("button", cls, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };

  A.register("explain", (root) => {
    const head = el("div", "page-head");
    const titles = el("div");
    titles.append(el("h1", "", "Explainability"),
      el("p", "muted", "What the Grad-CAM heatmap shows, how to read it, and what it cannot tell you."));
    head.append(titles);

    const what = U.card("What you are looking at", [
      para("The coloured overlay in the MRI Workspace is a Grad-CAM map. It answers one question: which parts of the image pushed the model toward the class it predicted?"),
      para("Technically, the gradients of the predicted-class score are averaged over each channel of the last convolutional block of ResNet18 and used to weight that block's feature maps (a 7 \u00D7 7 grid). The result passes through a ReLU, is enlarged to 224 \u00D7 224 and is rescaled to the range 0 to 1 for each image separately."),
    ]);

    const legendBar = el("div", "legend-bar");
    const legendLabels = el("div", "legend-labels muted");
    legendLabels.append(el("span", "", "Low influence"), el("span", "", "High influence"));
    const read = U.card("How to read it", [legendBar, legendLabels, U.list([
      "Red and yellow mark the regions with the highest influence on this prediction. Blue marks regions with little influence.",
      "Every map is rescaled so that its strongest point is red, whatever the model's confidence. A vivid map is not evidence of a confident or correct result. Use the probability bars for confidence.",
      "The map is coarse. It comes from a 7 \u00D7 7 grid, so it shows roughly where the model looked, not exact borders.",
    ])]);

    const not = U.card("What it is not", [U.list([
      "It is not a tumor outline or a segmentation. The 2D classifier was trained only on image-level labels (which of four classes), never on where the tumor is.",
      "It is not proof that the model found the tumor. It can highlight surrounding anatomy, such as the skull base, that is typical for a class.",
      "It is not a check on correctness. For a wrong prediction it explains the wrong decision just as convincingly.",
      "Outlining a tumor needs a segmentation model. That is what the Segmentation Lab shows (gliomas only).",
    ])]);

    const seen = U.card("What we saw on the test set", [
      para("In the four most confident glioma-to-meningioma mistakes that we inspected, the attention sat on the visible mass. The model found the lesion but chose the wrong tumor type, with 93 to 95% confidence. On the test set, 42 of 386 gliomas were labelled meningioma and 20 were labelled no tumor."),
    ]);

    const pics = el("div", "lab-grid");
    pics.append(
      U.chartCard("Correct predictions", "assets/gradcam_correct.png", "Grad-CAM on correctly classified test images (red = most influential)"),
      U.chartCard("Missed gliomas", "assets/gradcam_missed_glioma.png", "Gliomas that the model labelled as another class"));

    const tryIt = U.card("Try it on a study", []);
    if (A.last) {
      const d = A.last.data, e = A.last.entry;
      const g = el("div", "split");
      [["data:image/png;base64," + d.original_png, "Original (resized)"],
       ["data:image/png;base64," + d.heatmap_png, "Grad-CAM overlay"]].forEach((p) => {
        const f = el("figure", "pane");
        const v = el("div", "viewer");
        const i = el("img");
        i.src = p[0];
        i.alt = p[1];
        v.append(i);
        f.append(v, el("figcaption", "muted", p[1]));
        g.append(f);
      });
      tryIt.append(
        para(e.id + ": " + A.nice(d.label) + ", " + (d.confidence * 100).toFixed(1) + "% confidence. Compare the original with its attention map."),
        g,
        button("Open in workspace", "btn ghost", () => A.go("workspace")));
    } else {
      tryIt.append(
        para("Run a benchmark scan or upload a slice, then return here to compare the original with its attention map."),
        button("Choose a benchmark scan", "btn primary", () => A.go("scan")));
    }

    root.append(head, what, read, not, seen, pics, tryIt);
  });
})();