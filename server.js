import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;

// URL base del webhook de n8n
const N8N_WEBHOOK_URL = "https://elimfilterscross.app.n8n.cloud/webhook/ELIMFILTERS_SEARCH_MASTER";
const TIMEOUT_MS = 15000;

app.use(cors());
app.use(express.json());

app.get("/partsearch", async (req, res) => {
  const { q, lang } = req.query;

  if (!q) {
    return res.status(400).json({
      ok: false,
      message: "Missing query parameter 'q'",
      error: "MISSING_QUERY",
    });
  }

  try {
    const qs = new URLSearchParams({ q, lang: lang || "es" }).toString();
    const webhookURL = `${N8N_WEBHOOK_URL}?${qs}`;

    const resp = await fetch(webhookURL, { timeout: TIMEOUT_MS });
    const text = await resp.text();

    let data;
    try {
      data = text ? JSON.parse(text) : { ok: false, results: [], message: "Empty response from n8n" };
    } catch (e) {
      data = { ok: false, results: [], message: "Bad JSON from n8n", raw: text };
    }

    res.status(resp.ok ? 200 : 502).json(data);
  } catch (err) {
    console.error("❌ Error calling n8n webhook:", err);
    res.status(500).json({
      ok: false,
      message: "Internal server error",
      error: "INTERNAL_ERROR",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ ELIMFILTERS Proxy API running on port ${PORT}`);
  console.log(`🔗 Endpoint: https://api.elimfilters.com/partsearch`);
});
