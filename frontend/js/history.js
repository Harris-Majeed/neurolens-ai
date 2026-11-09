(() => {
  "use strict";
  const A = window.App;
  const el = A.el;
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const filt = { cls: "all", q: "" };

  const csvCell = (v) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;      // stops spreadsheet formula injection from file names
    return '"' + s.replace(/"/g, '""') + '"';
  };

  const exportCsv = () => {
    const rows = [["study_id", "time", "source_file", "benchmark_label", "predicted", "confidence", "response_ms"]];
    A.history.forEach((h) => rows.push([h.id, h.time, h.name, h.truth || "", h.label, h.confidence.toFixed(4), h.ms]));
    const text = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = el("a");
    a.href = url;
    a.download = "neurolens_history.csv";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const median = (a) => {
    const s = a.slice().sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const button = (label, cls, fn) => {
    const b = el("button", cls, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };

  A.register("history", (root) => {
    const head = el("div", "page-head");
    const titles = el("div");
    titles.append(el("h1", "", "Scan History"),
      el("p", "muted", "Studies run in this browser (up to 50 are kept)."));
    const acts = el("div", "page-actions");
    acts.append(
      button("Export CSV", "btn ghost", () => {
        if (!A.history.length) { A.toast("Nothing to export yet.", "warn"); return; }
        exportCsv();
      }),
      button("Clear history", "btn ghost", () => {
        if (!A.history.length) return;
        if (window.confirm("Remove all stored studies from this browser?")) {
          A.history = [];
          A.store.set("history", []);
          draw();
          A.toast("History cleared.");
        }
      }));
    head.append(titles, acts);

    const priv = el("section", "card");
    priv.append(el("h2", "", "What is stored"),
      el("p", "muted", "The history lives only in this browser (local storage). Each entry keeps the study ID, the file name, the predicted class, the probabilities, the response time and the time of the run. Images are never stored, and the server does not keep uploads. File names can contain personal information, so rename files before uploading, or clear the history when you are done."));

    const metrics = el("div", "metrics");

    // ---- filters and table ----
    const tableCard = el("section", "card");
    const filters = el("div", "filters");
    const sel = el("select");
    sel.setAttribute("aria-label", "Filter by predicted class");
    [["all", "All classes"]].concat(Object.keys(A.NAMES).map((c) => [c, A.nice(c)])).forEach((p) => {
      const o = el("option", "", p[1]);
      o.value = p[0];
      sel.append(o);
    });
    sel.value = filt.cls;
    const search = el("input");
    search.type = "search";
    search.placeholder = "Search study ID or file name";
    search.value = filt.q;
    sel.addEventListener("change", () => { filt.cls = sel.value; draw(); });
    search.addEventListener("input", () => { filt.q = search.value.trim().toLowerCase(); draw(); });
    filters.append(sel, search);

    const wrap = el("div", "tbl-wrap");
    const table = el("table", "table");
    const thead = el("thead");
    const hr = el("tr");
    ["Study ID", "Time", "Source", "Benchmark label", "Predicted", "Confidence", "Response", "Actions"]
      .forEach((h) => hr.append(el("th", "", h)));
    thead.append(hr);
    const tbody = el("tbody");
    table.append(thead, tbody);
    wrap.append(table);
    const empty = el("p", "muted");
    tableCard.append(filters, wrap, empty);

    root.append(head, priv, metrics, tableCard);

    const draw = () => {
      const hs = A.history;
      metrics.replaceChildren();
      if (hs.length) {
        const card = (label, value, sub) => {
          const c = el("div", "metric card");
          c.append(el("div", "metric-label", label), el("div", "metric-value", value), el("div", "metric-sub muted", sub));
          metrics.append(c);
        };
        const mean = hs.reduce((s, h) => s + h.confidence, 0) / hs.length;
        card("Studies stored", String(hs.length), "In this browser only");
        card("Mean confidence", pct(mean), "Confidence is not accuracy");
        card("Median response time", Math.round(median(hs.map((h) => h.ms))) + " ms", "Includes the network round trip");
        card("Low-confidence studies", String(hs.filter((h) => h.confidence < 0.7).length), "Top probability below 70%");
      }

      tbody.replaceChildren();
      const rows = hs.filter((h) =>
        (filt.cls === "all" || h.label === filt.cls) &&
        (!filt.q || h.id.toLowerCase().includes(filt.q) || h.name.toLowerCase().includes(filt.q)));
      empty.textContent = !hs.length
        ? "No studies yet. Run a benchmark scan or upload an image."
        : (!rows.length ? "No studies match the filter." : "");

      rows.forEach((h) => {
        const tr = el("tr");
        const src = el("td", "src-cell", h.name);
        src.title = h.name;
        const pill = el("span", "pill", A.nice(h.label));
        pill.style.color = A.COLORS[h.label] || "";
        const pc = el("td");
        pc.append(pill);
        const truth = h.truth ? A.nice(h.truth) + " (" + (h.truth === h.label ? "match" : "mismatch") + ")" : "\u2013";
        const act = el("td");
        const row = el("div", "row-actions");
        row.append(
          button("Open", "link", () => A.openStudy(h)),
          button("Report", "link", () => { A.reportTarget = h.id; A.go("reports"); }),
          button("Remove", "link", () => {
            A.history = A.history.filter((x) => x.id !== h.id);
            A.store.set("history", A.history);
            draw();
          }));
        act.append(row);
        tr.append(el("td", "mono", h.id), el("td", "", new Date(h.time).toLocaleString()), src,
          el("td", "", truth), pc, el("td", "", pct(h.confidence)), el("td", "mono", h.ms + " ms"), act);
        tbody.append(tr);
      });
    };

    draw();
    A.listen("nl:history", draw);
  });
})();