(() => {
  "use strict";
  const A = window.App;
  const MAX_BYTES = 10 * 1024 * 1024;

  A.history = A.store.get("history", []);
  A.last = null;       // full result (with images) of the most recent study, kept in memory only
  A.samples = [];
  let busy = false;

  A.sampleUrl = (s) => A.api + "/samples/" + encodeURIComponent(s.name);
  A.sampleTitle = (s) => {
    const m = s.name.match(/^([a-z]+)(\d*)\./i);
    return m ? A.nice(m[1].toLowerCase()) + " sample" + (m[2] ? " " + m[2] : "") : s.name;
  };

  A.loadSamples = async () => {
    try { A.samples = await A.fetchJSON("/api/samples"); } catch (e) { A.samples = []; }
    A.emit("nl:samples");
  };

  A.analyze = async (blob, name, truth) => {
    if (busy) { A.toast("A study is already running. Please wait.", "warn"); return null; }
    busy = true;
    document.body.classList.add("busy");
    const t0 = performance.now();
    try {
      const fd = new FormData();
      fd.append("file", blob, name || "scan.jpg");
      const data = await A.fetchJSON("/api/predict", { method: "POST", body: fd });
      const ms = (A.staticMode && typeof data.recorded_ms === "number") ? data.recorded_ms : Math.round(performance.now() - t0);
      const n = A.store.get("counter", 0) + 1;
      A.store.set("counter", n);
      const entry = {
        id: "MRI-" + new Date().getFullYear() + "-" + String(n).padStart(3, "0"),
        name: name || "upload", truth: truth || null,
        label: data.label, confidence: data.confidence,
        probabilities: data.probabilities, ms: ms, time: new Date().toISOString(),
      };
      A.history.unshift(entry);
      A.history = A.history.slice(0, 50);
      A.store.set("history", A.history);
      A.last = { entry: entry, data: data };
      A.emit("nl:history");
      A.toast(entry.id + ": " + A.nice(entry.label) + " (" + (entry.confidence * 100).toFixed(1) + "%)");
      return A.last;
    } catch (e) {
      A.toast(e.message || "Request failed.", "bad");
      return null;
    } finally {
      busy = false;
      document.body.classList.remove("busy");
    }
  };

  A.runSample = async (s) => {
    try {
      const blob = await (await fetch(A.sampleUrl(s))).blob();
      return A.analyze(blob, s.name, s.true_label);
    } catch (e) {
      A.toast("Could not load the sample image.", "bad");
      return null;
    }
  };

  A.uploadFile = (file) => {
    if (A.staticMode) { A.toast("Preview only - run NeuroLens AI locally to analyze your own scans.", "warn"); return null; }
    if (!file) return null;
    if (file.type !== "image/png" && file.type !== "image/jpeg") { A.toast("Please choose a JPG or PNG image.", "bad"); return null; }
    if (file.size > MAX_BYTES) { A.toast("File too large (max 10 MB).", "bad"); return null; }
    return A.analyze(file, file.name, null);
  };

  A.pickFile = () => {
    if (A.staticMode) { A.toast("Preview only - run NeuroLens AI locally to analyze your own scans.", "warn"); return; }
    document.getElementById("globalFile").click();
  };
})();