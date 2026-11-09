(() => {
  "use strict";
  const A = window.App;
  A.seg = { cases: null, note: "", skipped: [], vols: new Map() };

  A.seg.loadCases = async () => {
    if (A.seg.cases) return A.seg.cases;
    const data = await A.fetchJSON("/api/seg/cases");
    A.seg.cases = data.cases;
    A.seg.note = data.note;
    A.seg.skipped = data.skipped || [];
    return A.seg.cases;
  };

  const fetchBin = async (url, expected) => {
    const r = await fetch(A.api + url);
    if (!r.ok) throw new Error("Could not load " + url + " (" + r.status + ")");
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length !== expected) throw new Error(url + " has an unexpected size.");
    return buf;
  };

  // volumes are kept in memory (at most two cases, about 16 MB each)
  A.seg.loadVolume = async (meta) => {
    const hit = A.seg.vols.get(meta.id);
    if (hit) {
      A.seg.vols.delete(meta.id);
      A.seg.vols.set(meta.id, hit);
      return hit;
    }
    const X = meta.shape[0], Y = meta.shape[1], Z = meta.shape[2];
    const names = ["flair", "t1c", "pred", "gt"];
    const arrs = await Promise.all(names.map((k) => fetchBin(meta.base_url + "/" + k + ".bin", X * Y * Z)));
    const vol = { meta: meta, X: X, Y: Y, Z: Z };
    names.forEach((k, i) => { vol[k] = arrs[i]; });
    A.seg.vols.set(meta.id, vol);
    while (A.seg.vols.size > 2) A.seg.vols.delete(A.seg.vols.keys().next().value);
    return vol;
  };

  // start on the axial slice with the most expert-labelled tumor, centred on that slice's tumor
  A.seg.startPosition = (vol) => {
    const X = vol.X, Y = vol.Y, Z = vol.Z, gt = vol.gt;
    const perZ = new Uint32Array(Z);
    for (let x = 0; x < X; x++) {
      for (let y = 0; y < Y; y++) {
        const base = (x * Y + y) * Z;
        for (let z = 0; z < Z; z++) if (gt[base + z]) perZ[z]++;
      }
    }
    let z0 = 0;
    for (let z = 1; z < Z; z++) if (perZ[z] > perZ[z0]) z0 = z;
    let sx = 0, sy = 0, c = 0;
    for (let x = 0; x < X; x++) {
      for (let y = 0; y < Y; y++) {
        if (gt[(x * Y + y) * Z + z0]) { sx += x; sy += y; c++; }
      }
    }
    if (!c) return { x: X >> 1, y: Y >> 1, z: Z >> 1 };
    return { x: Math.round(sx / c), y: Math.round(sy / c), z: z0 };
  };
})();