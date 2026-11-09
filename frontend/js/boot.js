(() => {
  "use strict";
  const A = window.App;
  const cfg = window.APP || {};
  document.getElementById("brandName").textContent = cfg.name || "NeuroLens AI";
  document.getElementById("brandSub").textContent = cfg.subtitle || "";
  document.title = (cfg.name || "NeuroLens AI") + " | Brain MRI Research Workstation";
  A.applyTheme(A.store.get("theme", "dark"));

  document.getElementById("themeBtn").addEventListener("click", () =>
    A.applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  document.getElementById("analyzeBtn").addEventListener("click", () => A.pickFile());
  document.getElementById("noticeBtn").addEventListener("click", () =>
    A.openModal("Research notice", [
      "This workstation is a research and education demo built on public datasets. It is not a medical device, has not been reviewed by any regulator, and must not be used for diagnosis, treatment or patient-management decisions.",
      "Results can be wrong, including missed tumors. Do not upload real patient data. The server processes uploads in memory and does not save them.",
    ]));

  const input = document.getElementById("globalFile");
  input.addEventListener("change", () => { A.uploadFile(input.files[0]); input.value = ""; });
  document.addEventListener("nl:samples", A.drawBenchList);

  A.renderNav();
  window.addEventListener("hashchange", A.route);
  A.route();
  A.loadStatus();
  A.loadSamples();
})();