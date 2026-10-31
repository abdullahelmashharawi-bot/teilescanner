// Teile-Scanner: verschlüsselter gemeinsamer Speicher in einem privaten GitHub-Repository.
// Alle Daten werden auf dem Handy mit dem gemeinsamen Passwort verschlüsselt (AES-256-GCM),
// bevor sie zu GitHub gehen. GitHub sieht nur Zeichensalat.
(function (root) {
  const te = new TextEncoder(), td = new TextDecoder();
  const ITER = 250000;

  const b64 = {
    enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
    dec(str) { const s = atob(str.replace(/\s/g, '')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; },
  };
  const b64url = { enc: (u8) => b64.enc(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), dec: (s) => b64.dec(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)) };

  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function gzip(u8) { if (!root.CompressionStream) return u8; return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); }
  async function gunzip(u8) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }

  // Format: "TSE1:" + base64(flag(1) | iv(12) | ciphertext)   flag 1 = gzip
  async function encrypt(key, obj) {
    let data = te.encode(JSON.stringify(obj)); let flag = 0;
    if (root.CompressionStream && data.length > 512) { data = await gzip(data); flag = 1; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    const out = new Uint8Array(1 + 12 + ct.length); out[0] = flag; out.set(iv, 1); out.set(ct, 13);
    return 'TSE1:' + b64.enc(out);
  }
  async function decrypt(key, text) {
    if (!text.startsWith('TSE1:')) throw new Error('unbekanntes Format');
    const u = b64.dec(text.slice(5));
    let data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(1, 13) }, key, u.subarray(13)));
    if (u[0] === 1) data = await gunzip(data);
    return JSON.parse(td.decode(data));
  }

  // ---------- Einladungscode: {repo, token} mit dem Passwort verschlüsselt ----------
  async function makeInvite(password, cfg) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(password, salt);
    const enc = await encrypt(key, { r: cfg.repo, t: cfg.token });
    return 'TS1.' + b64url.enc(salt) + '.' + b64url.enc(te.encode(enc));
  }
  async function readInvite(code, password) {
    const m = /^TS1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(code).replace(/\s/g, ''));
    if (!m) throw new Error('Einladungscode ist unvollständig');
    const key = await deriveKey(password, b64url.dec(m[1]));
    try { const o = await decrypt(key, td.decode(b64url.dec(m[2]))); return { repo: o.r, token: o.t }; }
    catch (e) { throw new Error('Falsches Passwort'); }
  }

  // ---------- GitHub ----------
  class Conflict extends Error {}
  class Http extends Error { constructor(status, msg) { super(msg); this.status = status; } }

  function GitHub(repo, token) {
    const base = 'https://api.github.com/repos/' + repo + '/contents/';
    const etags = {};
    async function req(path, opt = {}) {
      const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opt.headers || {}) };
      let r;
      try { r = await fetch(base + path.split('/').map(encodeURIComponent).join('/') + (opt.q || ''), { method: opt.method || 'GET', headers, body: opt.body, cache: 'no-store' }); }
      catch (e) { throw new Http(0, 'Keine Verbindung'); }
      return r;
    }
    return {
      // null = gibt es nicht, 'same' = unverändert seit letztem Abruf
      async get(path, useEtag) {
        const r = await req(path, { headers: useEtag && etags[path] ? { 'If-None-Match': etags[path] } : {}, q: '?t=' + (useEtag ? '' : Date.now()) });
        if (r.status === 304) return 'same';
        if (r.status === 404) return null;
        if (r.status === 401) throw new Http(401, 'Token ungültig oder abgelaufen');
        if (r.status === 403) throw new Http(403, 'Kein Zugriff (Token-Rechte prüfen) oder zu viele Anfragen');
        if (!r.ok) throw new Http(r.status, 'GitHub-Fehler ' + r.status);
        const j = await r.json();
        if (r.headers.get('ETag')) etags[path] = r.headers.get('ETag');
        if (Array.isArray(j)) return { list: j.map((f) => ({ name: f.name, sha: f.sha, path: f.path })) };
        let text = j.content ? new TextDecoder().decode(b64.dec(j.content)) : '';
        if (!j.content && j.download_url !== undefined && j.size > 0) { // > 1 MB
          const raw = await req(path, { headers: { Accept: 'application/vnd.github.raw+json' }, q: '?t=' + Date.now() });
          text = await raw.text();
        }
        return { text, sha: j.sha };
      },
      async put(path, text, sha, message) {
        const body = JSON.stringify({ message: message || 'Teile-Scanner', content: b64.enc(te.encode(text)), ...(sha ? { sha } : {}) });
        const r = await req(path, { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } });
        if (r.status === 409 || r.status === 422) throw new Conflict('Konflikt');
        if (r.status === 401) throw new Http(401, 'Token ungültig oder abgelaufen');
        if (r.status === 403 || r.status === 404) throw new Http(r.status, 'Keine Schreibrechte (Token: Contents → Read and write)');
        if (!r.ok) throw new Http(r.status, 'GitHub-Fehler ' + r.status);
        const j = await r.json(); delete etags[path];
        return j.content.sha;
      },
      async del(path, sha, message) {
        if (!sha) { const cur = await this.get(path); if (!cur) return; sha = cur.sha; }
        const r = await req(path, { method: 'DELETE', body: JSON.stringify({ message: message || 'Teile-Scanner', sha }), headers: { 'Content-Type': 'application/json' } });
        if (r.status === 409 || r.status === 422) { const cur = await this.get(path); if (!cur) return; return this.del(path, cur.sha, message); }
        if (!r.ok && r.status !== 404) throw new Http(r.status, 'GitHub-Fehler ' + r.status);
        delete etags[path];
      },
    };
  }

  // ---------- Verbindung: Passwort prüfen / Speicher anlegen ----------
  async function connect(cfg, password, { create } = {}) {
    const gh = GitHub(cfg.repo, cfg.token);
    let meta = await gh.get('meta.json');
    if (!meta) {
      if (!create) throw new Error('Im Speicher ist noch nichts eingerichtet');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(password, salt);
      const m = { v: 1, app: 'teilescanner', salt: b64.enc(salt), check: await encrypt(key, { ok: 'teilescanner' }) };
      await gh.put('meta.json', JSON.stringify(m, null, 1), null, 'Teile-Scanner eingerichtet');
      return { gh, key };
    }
    const m = JSON.parse(meta.text);
    const key = await deriveKey(password, b64.dec(m.salt));
    try { const c = await decrypt(key, m.check); if (c.ok !== 'teilescanner') throw 0; }
    catch (e) { throw new Error('Falsches Passwort'); }
    return { gh, key };
  }

  // Datei lesen (entschlüsselt). Ergebnis: {data, sha} | null | 'same'
  async function readFile(conn, path, useEtag) {
    const r = await conn.gh.get(path, useEtag);
    if (!r || r === 'same') return r;
    return { data: await decrypt(conn.key, r.text), sha: r.sha };
  }
  // Datei schreiben mit Konfliktlösung: bei Konflikt neu laden, merge(remote, local) und erneut
  async function writeFile(conn, path, data, sha, merge, message) {
    for (let attempt = 0; attempt < 6; attempt++) {
      try { const nsha = await conn.gh.put(path, await encrypt(conn.key, data), sha, message); return { data, sha: nsha }; }
      catch (e) {
        if (!(e instanceof Conflict)) throw e;
        const cur = await readFile(conn, path, false);
        sha = cur && cur.sha;
        if (cur && merge) data = merge(cur.data, data);
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 600));
      }
    }
    throw new Error('Speichern fehlgeschlagen (zu viele gleichzeitige Änderungen)');
  }
  async function deleteFile(conn, path, sha) { return conn.gh.del(path, sha, 'gelöscht'); }
  async function listDir(conn, path, useEtag) { const r = await conn.gh.get(path, useEtag); if (!r || r === 'same') return r; return r.list || []; }

  root.Sync = { makeInvite, readInvite, connect, readFile, writeFile, listDir, deleteFile, Conflict, Http };
})(typeof self !== 'undefined' ? self : this);
