// ============================================================================
// ELIMFILTERS - HOMOLOGATION DATABASE v3.0
// Guarda códigos desconocidos para revisión humana.
// ============================================================================

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "data", "homologation_pending.json");

// Crear archivo si no existe
function ensureDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
    }
}

// Guardar código desconocido
async function saveUnknownCode(code) {
    ensureDB();
    const list = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

    if (!list.includes(code)) {
        list.push(code);
        fs.writeFileSync(DB_PATH, JSON.stringify(list, null, 2));
        console.log(`[HOMOLOGATION] Código almacenado → ${code}`);
    } else {
        console.log(`[HOMOLOGATION] Código ya estaba registrado → ${code}`);
    }
}

module.exports = {
    saveUnknownCode
};
