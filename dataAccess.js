// dataAccess.js (Modo Seguro - Credenciales Externas)
// Las credenciales de Google Sheets se cargan desde variables de entorno
// NO se incluyen en el código fuente

import { google } from 'googleapis';

// Inicializar cliente de Google Sheets de forma segura
let sheets = null;

async function initializeSheets() {
    if (sheets) return sheets;
    
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        sheets = google.sheets({ version: 'v4', auth });
        return sheets;
    } catch (error) {
        console.error("[INIT ERROR] No se pudo inicializar Google Sheets:", error.message);
        throw new Error('Google Sheets initialization failed. Check GOOGLE_SHEETS_CREDENTIALS environment variable.');
    }
}

// NODO 4.5: Lectura de caché (almacenamiento temporal en memoria)
const memoryCache = new Map();
const CACHE_TTL = 3600000; // 1 hora en milisegundos

export async function readFromCache(normalizedCode) {
    if (!normalizedCode) {
        throw new Error("[CACHE ERROR] Código normalizado vacío");
    }

    const cached = memoryCache.get(normalizedCode);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[NODO 4.5] ✓ Cache hit para ${normalizedCode}`);
        return cached.data;
    }
    
    if (cached) {
        memoryCache.delete(normalizedCode);
        console.log(`[NODO 4.5] Cache expirado para ${normalizedCode}`);
    }
    
    console.log(`[NODO 4.5] Cache miss para ${normalizedCode}. Consultando data maestra.`);
    return null;
}

// NODO 4.5: Escritura a data maestra + caché
export async function writeToMasterAndCache(processedData) {
    if (!processedData || !processedData.sku) {
        throw new Error("[WRITE ERROR] Datos procesados incompletos. SKU requerido.");
    }

    try {
        const sheetClient = await initializeSheets();
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const range = process.env.GOOGLE_SHEETS_RANGE || 'Master!A:H';

        // Preparar fila para insertar
        const row = [
            processedData.sku,
            processedData.family || '',
            processedData.duty_level || '',
            processedData.specs || '',
            JSON.stringify(processedData.oemCodes || []),
            JSON.stringify(processedData.crossReference || {}),
            new Date().toISOString(),
            'PROCESSED'
        ];

        // Escribir en Google Sheets
        await sheetClient.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [row]
            }
        });

        console.log(`[NODO 4.5] ✓ SKU ${processedData.sku} escrito en data maestra`);

        // Guardar en caché en memoria
        memoryCache.set(processedData.sku, {
            data: processedData,
            timestamp: Date.now()
        });

        console.log(`[NODO 4.5] ✓ SKU ${processedData.sku} guardado en caché`);

        return {
            success: true,
            sku: processedData.sku,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error(`[WRITE ERROR] Fallo al escribir SKU ${processedData.sku}:`, error.message);
        await logToErrorSheet(processedData.sku, error);
        throw error;
    }
}

// NODO 7: Logging de errores en Google Sheets
export async function logToErrorSheet(code, error) {
    if (!code) {
        console.error("[LOG ERROR] Código vacío para logging de error");
        return;
    }

    try {
        const sheetClient = await initializeSheets();
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const errorRange = process.env.GOOGLE_SHEETS_ERROR_RANGE || 'Errors!A:E';

        const errorRow = [
            code,
            error.message || String(error),
            error.stack || 'No stack trace',
            new Date().toISOString(),
            'UNRESOLVED'
        ];

        await sheetClient.spreadsheets.values.append({
            spreadsheetId,
            errorRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [errorRow]
            }
        });

        console.log(`[NODO 7] ✓ Error registrado para ${code}`);

    } catch (logError) {
        console.error(`[LOG CRITICAL] No se pudo registrar error en Google Sheets:`, logError.message);
        // Fallback: guardar en consola o archivo local si Google Sheets falla
        console.error(`[FALLBACK] Error original para ${code}:`, error.message);
    }
}

// Función auxiliar para limpiar caché expirado
export function cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of memoryCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            memoryCache.delete(key);
            cleaned++;
        }
    }
    
    console.log(`[CACHE CLEANUP] ${cleaned} entradas expiradas eliminadas`);
}

// Ejecutar limpieza cada 30 minutos
setInterval(cleanExpiredCache, 1800000);
