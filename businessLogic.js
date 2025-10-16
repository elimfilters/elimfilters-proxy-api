// businessLogic.js

// Funciones auxiliares deben usar 'export'
export const ELIMFILTERS_PREFIXES_FINAL = {
    'ACEITE': 'EL8',   
    'AIRE': 'EA1',
    // ... (otras familias)
};

export function getElimfiltersPrefix(family) {
    // ... (lógica)
}

export function determineDutyLevel(family, specs, oemCodes, crossReference) {
    // ... (lógica)
    return 'HD' || 'LD' || 'UNKNOWN';
}

export function applyBaseCodeLogic(duty, family, oemCodes, crossReference) {
    // ... (lógica)
    // Devolver { baseCode, baseCodeSource }
}
