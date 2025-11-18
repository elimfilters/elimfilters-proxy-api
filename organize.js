/**
 * organize.js – Script de Organización Automática
 * ELIMFILTERS Proxy API – v4.0.0
 *
 * Corre este script UNA sola vez:
 *    node organize.js
 *
 * Reorganiza:
 *  - core/
 *  - processors/
 *  - services/
 *  - scrapers/
 *  - utils/
 *  - integrations/
 *  - validation/
 *
 * Sin borrar NINGÚN archivo.
 */

const fs = require('fs');
const path = require('path');

console.log("🚀 Iniciando reorganización de ELIMFILTERS-API…");

// ================================
// DEFINICIÓN DE CARPETAS FINALES
// ================================
const folders = {
    core: [
        'filterEngine.js',
        'businessLogic.js',
        'rulesProtection.js',
        'rulesProtection.min.js',
        'dutySectors.json',
        'familyRules.json'
    ],
    processors: [
        'filterProcessor.js'
    ],
    services: [
        'dataAccess.js',
        'googleSheetsConnector.js',
        'homologationDB.js',
        'detectionService.js'
    ],
    scrapers: [
        'donaldsonScraper.js',
        'framScraper.js',
        'scrapersUtils.js'
    ],
    utils: [
        'jsonBuilder.js',
        'secureKey.js'
    ],
    validation: [
        'validateFilterLogic.js'
    ],
    wordpress: [
        'dist-plugin' // carpeta entera
    ]
};

// ===============
// FUNCIONES
// ===============

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Creada carpeta: ${dir}`);
    }
}

function moveFile(src, dest) {
    if (fs.existsSync(src)) {
        fs.renameSync(src, dest);
        console.log(`✔ Archivo movido: ${src} → ${dest}`);
    }
}

// ================================
// CREAR ESTRUCTURA FINAL
// ================================
ensureDir('src');
ensureDir('src/core');
ensureDir('src/processors');
ensureDir('src/services');
ensureDir('src/scrapers');
ensureDir('src/utils');
ensureDir('src/validation');
ensureDir('src/integrations/wordpress');

// ================================
// MOVER ARCHIVOS
// ================================
for (const [folder, files] of Object.entries(folders)) {
    files.forEach(file => {
        const sourcePath = path.join('./', file);
        let destinationDir = '';

        if (folder === 'wordpress') {
            // mueve carpeta entera dist-plugin
            const wpSource = './dist-plugin';
            const wpDest = './src/integrations/wordpress/dist-plugin';

            if (fs.existsSync(wpSource)) {
                fs.renameSync(wpSource, wpDest);
                console.log(`📦 Carpeta WordPress movida a ${wpDest}`);
            }
            return;
        }

        destinationDir = `./src/${folder}/${file}`;
        moveFile(sourcePath, destinationDir);
    });
}

// ================================
// FINAL
// ================================
console.log("\n🎉 REORGANIZACIÓN COMPLETA");
console.log("Tu proyecto ahora está limpio, modular y listo para producción.\n");
