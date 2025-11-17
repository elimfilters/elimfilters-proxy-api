// secureKey.js
// ¡IMPORTANTE! Este archivo debe contener tus credenciales reales.

const SECURE_CONFIG = {
    // Clave Privada de la Cuenta de Servicio de Google Sheets
    // La aplicación espera esta clave para la autenticación.
    // Asegúrate de que incluya los saltos de línea ('\n')
    sheetsPrivateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY || 'PEGA_TU_CLAVE_PRIVADA_AQUI',
    
    // Email de la Cuenta de Servicio
    sheetsClientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL || 'tu-servicio-cuenta@proyecto.iam.gserviceaccount.com',

    // Puedes añadir otros secretos de la aplicación aquí
};

// Exportamos el objeto para que el sistema pueda importarlo
module.exports = SECURE_CONFIG;
