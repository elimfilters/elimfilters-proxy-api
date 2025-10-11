const qs = new URLSearchParams({ q: q || "", lang: lang || "es" }).toString();
const webhookURL = `https://elimfilterscross.app.n8n.cloud/webhook/ELIMFILTERS_SEARCH_MASTER?${qs}`;

const resp = await fetch(webhookURL, { timeout: 15000 });
const text = await resp.text();

let data;
try {
  data = text ? JSON.parse(text) : { ok: false, results: [], message: "Empty response from n8n" };
} catch (e) {
  data = { ok: false, results: [], message: "Bad JSON from n8n", raw: text };
}

res.status(resp.ok ? 200 : 502).json(data);
