// security.js — Control de acceso para ELIMFILTERS Proxy API
// ==========================================================

/**
 * Verifica la API Key interna enviada por WordPress u otro sistema autorizado.
 * La clave se define en las variables de entorno de Railway: INTERNAL_API_KEY
 * El cliente debe enviar el header:
 *    x-api-key: <clave>
 */

function verifyKey(req, res, next) {
  const key = req.headers['x-api-key'];

  // Si la clave no existe
  if (!key) {
    return res.status(401).json({
      error: 'Acceso denegado: falta API Key',
    });
  }

  // Si la clave no coincide
  if (key !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({
      error: 'Acceso denegado: API Key inválida',
    });
  }

  // Pasa al siguiente middleware o endpoint
  next();
}

module.exports = { verifyKey };
