// secureKey.js - Usando CommonJS (compatible con 'require')

/**
 * Este módulo exporta las claves de servicio y secretos necesarios 
 * para la aplicación.
 */

// NOTA IMPORTANTE: Reemplaza los valores 'RELLENA_AQUI' con tus credenciales reales.
// La clave privada debe incluir los saltos de línea ('\n') o ser un solo string largo.

const SECURE_CONFIG = {
    // 1. Clave Privada de la Cuenta de Servicio de Google Sheets
    // Debe ser un string largo con los BEGIN/END KEY y saltos de línea.
    sheetsPrivateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY || 'RELLENA_AQUI_PRIVATE_KEY',
    
    // 2. Email de la Cuenta de Servicio de Google Sheets
    sheetsClientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL || 'RELLENA_AQUI_CLIENT_EMAIL@mi-proyecto.iam.gserviceaccount.com',

    // 3. Otros secretos, si los hay
    databasePassword: process.env.DB_PASSWORD || 'RELLENA_AQUI_DB_PASS'
};

// Exportamos el objeto de configuración
module.exports = SECURE_CONFIG;
