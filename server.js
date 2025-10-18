// server.js — proxy con diagnóstico y forzado
import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());

const PATH = "elimfilters-search";

// Lee env y normaliza: acepta BASE (/webhook) o FULL (/webhook/.../elimfilters-search)
const norm = (u) => (u || "").replace(/\/$/, "");
const P_BASE = norm(process.env.N8N_URL_PRIMARY || "https://elimfilterscross.app.n8n.cloud/webhook");
const F_BASE = norm(process.env.N8N_URL_FALLBACK || "https://elimfilterscross.app.n8n.cloud/webhook-test");
const FORCE = norm(process.env.N8N_FORCE_URL || ""); // si pones aquí FULL o BASE, se usa esa

const toFull = (u, path = PATH) => u.endsWith(path) ? u : `${u}/${path}`;

async function probe(url) {
  // intenta HEAD y luego POST vacío; acepta 2xx
  try {
    const h = await axios.head(url, { timeout: 4000, validateStatus: s => s >= 200 && s < 300 });
    return { ok: true, via: "HEAD", status: h.status };
  } catch {}
  try {
    const p = await axios.post(url, {}, {
      timeout: 6000,
      headers: { "Content-Type": "application/json" },
      validateStatus: s => s >= 200 && s < 300
    });
    // filtra HTML 404 de n8n
    if (typeof p.data === "string" && p.data.trim().startsWith("<!DOCTYPE html")) {
      return { ok: false, via: "POST_HTML_404", status: p.status };
    }
    return { ok: true, via: "POST", status: p.status };
  } catch (e) {
    return { ok: false, via: "ERR", status: e?.response?.status || 0, err: String(e.message || e) };
  }
}

async function chooseLiveUrl(path = PATH) {
  // 1) Forzado por env
  if (FORCE) {
    const full = toFull(FORCE, path);
    const pr = await probe(full);
    return { url: full, probe: pr, forced: true };
  }
  // 2) Prod → Test
  const candidates = [toFull(P_BASE, path), toFull(F_BASE, path)];
  for (const u of candidates) {
    const pr = await probe(u);
    if (pr.ok) return { url: u, probe: pr, forced: false };
  }
  // 3) Devuelve último probe para diagnóstico
  return { url: candidates[candidates.length - 1], probe: { ok: false }, forced: false };
}

async function callN8N(payload, path = PATH) {
  const pick = await chooseLiveUrl(path);
  if (!pick.probe.ok) {
    const diag = await diagSummary();
    const err = { error: true, message: "n8n unavailable", pick, diag };
    const e = new Error(JSON.stringify(err));
    e.code = "N8N_UNAVAILABLE";
    throw e;
  }
  const r = await axios.post(pick.url, payload, {
    timeout: 20000,
    headers: { "Content-Type": "application/json" },
    validateStatus: s => s >= 200 && s < 300
  });
  if (typeof r.data === "string" && r.data.trim().startsWith("<!DOCTYPE html")) {
    const e = new Error("N8N_HTML_404");
    e.code = "N8N_HTML_404";
    throw e;
  }
  return r.data;
}

// ENDPOINTS
app.get("/health", async (_req, res) => {
  res.json({ status: "healthy", uptime: process.uptime(), ts: new Date().toISOString() });
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: true, message: "q is required" });
  try {
    const data = await callN8N({ q });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: true, message: "n8n workflow error", code: e.code || "ERR", details: e.message });
  }
});

app.all("/n8n/:path", async (req, res) => {
  const segment = req.params.path || PATH;
  const body = ["GET","HEAD"].includes(req.method) ? undefined : req.body;
  try {
    const pick = await chooseLiveUrl(segment);
    if (!pick.probe.ok) return res.status(502).json({ error:true, message:"n8n unavailable", pick });
    const r = await axios({
      method: req.method,
      url: pick.url,
      data: body,
      headers: { "Content-Type": "application/json" },
      timeout: 20000,
      validateStatus: s => s >= 200 && s < 300
    });
    return res.status(r.status).send(r.data);
  } catch (e) {
    return res.status(502).json({ error:true, message:"n8n unavailable", err:String(e.message||e) });
  }
});

// Diagnóstico en vivo
async function diagSummary() {
  const fullP = toFull(P_BASE), fullF = toFull(F_BASE);
  const prP = await probe(fullP);
  const prF = await probe(fullF);
  return {
    primary: { url: fullP, ...prP },
    fallback:{ url: fullF, ...prF },
    forced: FORCE || null
  };
}

app.get("/diag", async (_req, res) => {
  const diag = await diagSummary();
  res.json(diag);
});

app.get("/", (_req, res) => res.json({
  message: "ELIMFILTERS PROXY ACTIVE",
  endpoints: ["GET /health","GET /diag","GET /api/search?q={code}","ALL /n8n/:path"]
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 ELIMFILTERS PROXY on", PORT));
