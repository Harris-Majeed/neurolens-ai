(() => {
  "use strict";
  const A = (window.App = {});
  const cfg = window.APP || {};
  A.api = (cfg.api || "").replace(/\/+$/, "");
  A.cleanups = [];

  A.NAMES = { glioma: "Glioma", meningioma: "Meningioma", notumor: "No tumor", pituitary: "Pituitary adenoma" };
  A.COLORS = { glioma: "#ff5d5d", meningioma: "#f5a524", notumor: "#34d399", pituitary: "#8b8cff" };
  A.nice = (c) => A.NAMES[c] || c;

  A.el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  A.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("nl_" + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("nl_" + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
  };

  A.listen = (ev, fn) => {
    document.addEventListener(ev, fn);
    A.cleanups.push(() => document.removeEventListener(ev, fn));
  };
  A.emit = (ev) => document.dispatchEvent(new CustomEvent(ev));

  A.applyTheme = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    A.store.set("theme", t);
    const b = document.getElementById("themeBtn");
    if (b) b.textContent = t === "dark" ? "Light mode" : "Dark mode";
  };

  let toastTimer;
  A.toast = (msg, kind) => {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = "toast"; }, 4200);
  };

  // ---- static preview mode (e.g. Vercel): no backend, answers come from recorded files ----
  A.staticMode = false;
  let modePromise = null;
  const STATIC_FILES = {
    "/api/status": "status.json",
    "/api/samples": "samples.json",
    "/api/model-info": "model-info.json",
    "/api/seg/cases": "seg-cases.json",
  };
  const PREVIEW_MSG = "Preview only - upload is disabled on this site. Run NeuroLens AI locally to analyze your own scans.";

  const showBanner = () => {
    if (document.getElementById("staticBanner")) return;
    const b = document.createElement("div");
    b.id = "staticBanner";
    b.style.cssText = "background:#0d9488;color:#fff;padding:8px 14px;font-size:13px;text-align:center;line-height:1.4;";
    b.append("Static preview - results shown are precomputed from the real model on the benchmark scans. To analyze your own scans, run it locally: ");
    const a = document.createElement("a");
    a.href = "https://github.com/Harris-Majeed/neurolens-ai#run-it-locally";
    a.target = "_blank";
    a.rel = "noopener";
    a.style.cssText = "color:#fff;text-decoration:underline;font-weight:600;";
    a.textContent = "setup steps";
    b.append(a);
    document.body.prepend(b);
  };

  const detectMode = () => {
    if (!modePromise) {
      modePromise = (async () => {
        try {
          const r = await fetch(A.api + "/api/status");
          const ct = r.headers.get("content-type") || "";
          if (r.ok && ct.includes("json")) return false;
        } catch (e) { /* no backend reachable */ }
        try {
          const s = await fetch(A.api + "/static_api/status.json");
          if (s.ok) { A.staticMode = true; showBanner(); return true; }
        } catch (e) { /* fall through */ }
        return false;
      })();
    }
    return modePromise;
  };

  const staticJSON = async (path, opts) => {
    let url;
    if (path === "/api/predict") {
      const f = opts && opts.body && opts.body.get && opts.body.get("file");
      const name = f && f.name ? f.name : "";
      url = A.api + "/static_api/predict/" + encodeURIComponent(name) + ".json";
    } else if (STATIC_FILES[path]) {
      url = A.api + "/static_api/" + STATIC_FILES[path];
    } else {
      throw new Error(PREVIEW_MSG);
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(PREVIEW_MSG);
    return r.json();
  };

  A.fetchJSON = async (path, opts) => {
    if (await detectMode()) return staticJSON(path, opts);
    const r = await fetch(A.api + path, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Server error (" + r.status + ")");
    return data;
  };

  A.status = null;
  A.loadStatus = async () => {
    const box = document.getElementById("status");
    try {
      A.status = await A.fetchJSON("/api/status");
      box.classList.add("ok");
      document.getElementById("statusText").textContent = (A.staticMode ? "Static preview (precomputed)" : "Model online (CPU)");
    } catch (e) {
      box.classList.add("bad");
      document.getElementById("statusText").textContent = "Backend offline";
    }
    A.emit("nl:status");
  };

  A.openModal = (title, paragraphs) => {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").replaceChildren(...paragraphs.map((p) => A.el("p", "", p)));
    document.getElementById("modal").hidden = false;
  };
  A.closeModal = () => { document.getElementById("modal").hidden = true; };
  document.getElementById("modalClose").addEventListener("click", A.closeModal);
  document.getElementById("modal").addEventListener("click", (e) => { if (e.target.id === "modal") A.closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") A.closeModal(); });
})();