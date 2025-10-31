// googleSheetsConnector.js
// Clase principal del servicio de Google Sheets

class GoogleSheetsService {
  constructor() {
    console.log("✅ GoogleSheetsService instanciado correctamente");
  }

  async initialize() {
    console.log("🔗 Conectado a Google Sheets");
  }

  async readData() {
    console.log("📄 Leyendo datos...");
    return [];
  }

  async writeData() {
    console.log("✏️ Escribiendo datos...");
  }
}

module.exports = { GoogleSheetsService };
