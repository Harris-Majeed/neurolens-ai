(() => {
  "use strict";
  const A = window.App;
  const el = A.el;
  const U = A.ui;

  const textTable = (headers, rows) => {
    const wrap = el("div", "tbl-wrap");
    const t = el("table", "table");
    const thead = el("thead");
    const hr = el("tr");
    headers.forEach((h) => hr.append(el("th", "", h)));
    thead.append(hr);
    const tb = el("tbody");
    rows.forEach((r) => {
      const tr = el("tr");
      r.forEach((c) => tr.append(el("td", "", c)));
      tb.append(tr);
    });
    t.append(thead, tb);
    wrap.append(t);
    return wrap;
  };

  const link = (url, text) => {
    const a = el("a", "", text);
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  };

  A.register("docs", (root) => {
    const head = el("div", "page-head");
    const titles = el("div");
    titles.append(el("h1", "", "Docs & Ethics"),
      el("p", "muted", "Intended use, data sources, privacy, known limitations and credits."));
    head.append(titles);

    const about = U.card("About this workstation", [
      el("p", "para", "NeuroLens AI is a research and education project that combines two models on public brain MRI data: a 2D classifier with Grad-CAM attention maps (glioma, meningioma, pituitary adenoma, no tumor) and a 3D segmentation model that outlines glioma subregions on four-sequence MRI volumes."),
      el("p", "para", "It was built to explore explainable medical imaging AI and to document its limits honestly. It is not a product."),
    ]);

    const intended = U.card("Intended and not intended use", [
      el("p", "para", "Intended: learning, demonstration, and discussion of how medical imaging models are built, evaluated and explained."),
      U.list([
        "Not a medical device and not reviewed by any regulator.",
        "Not for diagnosis, screening, treatment decisions or patient management.",
        "Not a substitute for a radiologist or any qualified clinician.",
        "Do not upload real patient data.",
      ]),
    ]);

    const data = U.card("Data sources", [textTable(
      ["Dataset", "Used for", "Details"],
      [
        ["Kaggle Brain Tumor MRI Dataset", "2D classifier",
          "7,200 images in four classes (5,600 in the original Training folder, 1,600 in Testing). Read the license and origin notes on the dataset page before reusing the images."],
        ["BraTS 2023 adult glioma (GLI)", "3D segmentation",
          "1,251 scans of 1,133 patients with four sequences (T1n, T1c, T2w, T2-FLAIR) at 1 mm and expert masks. A random 100 patients were used. Accessed through a public Hugging Face copy, which lists CC-BY-4.0; the original challenge terms also apply."],
      ]),
      (() => {
        const p = el("p", "hint");
        p.append(document.createTextNode("Sources: "),
          link("https://huggingface.co/datasets/MedOtter/brats2023-gli-dataset", "BraTS 2023 GLI on Hugging Face"),
          document.createTextNode(" \u00B7 "),
          link("https://www.synapse.org/#!Synapse:syn51156910", "BraTS 2023 on Synapse"));
        return p;
      })(),
    ]);

    const handling = U.card("Data handling and evaluation", [U.list([
      "2D data: 187 byte-identical duplicate images were removed (7,013 unique); none were shared between the original Training and Testing folders. A stratified validation split was taken from Training, and the Testing folder was used once at the end.",
      "The 2D dataset has no patient identifiers, so slices of one patient may appear on both sides of a split. Validation accuracy is optimistic, and the test accuracy probably is too.",
      "3D data: split by patient (70 train, 15 validation, 15 test), because 118 patients have more than one scan. Each volume was cropped to the brain and each sequence was normalised inside the brain.",
      "The checkpoint of each model was chosen on validation data only. Test results are reported once.",
      "Benchmark samples in the app are test images chosen because the model classified them correctly with high confidence, so they show the model at its best. The four segmentation demo cases include the best, median and worst whole-tumor results.",
    ])]);

    const privacy = U.card("Privacy", [U.list([
      "Uploaded 2D images are processed in memory by the server code of this project and are not written to disk. If you host it elsewhere, check that host's logging.",
      "The 3D lab has no upload. It shows precomputed predictions for four held-out BraTS patients.",
      "Scan History is kept only in your own browser (local storage): study ID, file name, class, probabilities, time. Images are not stored. Use Clear history in Scan History to remove it.",
      "There are no accounts and no analytics scripts.",
    ])]);

    const fail = U.card("Known failure modes", [U.list([
      "The 2D model missed 63 of 386 gliomas on the test set: 42 were labelled meningioma, 20 no tumor and 1 pituitary adenoma. A tumor labelled \u201Cno tumor\u201D is the most serious kind of error.",
      "Anything outside the four classes (other tumor types, other organs, non-MRI images) is still forced into one of them, often with high confidence.",
      "Grad-CAM shows where the model looked, not where a tumor is. It is coarse and can highlight surrounding anatomy.",
      "The 3D model tends to over-segment small tumors and swelling, and it can predict enhancing tumor where the expert marked none.",
      "The 3D model was trained on gliomas only, on skull-stripped, co-registered 1 mm BraTS-style volumes. It is not expected to work on other tumor types or on raw scanner output.",
      "All results come from one training run and small test sets (1,584 images; 15 patients). Patient age, sex, scanner and site were not available for analysis, so subgroup performance is unknown.",
    ])]);

    const repro = U.card("Reproducibility and stack", [U.list([
      "Training ran in Google Colab on a T4 GPU with fixed random seeds; the data splits are saved with the project.",
      "2D: PyTorch and torchvision, ResNet18 pretrained on ImageNet, fine-tuned for 12 epochs. 3D: MONAI SegResNet, trained for 120 epochs on 96-voxel patches with a Dice plus cross-entropy loss.",
      "Serving: FastAPI on CPU. Front end: plain HTML, CSS and JavaScript with no external libraries.",
      "Exact metrics, per-patient results and charts are in Model Lab.",
    ])]);

    const credits = U.card("Credits and references", [U.list([
      "Brain Tumor MRI Dataset, Kaggle (the dataset's own page lists its original sources and license).",
      "BraTS challenge: Baid et al., The RSNA-ASNR-MICCAI BraTS 2021 benchmark on brain tumor segmentation and radiogenomic classification (2021); Menze et al., The multimodal brain tumor image segmentation benchmark (BRATS), IEEE Transactions on Medical Imaging 34(10), 2015.",
      "He et al., Deep residual learning for image recognition, CVPR 2016 (ResNet).",
      "Selvaraju et al., Grad-CAM: visual explanations from deep networks via gradient-based localization, ICCV 2017.",
      "Myronenko, 3D MRI brain tumor segmentation using autoencoder regularization, BrainLes 2018 (the SegResNet design used by MONAI).",
      "Software: PyTorch, MONAI, nibabel, FastAPI.",
    ])]);

    const g1 = el("div", "docs-grid");
    g1.append(intended, privacy);
    const g2 = el("div", "docs-grid");
    g2.append(data, handling);
    const g3 = el("div", "docs-grid");
    g3.append(fail, repro);
    root.append(head, about, g1, g2, g3, credits);
  });
})();