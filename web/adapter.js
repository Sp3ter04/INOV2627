/* INOV2627 · camada de dados para a versão web (Vercel + Supabase).
   Imita a API window.claude.use("db"|"user") do artifact do Claude, para o mesmo
   código da app correr nos dois sítios. Todos os documentos ficam na tabela
   public.docs (col, id, data). As permissões são decididas no Supabase (RLS):
   - qualquer pessoa lê ideias, sessões, live, fotos, config e feedback, e escreve
     ideias e feedback (painel do júri);
   - só quem tem o código de coordenador (cabeçalho x-inov-code) lê e escreve o resto. */
(function(){
  "use strict";
  const SB = "https://hggrgaktnacmmgmaoeib.supabase.co";
  const KEY = "sb_publishable_em1gUMD7EQjI8n1hCE18tQ_DSy-eAsR";
  const LS_CODE = "inov-coord-code";
  /* Rotas: "/" e "/juri" = painel do júri; "/coordenador" = área do coordenador (com código).
     "/coordenador/juri" ou "#juri" mostram o júri também ao coordenador. */
  const isCoordPath = () => /^\/coordenador(\/|$)/.test(location.pathname);
  const isJuri = () => location.hash === "#juri" || /\/juri\/?$/.test(location.pathname) || !isCoordPath();
  window.INOV_ISJURI = isJuri;
  window.INOV_JURI_URL = location.origin + "/juri";
  const getCode = () => { try { return localStorage.getItem(LS_CODE) || ""; } catch (e) { return ""; } };

  function headers(extra){
    const h = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
    const c = getCode(); if (c) h["x-inov-code"] = c;
    return Object.assign(h, extra || {});
  }
  async function req(path, opts){
    const r = await fetch(SB + "/rest/v1/" + path, Object.assign({ headers: headers(opts && opts.h) }, opts));
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      const e = new Error(t || r.statusText);
      e.code = r.status === 401 || r.status === 403 ? "permission-denied" : "http-" + r.status;
      throw e;
    }
    return r.status === 204 ? null : r.json().catch(() => null);
  }
  const enc = encodeURIComponent;

  /* ---------- db ---------- */
  const POLL = { sugestoes: 8000, materiais: 10000, live: 3000, ideias: 4000, feedback: 4000, sessoes: 6000, config: 15000, fotos: 120000 };
  const subs = new Map(); // col -> Set of {id|null, cb, last}
  function snapCol(rows){ return { docs: rows.map(r => ({ id: r.id, data: () => r.data })) }; }
  async function fetchCol(col){ return await req("docs?select=id,data&col=eq." + enc(col)) || []; }
  async function poke(col){
    const set = subs.get(col); if (!set || !set.size) return;
    let rows; try { rows = await fetchCol(col); } catch (e) { set.forEach(s => s.eb && s.eb(e)); return; }
    set.forEach(s => {
      const payload = s.id == null ? rows : rows.filter(r => r.id === s.id);
      const sig = JSON.stringify(payload);
      if (sig === s.last) return; s.last = sig;
      try {
        if (s.id == null) s.cb(snapCol(rows));
        else { const r = payload[0]; s.cb(r ? { exists: true, data: () => r.data } : { exists: false, data: () => null }); }
      } catch (e) { console.error(e); }
    });
  }
  const timers = new Map();
  function subscribe(col, id, cb, eb){
    if (!subs.has(col)) subs.set(col, new Set());
    const s = { id, cb, eb, last: null }; subs.get(col).add(s);
    if (!timers.has(col)) timers.set(col, setInterval(() => { if (!document.hidden) poke(col); }, POLL[col] || 10000));
    poke(col);
    return () => { const set = subs.get(col); if (set) set.delete(s); };
  }
  function collection(col){
    return {
      onSnapshot(cb, eb){ return subscribe(col, null, cb, eb); },
      async get(){ return snapCol(await fetchCol(col)); },
      doc(id){
        return {
          onSnapshot(cb, eb){ return subscribe(col, id, cb, eb); },
          async get(){ const rows = await req("docs?select=id,data&col=eq." + enc(col) + "&id=eq." + enc(id)) || []; const r = rows[0]; return r ? { exists: true, data: () => r.data } : { exists: false, data: () => null }; },
          async set(o){
            await req("docs?on_conflict=col,id", { method: "POST", h: { Prefer: "resolution=merge-duplicates,return=minimal" },
              body: JSON.stringify({ col, id, data: o, updated_at: new Date().toISOString() }) });
            setTimeout(() => poke(col), 50);
          },
          async delete(){
            await req("docs?col=eq." + enc(col) + "&id=eq." + enc(id), { method: "DELETE", h: { Prefer: "return=minimal" } });
            setTimeout(() => poke(col), 50);
          }
        };
      }
    };
  }
  const db = Object.freeze({ collection });

  /* ---------- ficheiros dos membros (Supabase Storage, bucket "materiais") ---------- */
  window.INOV_FILE = async function(path){
    const w = window.open("about:blank", "_blank");
    const h = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
    const c = getCode(); if (c) h["x-inov-code"] = c;
    const r = await fetch(SB + "/storage/v1/object/sign/materiais/" + String(path).split("/").map(enc).join("/"), { method: "POST", headers: h, body: JSON.stringify({ expiresIn: 600 }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.signedURL) { if (w) w.close(); throw new Error("sem acesso"); }
    const url = SB + "/storage/v1" + j.signedURL;
    if (w) w.location.href = url; else location.href = url;
  };

  /* ---------- coordenador ---------- */
  let coordP = null;
  function checkCoord(){
    if (!getCode()) return Promise.resolve(false);
    if (!coordP) coordP = req("rpc/inov_coord", { method: "POST", body: "{}" }).then(v => v === true).catch(() => false);
    return coordP;
  }
  function anonId(){
    try { let v = localStorage.getItem("inov-anon-id"); if (!v) { v = "w_" + Math.random().toString(36).slice(2, 12); localStorage.setItem("inov-anon-id", v); } return v; }
    catch (e) { return "w_anon"; }
  }
  const user = Object.freeze({
    async me(){ const own = await checkCoord(); return { isOwner: own, email: "", name: own ? "Vitor Clara" : "", id: anonId() }; },
    async isOwner(){ return checkCoord(); },
    async canEdit(){ return (await checkCoord()) || isJuri(); },
    async can(){ return true; },
    async id(){ return anonId(); }
  });

  window.claude = Object.freeze({
    use: async name => name === "db" ? db : name === "user" ? user : null
  });

  /* ---------- ecrã de entrada do coordenador (só na raiz) ---------- */
  window.INOV_GATE = function(){
    return `<div class="card" style="max-width:420px;margin:60px auto">
      <div class="eyebrow">Inovação 26/27 · JUNITEC</div><h1>Área do coordenador</h1>
      <p class="note" style="margin:0">Escreve o código de coordenador. Se és júri ou membro, usa o painel do júri.</p>
      <form id="inov-login" class="row" autocomplete="off" style="flex-wrap:nowrap">
        <input class="field" id="inov-code" type="password" required placeholder="Código" aria-label="Código de coordenador">
        <button class="btn pri" type="submit">Entrar</button></form>
      <p id="inov-login-err" class="note" style="color:var(--bad);margin:0" hidden>Código errado.</p>
      <a class="btn" href="/juri">Ir para o painel do júri →</a></div>`;
  };
  document.addEventListener("submit", async e => {
    if (e.target.id !== "inov-login") return;
    e.preventDefault(); e.stopImmediatePropagation();
    const v = document.getElementById("inov-code").value.trim(); if (!v) return;
    try { localStorage.setItem(LS_CODE, v); } catch (err) {}
    coordP = null;
    if (await checkCoord()) location.reload();
    else { try { localStorage.removeItem(LS_CODE); } catch (err) {} coordP = null; document.getElementById("inov-login-err").hidden = false; }
  }, true);

  /* ---------- cópias de segurança (Definições, só coordenador) ---------- */
  window.INOV_TOOLS = function(){
    return `<div class="card" style="margin-bottom:14px"><div class="card-h"><h2>Cópia de segurança (versão web)</h2>
      <button type="button" class="btn sm ghost" id="inov-logout">Sair do modo coordenador</button></div>
      <p class="note" style="margin:0">Descarrega tudo num ficheiro JSON, ou repõe a partir de um ficheiro (os documentos com o mesmo id são substituídos).</p>
      <div class="row"><button type="button" class="btn" id="inov-export">Descarregar cópia (JSON)</button>
      <label class="btn">Repor a partir de ficheiro<input type="file" id="inov-import" accept="application/json,.json" hidden></label>
      <span class="note" id="inov-io-msg"></span></div></div>`;
  };
  document.addEventListener("click", async e => {
    const t = e.target.closest && e.target.closest("#inov-export,#inov-logout"); if (!t) return;
    if (t.id === "inov-logout") { try { localStorage.removeItem(LS_CODE); } catch (err) {} location.href = "/coordenador"; return; }
    const rows = await req("docs?select=col,id,data&order=col,id&limit=10000");
    const blob = new Blob([JSON.stringify({ app: "INOV2627", exportedAt: new Date().toISOString(), docs: rows }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "inov2627-copia-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
  });
  document.addEventListener("change", async e => {
    if (e.target.id !== "inov-import" || !e.target.files[0]) return;
    const msg = document.getElementById("inov-io-msg");
    try {
      const j = JSON.parse(await e.target.files[0].text());
      const docs = (j.docs || []).filter(d => d && d.col && d.id && d.data && typeof d.data === "object");
      for (let i = 0; i < docs.length; i += 100) {
        msg.textContent = "A repor " + Math.min(i + 100, docs.length) + " de " + docs.length + "…";
        await req("docs?on_conflict=col,id", { method: "POST", h: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(docs.slice(i, i + 100).map(d => ({ col: d.col, id: String(d.id), data: d.data }))) });
      }
      msg.textContent = docs.length + " documentos repostos. A recarregar…"; setTimeout(() => location.reload(), 900);
    } catch (err) { msg.textContent = "Não foi possível repor: " + (err.message || err); }
  });
})();
