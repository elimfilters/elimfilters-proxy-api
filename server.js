import express from "express";
import fetch from "node-fetch";
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// Configuración de CORS para permitir peticiones desde tu dominio
const corsOptions = {
  origin: 'https://www.elimfilters.com',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Endpoint principal para dar la bienvenida
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to the ELIMFILTERS Proxy API",
    status: "active",
    usage: "Use the /search endpoint with query parameters 'q' and 'lang'. Example: /search?q=test&lang=en"
  });
});

// Endpoint público para búsqueda
app.get("/search", async (req, res) => {
  const { q, lang } = req.query;

  if (!q || !lang) {
    return res.status(400).json({
      ok: false,
      error: "Missing required query parameters: 'q' and 'lang'",
    });
  }

  try {
    const webhookURL = `https://elimfilterscross.app.n8n.cloud/webhook/ELIMFILTERS_SEARCH_MASTER?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`;
    const response = await fetch(webhookURL);
    
    if (!response.ok) {
      throw new Error(`External webhook responded with status: ${response.status}`);
    }

    const data = await response.json();

    res.status(200).json({
      ok: true,
      source: "elimfilters-proxy-api",
      results: data
    });
  } catch (error) {
    // ✅ ESTA ES LA FORMA CORRECTA: Usamos res.json() para enviar un objeto.
    // Express se encarga de convertirlo a un string JSON válido.
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`ELIMFILTERS Proxy API running on port ${PORT}`);
});
