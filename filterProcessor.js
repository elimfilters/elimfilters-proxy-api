// filterProcessor.js v4.0.0 - LIMPIO DE DEPENDENCIAS FALLIDAS

/**
 * Este archivo existe únicamente para compatibilidad con el flujo antiguo
 * de su servidor. El servidor ya no debe depender de él para la lógica.
 */

async function processFilterCode(inputCode) {
    console.error("❌ ERROR CRÍTICO: Módulo obsoleto 'filterProcessor.js' fue llamado. El flujo principal debe usar detectionService.");
    
    // Devolvemos un error para asegurar que el flujo se detenga si se ejecuta por error.
    return {
        status: 500,
        safeErrorResponse: {
            results: [{
                error: "MODULE_FLOW_ERROR",
                message: "La lógica de procesamiento falló. Contacte a su administrador.",
                ok: false
            }]
        }
    };
}

module.exports = {
    processFilterCode
};
