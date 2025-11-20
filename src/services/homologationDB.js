// ============================================================================
// ELIMFILTERS — HOMOLOGATION DB v3.0
// Registra códigos desconocidos para validación posterior
// ============================================================================

const fs = require("fs");
const path = require("path");

const HOMOLOGATION_FILE = path.join(__dirname, "..", "..", "data", "unknown_codes.json");

// Asegurar que el archivo exista
function ensureFile() {
    if (!fs.existsSync(path.dirname(HOMOLOGATION_FILE))) {
        fs.mkdirSync(path.dirname(HOMOLOGATION_FILE), { recursive: true });
    }
    if (!fs.existsSync(HOMOLOGATION_FILE)) {
        fs.writeFileSync(HOMOLOGATION_FILE, JSON.stringify({ entries: [] }, null, 2));
    }
}

// Registrar código OEM desconocido
async function saveUnknownCode(code) {
    try {
        ensureFile();
        const raw = fs.readFileSync(HOMOLOGATION_FILE, "utf8");
        const json = JSON.parse(raw);

        // Evitar duplicados
        if (!json.entries.includes(code)) {
            json.entries.push(code);
        }

        fs.writeFileSync(HOMOLOGATION_FILE, JSON.stringify(json, null, 2));
        return true;
    } catch (e) {
        console.error("❌ Error guardando unknown code:", e.message);
        return false;
    }
}

module.exports = {
    saveUnknownCode
};
