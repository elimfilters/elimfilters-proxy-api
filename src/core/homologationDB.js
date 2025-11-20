// ============================================================================
// ELIMFILTERS — HOMOLOGATION DB v3.0
// Registra códigos desconocidos y equivalencias múltiples para auditoría.
// ============================================================================

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../../data/homologation_unknown.json");
const MULTI_PATH = path.join(__dirname, "../../data/homologation_multi.json");

// Crear archivos si no existen
function ensureFiles() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(MULTI_PATH)) {
        fs.writeFileSync(MULTI_PATH, JSON.stringify([], null, 2));
    }
}

ensureFiles();

// Registrar OEM/CROSS no encontrado
function saveUnknownCode(code) {
    try {
        const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
        if (!db.includes(code)) {
            db.push(code);
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        }
        return true;
    } catch (err) {
        console.error("❌ Error guardando código desconocido:", err);
        return false;
    }
}

// Registrar equivalencias múltiples generadas (multi-SKU)
function saveMultiEquivalence(oemCode, generatedList) {
    try {
        const db = JSON.parse(fs.readFileSync(MULTI_PATH, "utf8"));

        db.push({
            timestamp: new Date().toISOString(),
            oem: oemCode,
            generated: generatedList
        });

        fs.writeFileSync(MULTI_PATH, JSON.stringify(db, null, 2));
        return true;
    } catch (err) {
        console.error("❌ Error guardando multi-equivalencia:", err);
        return false;
    }
}

// Obtener multi-equivalencias (depuración)
function loadMulti() {
    try {
        return JSON.parse(fs.readFileSync(MULTI_PATH, "utf8"));
    } catch {
        return [];
    }
}

module.exports = {
    saveUnknownCode,
    saveMultiEquivalence,
    loadMulti
};
