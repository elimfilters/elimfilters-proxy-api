class GoogleSheetsService {
  // ... demás métodos ya presentes ...

  // Asegura que existe y devuelve el objeto JSON correcto desde la variable de entorno
  static parseCredentials(creds) {
    if (!creds) {
      throw new Error('No credentials provided to parseCredentials');
    }
    // Si viene como cadena, intenta parsearla (tiene que ser JSON válido)
    if (typeof creds === 'string') {
      try {
        // manejar nuevas líneas escapadas (Railway/ENV a veces guarda \n)
        const cleaned = creds.replace(/\\n/g, '\n');
        return JSON.parse(cleaned);
      } catch (err) {
        throw new Error('Invalid GOOGLE_CREDENTIALS JSON: ' + err.message);
      }
    }
    // si ya es objeto
    return creds;
  }

  // ejemplo de helper que use parseCredentials (si lo necesitas)
  static initializeAuthFromEnv() {
    const raw = process.env.GOOGLE_CREDENTIALS;
    const creds = GoogleSheetsService.parseCredentials(raw);
    // ... aquí inicializas auth con creds (JWT / googleapis etc) ...
    return creds;
  }
}
