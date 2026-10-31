// Teile-Scanner: Nummern normalisieren und OCR-Text mit der Liste abgleichen.
(function (root) {
  // Zeichen, die OCR gern verwechselt, auf eine gemeinsame Form bringen
  const FUZZY = { O: '0', Q: '0', D: '0', I: '1', L: '1', J: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };

  function norm(s) {
    return String(s || '').toUpperCase().replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Ü/g, 'U').replace(/[^A-Z0-9]/g, '');
  }
  function fuzzy(s) {
    return norm(s).replace(/[OQDILJZSBGT]/g, (c) => FUZZY[c]);
  }
  const hasDigit = (s) => /[0-9]/.test(s);

  // Alle Schreibweisen, unter denen eine Listennummer auf dem Karton stehen kann.
  // z. B. "FE26100" -> FE26100, 26100 ; "PUR-PO0000" -> PURPO0000, PO0000 ; "673310-LS" -> 673310LS, 673310
  function variants(raw) {
    const out = new Set();
    const n = norm(raw);
    if (n.length >= 3) out.add(n);
    // Marken-Kürzel vorne abschneiden (FE, LS, MD, EL, LP, VAL, GSK, OSR ...)
    const m = n.match(/^([A-Z]{1,4})([0-9].*)$/);
    if (m && m[2].length >= 4) out.add(m[2]);
    // Teile, die durch Leerzeichen/Bindestrich getrennt sind
    const parts = String(raw).toUpperCase().split(/[\s\-\/]+/).map(norm).filter(Boolean);
    if (parts.length > 1) {
      for (const p of parts) if (p.length >= 5 && hasDigit(p)) {
        out.add(p);
        const mm = p.match(/^([A-Z]{1,4})([0-9].*)$/);
        if (mm && mm[2].length >= 5) out.add(mm[2]);
      }
    }
    return [...out].filter((v) => hasDigit(v) && v.length >= 4 && !/^(.)\1+$/.test(v));
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  // Index aus der Liste bauen: fuzzy-Variante -> Einträge
  function buildIndex(items, keep) {
    const idx = [];
    items.forEach((it, i) => {
      if (keep && !keep(it, i)) return;
      for (const v of variants(it.nummer)) idx.push({ v: fuzzy(v), len: v.length, i });
    });
    return idx;
  }

  // Kandidaten-Strings aus dem OCR-Text: einzelne Wörter + bis zu 4 benachbarte zusammengefügt
  function candidates(text) {
    const out = new Set();
    for (const line of String(text).split(/\n+/)) {
      const toks = line.split(/\s+/).map(norm).filter(Boolean);
      for (let i = 0; i < toks.length; i++) {
        let s = '';
        for (let k = i; k < Math.min(toks.length, i + 4); k++) {
          s += toks[k];
          if (s.length >= 4 && s.length <= 20) out.add(s);
        }
      }
    }
    return [...out];
  }

  // Liefert Treffer sortiert nach Sicherheit: [{i, score, exact}]
  function match(text, index) {
    const cands = candidates(text).map((c) => ({ raw: c, f: fuzzy(c) }));
    const best = new Map();
    let cur = '';
    const put = (i, score, exact) => {
      const o = best.get(i);
      if (!o || o.score < score) best.set(i, { i, score, exact, cand: cur });
    };
    for (const c of cands) {
      cur = c.raw;
      for (const e of index) {
        if (c.f === e.v) { put(e.i, 100 + e.len * 2, true); continue; }
        // Nummer steckt in einem längeren Wort, z. B. "NO.26100" -> "NO26100"
        if (e.len >= 5 && c.f.length > e.v.length && (c.f.endsWith(e.v) || c.f.startsWith(e.v))) {
          // Nummern nicht aus längeren Zahlen herausschneiden (z. B. aus dem Barcode)
          const adj = c.f.endsWith(e.v) ? c.raw[c.raw.length - e.v.length - 1] : c.raw[e.v.length];
          if (!/[0-9]/.test(adj)) { put(e.i, 80 + e.len, false); continue; }
        }
        // Ein Zeichen falsch gelesen / zu viel / zu wenig
        if (e.len >= 6 && lev(c.f, e.v, 1) <= 1) put(e.i, 60 + e.len, false);
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score);
  }

  // Barcode (EAN) -> Eintrag. Febi: 4027816 + Artikelnummer + Prüfziffer
  function matchBarcode(code, items, learned, keep) {
    const hits = [];
    const ok = (i) => !keep || keep(items[i], i);
    const c = norm(code);
    if (learned && learned[c]) {
      const k = learned[c];
      items.forEach((it, i) => { if (ok(i) && norm(it.nummer) === k) hits.push({ i, score: 200, exact: true }); });
      if (hits.length) return hits;
    }
    if (/^[0-9]{13}$/.test(c)) {
      items.forEach((it, i) => {
        if (!ok(i)) return;
        for (const v of variants(it.nummer)) {
          if (/^[0-9]{5,6}$/.test(v) && c.slice(12 - v.length, 12) === v && c.startsWith('4027816')) hits.push({ i, score: 150, exact: true });
        }
      });
    }
    return hits;
  }

  const api = { norm, fuzzy, variants, buildIndex, match, matchBarcode, candidates };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Matcher = api;
})(typeof self !== 'undefined' ? self : this);
