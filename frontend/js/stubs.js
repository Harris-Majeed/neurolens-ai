(() => {
  "use strict";
  const A = window.App;
  const LATER = "This page is built in a later step of the project.";
  const STUBS = {
    scan: "New Scan & Samples",
    workspace: "MRI Workspace",
    segmentation: "Segmentation Lab (3D)",
    explain: "Explainability",
    model: "Model Lab",
    history: "Scan History",
    reports: "Reports",
    docs: "Docs & Ethics",
  };
  Object.keys(STUBS).forEach((id) => {
    if (A.renderers[id]) return;     // a real page was registered, keep it
    A.register(id, (root) => {
      const card = A.el("section", "card");
      card.append(A.el("h1", "", STUBS[id]), A.el("p", "muted", LATER));
      root.append(card);
    });
  });
})();