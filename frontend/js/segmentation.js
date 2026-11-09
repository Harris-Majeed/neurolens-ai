(() => {
  "use strict";
  const A = window.App;
  const LABEL_RGB = { 1: [255, 59, 48], 2: [57, 213, 255], 3: [255, 214, 10] };
  const DIFF_RGB = { both: [52, 211, 153], fp: [217, 70, 239], fn: [245, 165, 36] };
  const NAMES = { WT: "Whole tumor", TC: "Tumor core", ET: "Enhancing tumor" };
  const AXIS = { axial: "z", coronal: "y", sagittal: "x" };
  const ui = { caseId: null, mod: "flair", mode: "pred", opacity: 55,
    show: { 1: true, 2: true, 3: true }, cross: true, flipH: false, flipV: false };
  const rgb = (c) => "rgb(" + c.join(",") + ")";
  const cm3 = (v) => v.toFixed(1) + " cm\u00B3";

  A.register("segmentation", (root) => {
    const el = A.el;
    let alive = true;
    let timer = null;
    A.cleanups.push(() => { alive = false; if (timer) clearInterval(timer); });

    const head = el("div", "page-head");
    const titles = el("div");
    titles.append(el("h1", "", "Segmentation Lab (3D)"),
      el("p", "muted", "Glioma subregion segmentation on BraTS 2023 MRI, shown in three planes."));
    head.append(titles);

    const notice = el("section", "card notice-card");
    notice.append(el("h2", "", "About these results"),
      el("p", "muted", "The overlays are predictions precomputed by our 3D model for four held-out test patients, who were never used for training or for choosing the checkpoint. This demo does not run the 3D model live. The cases show the range, including the weakest results. The model is trained on gliomas only (BraTS), uses all four MRI sequences, and is a research prototype, not a medical device."));

    const caseCard = el("section", "card");
    caseCard.append(el("h2", "", "Demo cases"));
    const grid = el("div", "case-grid");
    caseCard.append(grid);
    const body = el("div");
    root.append(head, notice, caseCard, body);

    let cases = [];
    const drawCases = () => {
      grid.replaceChildren();
      cases.forEach((m) => {
        const b = el("button", "case-card" + (m.id === ui.caseId ? " on" : ""));
        b.type = "button";
        b.append(el("div", "t", m.title), el("div", "id", m.id),
          el("div", "d", "Whole-tumor Dice " + m.dice.WT.toFixed(2)));
        b.addEventListener("click", () => select(m.id));
        grid.append(b);
      });
    };

    const select = async (id) => {
      ui.caseId = id;
      if (timer) { clearInterval(timer); timer = null; }
      drawCases();
      const meta = cases.find((m) => m.id === id);
      body.replaceChildren(el("div", "card loading", "Loading volume (about 15 MB)..."));
      try {
        const vol = await A.seg.loadVolume(meta);
        if (!alive || ui.caseId !== id) return;
        build(body, vol, meta);
      } catch (e) {
        if (alive) body.replaceChildren(el("div", "card", "Could not load this case: " + e.message));
      }
    };

    (async () => {
      try {
        cases = await A.seg.loadCases();
      } catch (e) {
        if (alive) body.replaceChildren(el("div", "card", "Could not reach the backend: " + e.message));
        return;
      }
      if (!alive) return;
      if (!cases.length) {
        body.replaceChildren(el("div", "card", "No demo cases found in frontend/seg_demo."));
        return;
      }
      if (!cases.some((m) => m.id === ui.caseId)) ui.caseId = cases[0].id;
      select(ui.caseId);
    })();

    function build(container, vol, meta) {
      const X = vol.X, Y = vol.Y, Z = vol.Z;
      const pos = A.seg.startPosition(vol);
      let alpha = ui.opacity / 100;
      const planes = [
        { key: "axial", title: "Axial", w: X, h: Y, max: Z - 1, ori: ["A", "P", "R", "L"] },
        { key: "coronal", title: "Coronal", w: X, h: Z, max: Y - 1, ori: ["S", "I", "R", "L"] },
        { key: "sagittal", title: "Sagittal", w: Y, h: Z, max: X - 1, ori: ["S", "I", "A", "P"] },
      ];

      const paint = (i, d, o) => {
        const g = ui.mod === "flair" ? vol.flair[i] : vol.t1c[i];
        let col = null, al = alpha;
        if (ui.mode === "pred" || ui.mode === "gt") {
          const lab = (ui.mode === "pred" ? vol.pred : vol.gt)[i];
          if (lab && ui.show[lab]) col = LABEL_RGB[lab];
        } else if (ui.mode === "diff") {
          const p = vol.pred[i] > 0, t = vol.gt[i] > 0;
          if (p && t) { col = DIFF_RGB.both; al = alpha * 0.45; }
          else if (p) col = DIFF_RGB.fp;
          else if (t) col = DIFF_RGB.fn;
        }
        if (col) {
          d[o] = g * (1 - al) + col[0] * al;
          d[o + 1] = g * (1 - al) + col[1] * al;
          d[o + 2] = g * (1 - al) + col[2] * al;
        } else {
          d[o] = g; d[o + 1] = g; d[o + 2] = g;
        }
        d[o + 3] = 255;
      };

      const drawCross = (p) => {
        let cx, cy;
        if (p.key === "axial") { cx = pos.x; cy = pos.y; }
        else if (p.key === "coronal") { cx = pos.x; cy = Z - 1 - pos.z; }
        else { cx = pos.y; cy = Z - 1 - pos.z; }
        const c = p.ctx;
        c.strokeStyle = "rgba(45,212,191,0.75)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(cx + 0.5, 0); c.lineTo(cx + 0.5, p.h);
        c.moveTo(0, cy + 0.5); c.lineTo(p.w, cy + 0.5);
        c.stroke();
      };

      const renderPlane = (p) => {
        const d = p.img.data;
        if (p.key === "axial") {
          const z = pos.z;
          for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) paint((x * Y + y) * Z + z, d, (y * X + x) * 4);
        } else if (p.key === "coronal") {
          const y = pos.y;
          for (let z = 0; z < Z; z++) {
            const row = (Z - 1 - z) * X;
            for (let x = 0; x < X; x++) paint((x * Y + y) * Z + z, d, (row + x) * 4);
          }
        } else {
          const x = pos.x;
          for (let z = 0; z < Z; z++) {
            const row = (Z - 1 - z) * Y;
            for (let y = 0; y < Y; y++) paint((x * Y + y) * Z + z, d, (row + y) * 4);
          }
        }
        p.ctx.putImageData(p.img, 0, 0);
        if (ui.cross) drawCross(p);
      };

      const renderAll = () => { alpha = ui.opacity / 100; planes.forEach(renderPlane); };

      const syncSliders = () => {
        planes.forEach((p) => {
          const v = pos[AXIS[p.key]];
          p.input.value = v;
          p.num.textContent = (v + 1) + " / " + (p.max + 1);
        });
      };

      const updateOri = () => {
        planes.forEach((p) => {
          const t = p.ori[0], b = p.ori[1], l = p.ori[2], r = p.ori[3];
          p.oriEls.t.textContent = ui.flipV ? b : t;
          p.oriEls.b.textContent = ui.flipV ? t : b;
          p.oriEls.l.textContent = ui.flipH ? r : l;
          p.oriEls.r.textContent = ui.flipH ? l : r;
          p.canvas.style.transform = "scale(" + (ui.flipH ? -1 : 1) + "," + (ui.flipV ? -1 : 1) + ")";
        });
      };

      // ---- the three views ----
      const views = el("div", "views");
      planes.forEach((p) => {
        p.canvas = el("canvas");
        p.canvas.width = p.w;
        p.canvas.height = p.h;
        p.ctx = p.canvas.getContext("2d");
        p.img = p.ctx.createImageData(p.w, p.h);
        p.oriEls = {};
        ["t", "b", "l", "r"].forEach((k) => { p.oriEls[k] = el("span", "ori " + k); });
        const wrap = el("div", "cv-wrap");
        wrap.append(p.canvas, p.oriEls.t, p.oriEls.b, p.oriEls.l, p.oriEls.r);
        p.input = el("input");
        p.input.type = "range";
        p.input.min = 0;
        p.input.max = p.max;
        p.input.setAttribute("aria-label", p.title + " slice");
        p.num = el("span", "n");
        p.input.addEventListener("input", () => {
          pos[AXIS[p.key]] = Number(p.input.value);
          syncSliders();
          renderAll();
        });
        const row = el("div", "slider-row");
        row.append(el("span", "", "Slice"), p.input, p.num);
        const fig = el("figure", "view-box");
        fig.append(el("figcaption", "", p.title), wrap, row);
        views.append(fig);
        p.canvas.addEventListener("click", (e) => {
          const r = p.canvas.getBoundingClientRect();
          let fx = (e.clientX - r.left) / r.width;
          let fy = (e.clientY - r.top) / r.height;
          if (ui.flipH) fx = 1 - fx;
          if (ui.flipV) fy = 1 - fy;
          const c = Math.min(p.w - 1, Math.max(0, Math.floor(fx * p.w)));
          const rr = Math.min(p.h - 1, Math.max(0, Math.floor(fy * p.h)));
          if (p.key === "axial") { pos.x = c; pos.y = rr; }
          else if (p.key === "coronal") { pos.x = c; pos.z = Z - 1 - rr; }
          else { pos.y = c; pos.z = Z - 1 - rr; }
          syncSliders();
          renderAll();
        });
      });

      // ---- toolbar ----
      const legendBox = el("div");
      const refreshSide = () => {
        legendBox.replaceChildren();
        if (ui.mode === "none") {
          legendBox.append(el("p", "muted", "MRI only, no overlay."));
          return;
        }
        const ul = el("ul", "legend-list");
        const item = (c, t) => {
          const li = el("li");
          const s = el("span", "swatch");
          s.style.background = rgb(c);
          li.append(s, document.createTextNode(t));
          ul.append(li);
        };
        if (ui.mode === "diff") {
          item(DIFF_RGB.both, "Whole tumor: model and expert agree");
          item(DIFF_RGB.fp, "Model only (extra)");
          item(DIFF_RGB.fn, "Expert only (missed by the model)");
        } else {
          item(LABEL_RGB[1], "Necrotic core");
          item(LABEL_RGB[2], "Edema");
          item(LABEL_RGB[3], "Enhancing tumor");
        }
        legendBox.append(ul);
      };

      const segButtons = (opts, get, set) => {
        const wrap = el("div", "seg");
        const bs = opts.map((o) => {
          const b = el("button", get() === o[0] ? "on" : "", o[1]);
          b.type = "button";
          b.addEventListener("click", () => {
            set(o[0]);
            bs.forEach((x, i) => x.classList.toggle("on", opts[i][0] === o[0]));
            renderAll();
            refreshSide();
          });
          return b;
        });
        wrap.append(...bs);
        return wrap;
      };

      const check = (label, get, set) => {
        const l = el("label");
        const i = el("input");
        i.type = "checkbox";
        i.checked = get();
        i.addEventListener("change", () => { set(i.checked); updateOri(); renderAll(); });
        l.append(i, document.createTextNode(label));
        return l;
      };

      const opLab = el("label");
      const op = el("input");
      op.type = "range"; op.min = 0; op.max = 100; op.value = ui.opacity;
      const opVal = el("span", "", ui.opacity + "%");
      op.addEventListener("input", () => { ui.opacity = Number(op.value); opVal.textContent = ui.opacity + "%"; renderAll(); });
      opLab.append(document.createTextNode("Overlay opacity"), op, opVal);

      const play = el("button", "btn ghost", "\u25B6 Play axial");
      play.type = "button";
      play.addEventListener("click", () => {
        if (timer) { clearInterval(timer); timer = null; play.textContent = "\u25B6 Play axial"; return; }
        play.textContent = "Pause";
        timer = setInterval(() => { pos.z = (pos.z + 1) % Z; syncSliders(); renderAll(); }, 80);
      });

      const tools = el("div", "seg-tools");
      tools.append(
        segButtons([["pred", "Prediction"], ["gt", "Expert"], ["diff", "Disagreement"], ["none", "MRI only"]],
          () => ui.mode, (v) => { ui.mode = v; }),
        segButtons([["flair", "FLAIR"], ["t1c", "T1c"]], () => ui.mod, (v) => { ui.mod = v; }),
        opLab,
        check("Necrotic", () => ui.show[1], (v) => { ui.show[1] = v; }),
        check("Edema", () => ui.show[2], (v) => { ui.show[2] = v; }),
        check("Enhancing", () => ui.show[3], (v) => { ui.show[3] = v; }),
        check("Crosshair", () => ui.cross, (v) => { ui.cross = v; }),
        check("Flip L-R", () => ui.flipH, (v) => { ui.flipH = v; }),
        check("Flip U-D", () => ui.flipV, (v) => { ui.flipV = v; }),
        play);

      const left = el("section", "card");
      left.append(tools, views,
        el("p", "hint", "Click an image to move the crosshair; the other planes follow. Use the sliders or arrow keys to scroll. Letters mark anatomical directions: A anterior, P posterior, S superior, I inferior, L and R the patient's left and right."));

      // ---- side panel ----
      const volCard = el("section", "card");
      volCard.append(el("h2", "", "Volumes and agreement"));
      const table = el("table", "table vol-table");
      const hr = el("tr");
      ["Region", "Expert", "Model", "Dice"].forEach((h) => hr.append(el("th", "", h)));
      const thead = el("thead");
      thead.append(hr);
      const tbody = el("tbody");
      ["WT", "TC", "ET"].forEach((k) => {
        const tr = el("tr");
        tr.append(el("td", "", NAMES[k]), el("td", "", cm3(meta.volumes_cm3_expert[k])),
          el("td", "", cm3(meta.volumes_cm3_pred[k])), el("td", "", meta.dice[k].toFixed(2)));
        tbody.append(tr);
      });
      table.append(thead, tbody);
      volCard.append(table);
      if (meta.volumes_cm3_expert.ET === 0) {
        volCard.append(el("p", "hint warn", "The expert mask contains no enhancing tumor for this patient. The model predicted " +
          cm3(meta.volumes_cm3_pred.ET) + ", so the enhancing-tumor Dice is 0.00 under the BraTS convention."));
      }
      if (meta.dice.WT < 0.8) {
        volCard.append(el("p", "hint warn", "Lower agreement case (whole-tumor Dice " + meta.dice.WT.toFixed(2) +
          "). Switch to the Disagreement view to see where the two outlines differ."));
      }
      volCard.append(el("p", "hint", "Dice compares the model with the expert mask over the whole 3D volume. Volumes assume 1 mm voxels."));

      const legendCard = el("section", "card");
      legendCard.append(el("h2", "", "Legend"), legendBox);

      const infoCard = el("section", "card");
      infoCard.append(el("h2", "", "Case"));
      const dl = el("dl", "info");
      const add = (k, v) => dl.append(el("dt", "", k), el("dd", "", v));
      add("Patient", meta.id);
      add("Role", meta.title);
      add("Cropped size", meta.shape.join(" \u00D7 "));
      add("Voxel size", meta.spacing_mm.join(" \u00D7 ") + " mm");
      add("Orientation", meta.orientation);
      infoCard.append(dl);

      const side = el("div", "side-col");
      side.append(volCard, legendCard, infoCard);
      const layout = el("div", "seg-layout");
      layout.append(left, side);
      container.replaceChildren(layout);

      updateOri();
      syncSliders();
      refreshSide();
      renderAll();
    }
  });
})();