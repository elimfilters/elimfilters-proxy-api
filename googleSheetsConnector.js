async function initializeAuth() {
    if (authClient) return authClient;

    try {
        let credentials;

        // Opción 1: Base64 desde variable de entorno
        const credsBase64 = process.env.GOOGLE_SHEETS_CREDS_BASE64;
        if (credsBase64) {
            credentials = JSON.parse(Buffer.from(credsBase64, 'base64').toString());
        }
        // Opción 2: JSON directo
        else if (process.env.GOOGLE_CREDENTIALS) {
            credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        }
        // Opción 3: Archivo local (desarrollo)
        else if (process.env.GOOGLE_SHEETS_CREDS_PATH) {
            credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_SHEETS_CREDS_PATH, 'utf8'));
        }
        else {
            throw new Error('No credentials found. Set GOOGLE_SHEETS_CREDS_BASE64, GOOGLE_CREDENTIALS, or GOOGLE_SHEETS_CREDS_PATH');
        }

        authClient = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key,
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        sheetsAPI = google.sheets({ version: 'v4', auth: authClient });
        console.log('[SHEETS] ✓ Autenticación inicializada correctamente');
        return authClient;

    } catch (error) {
        console.error('[SHEETS] ✗ Error inicializando autenticación:', error.message);
        throw error;
    }
}
