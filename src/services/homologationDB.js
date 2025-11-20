// ============================================================================
// ELIMFILTERS — HOMOLOGATION DB v3.0
// Registra códigos desconocidos para revisión manual.
// ============================================================================

const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "../../data/homologation_unknown.json");

// Crear archivo si no existe
function ensureFile() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ pending: [] }, null, 2));
    }
}

function loadDB() {
    ensureFile();
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Registrar código desconocido
async function saveUnknownCode(code) {
    ensureFile();
    const db = loadDB();

    const normalized = String(code).trim().toUpperCase();

    // evitar duplicados
    if (!db.pending.includes(normalized)) {
        db.pending.push(normalized);
        saveDB(db);
        console.log(`📥 [HOMOLOGATION] Guardado para revisión → ${normalized}`);
    }
}

// Obtener lista
function getPending() {
    const db = loadDB();
    return db.pending || [];
}

module.exports = {
    saveUnknownCode,
    getPending
};
