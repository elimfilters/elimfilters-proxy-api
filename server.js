// ===============================
// ADAPTADOR: GET /api/search (Para WordPress)
// ===============================
app.get('/api/search', async (req, res) => {
  // Mapeamos el parámetro 'q' de la URL de WordPress al formato esperado por el handler interno.
  req.query.query = req.query.q; 
  
  const candidate = 
    (req.body && (req.body.code || req.body.sku || req.body.oem || req.body.query)) ||
    (req.query && (req.query.code || req.query.sku || req.query.oem || req.query.query)) ||
    '';
    
  const normalized = String(candidate || '').trim().toUpperCase();

  if (!normalized) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'Falta código de búsqueda (query vacío)',
      success: false,
    });
  }
  
  try {
    const result = await processFilterCode(normalized);

    // DEVOLVEMOS UN OBJETO QUE EL JAVASCRIPT DE WORDPRESS ESPERA
    return res.status(200).json({
      status: 'OK',
      success: true, 
      data: result,
    });
  } catch (err) {
    console.error('[ADAPTER] ERROR:', err);
    return res.status(500).json({
      status: 'ERROR',
      success: false,
      message: 'Fallo interno en la búsqueda',
      details: err.message || null,
    });
  }
});
