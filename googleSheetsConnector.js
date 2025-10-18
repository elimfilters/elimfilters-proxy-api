const { google } = require('googleapis');
const fs = require('fs');

let authClient = null;
let sheetsAPI = null;

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

class GoogleSheetsService {
    constructor(spreadsheetId) {
        this.spreadsheetId = spreadsheetId;
    }

    async initialize() {
        await initializeAuth();
    }

    async readRange(range) {
        try {
            await this.initialize();
            const response = await sheetsAPI.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: range,
            });
            return response.data.values || [];
        } catch (error) {
            console.error('[SHEETS] Error reading range:', error.message);
            throw error;
        }
    }

    async writeRange(range, values) {
        try {
            await this.initialize();
            const response = await sheetsAPI.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: { values },
            });
            return response.data;
        } catch (error) {
            console.error('[SHEETS] Error writing range:', error.message);
            throw error;
        }
    }

    async appendRow(range, values) {
        try {
            await this.initialize();
            const response = await sheetsAPI.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: { values: [values] },
            });
            return response.data;
        } catch (error) {
            console.error('[SHEETS] Error appending row:', error.message);
            throw error;
        }
    }

    async getAllProducts() {
        const data = await this.readRange('Products!A2:Z');
        return data.map(row => ({
            id: row[0],
            name: row[1],
            brand: row[2],
            category: row[3],
            price: parseFloat(row[4]) || 0,
            stock: parseInt(row[5]) || 0,
        }));
    }
}

module.exports = GoogleSheetsService;
