class GoogleSheetsService {
  async initialize() {
    console.log("✅ Google Sheets conectado correctamente");
  }

  async readData() {
    return [];
  }

  async writeData() {
    console.log("📄 Escribiendo datos en Google Sheets...");
  }
}

module.exports = GoogleSheetsService;
