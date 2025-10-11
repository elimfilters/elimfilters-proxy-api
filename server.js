import express from "express";
import fetch from "node-fetch";
import cors from 'cors'; // <-- LÍNEA AÑADIDA 1: Importamos cors

const app = express();
const PORT = process.env.PORT || 8080;

// <-- LÍNEA AÑADIDA 2: Configuramos y usamos cors
// Esto permite que tu página web (www.elimfilters.com) pueda hacer peticiones a esta API
const corsOptions = {
  origin: 'https://www.elimfilters.com', // Tu dominio de producción
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// ----------------------------------------------------

// Endpoint principal para dar la bienvenida y explicar el uso de la API
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
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`ELIMFILTERS Proxy API running on port ${PORT}`);
});
