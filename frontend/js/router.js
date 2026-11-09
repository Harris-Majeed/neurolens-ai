(() => {
  "use strict";
  const A = window.App;

  A.pages = [
    { id: "overview", label: "Overview", icon: "\u25A6" },
    { id: "scan", label: "New Scan & Samples", icon: "\u21EA" },
    { id: "workspace", label: "MRI Workspace", icon: "\u25CE" },
    { id: "segmentation", label: "Segmentation Lab", icon: "\u2B21", badge: "3D" },
    { id: "explain", label: "Explainability", icon: "\u2699" },
    { id: "model", label: "Model Lab", icon: "\u25C8" },
    { id: "history", label: "Scan History", icon: "\u25F7" },
    { id: "reports", label: "Reports", icon: "\u25A4" },
    { id: "docs", label: "Docs & Ethics", icon: "\u25A3" },
  ];
  A.renderers = {};
  A.register = (id, fn) => { A.renderers[id] = fn; };
  A.go = (id) => { location.hash = "#/" + id; };

  A.drawBenchList = () => {
    const list = document.getElementById("benchList");
    if (!list) return;
    list.replaceChildren();
    A.samples.forEach((s) => {
      const b = A.el("button", "bench-item");
      b.type = "button";
      const d = A.el("span", "dot-c");
      d.style.background = A.COLORS[s.true_label] || "#888";
      b.append(d, A.el("span", "", A.sampleTitle(s)));
      b.addEventListener("click", () => A.runSample(s));
      list.append(b);
    });
  };

  A.renderNav = () => {
    const nav = document.getElementById("nav");
    nav.replaceChildren(A.el("div", "nav-title", "Navigation"));
    A.pages.forEach((p) => {
      const a = A.el("a", "nav-item");
      a.href = "#/" + p.id;
      a.dataset.page = p.id;
      a.append(A.el("span", "nav-icon", p.icon), A.el("span", "", p.label));
      if (p.badge) a.append(A.el("span", "badge", p.badge));
      nav.append(a);
    });
    nav.append(A.el("div", "nav-title nav-gap", "Benchmark scans"));
    const list = A.el("div", "bench-list");
    list.id = "benchList";
    nav.append(list);
    A.drawBenchList();
  };

  A.route = () => {
    const m = location.hash.match(/^#\/(\w+)/);
    const id = m && A.renderers[m[1]] ? m[1] : "overview";
    A.cleanups.splice(0).forEach((fn) => fn());
    const view = document.getElementById("view");
    view.replaceChildren();
    A.renderers[id](view);
    document.querySelectorAll(".nav-item").forEach((a) => a.classList.toggle("active", a.dataset.page === id));
    window.scrollTo(0, 0);
  };
})();