import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 8080;

// Endpoint público para búsqueda
app.get("/search", async (req, res) => {
  const { q, lang } = req.query;

  try {
    const webhookURL = `https://elimfilterscross.app.n8n.cloud/webhook/ELIMFILTERS_SEARCH_MASTER?q=${q}&lang=${lang}`;
    const response = await fetch(webhookURL);
    const data = await response.json();

    res.status(200).json({
      ok: true,
      source: "elimfilters-proxy-api",
      results: data
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`ELIMFILTERS Proxy API running on port ${PORT}`);
});
// ready for deploy
