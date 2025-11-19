// ============================================================================
// ELIMFILTERS — HOMOLOGATION DB v3.0
// Registro de códigos desconocidos para análisis posterior
// ============================================================================

const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "../../data/homologation_unknown.json");

// Asegurar archivo inicial
function ensureFile() {
    if (!fs.existsSync(FILE_PATH)) {
        fs.writeFileSync(FILE_PATH, JSON.stringify({ unknown: [] }, null, 2));
    }
}

// Registrar código desconocido sin duplicarlo
function saveUnknownCode(code) {
    ensureFile();

    const raw = fs.readFileSync(FILE_PATH, "utf8");
    const json = JSON.parse(raw);

    const normalized = String(code).toUpperCase().trim();

    if (!json.unknown.includes(normalized)) {
        json.unknown.push(normalized);
        fs.writeFileSync(FILE_PATH, JSON.stringify(json, null, 2));
        console.log("📩 Registrado en homologación:", normalized);
    } else {
        console.log("⚠️ Ya estaba registrado:", normalized);
    }

    return true;
}

// Listar desconocidos
function listUnknownCodes() {
    ensureFile();
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    const json = JSON.parse(raw);
    return json.unknown || [];
}

module.exports = {
    saveUnknownCode,
    listUnknownCodes
};
