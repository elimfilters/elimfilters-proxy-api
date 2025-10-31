async function start() {
  try {
    console.log("Inicializando Google Sheets...");
    const instance = await GoogleSheetsConnector.create();
    console.log("Instancia creada con éxito.");
    sheetsProxy.setInstance(instance);
    console.log("Instancia registrada en proxy.");

    app.get('/health', async (req, res) => {
      try {
        await sheetsProxy.ping();
        res.status(200).json({ status: 'ok' });
      } catch (err) {
        console.error('Fallo en ping:', err);
        res.status(500).json({ status: 'error', error: err.message });
      }
    });

    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  } catch (err) {
    console.error('Fallo al iniciar el servidor:', err);
    process.exit(1);
  }
}
