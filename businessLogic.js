// businessLogic.js

// [Ajuste de la función que actualmente es vulnerable]
export function determineDutyLevel(family, specs, oemCodes, crossReference) {
    // ESTA LÍNEA DEBE SER ELIMINADA DE LA LÓGICA DE SUPOSICIÓN:
    // if (od >= HD_OIL_DIAMETER_MIN || dirtCapacity >= HD_OIL_CAPACITY_MIN) { return 'HD'; }

    // SOLUCIÓN: Si la data del NODO 3 (rawData) ya envió el nivel, ÚSALO. 
    // Si la familia es aceite/combustible, el deber de clasificar es de la data maestra.
    
    // Si la data maestra (que es la verdad) ya trae el duty_level:
    if (rawData.duty_level) {
        return rawData.duty_level; 
    }
    
    // Si el NODO 4 intenta adivinar sin data maestra, debe fallar:
    throw new Error('Clasificación de Duty Level no definida en la base de datos maestra.');
}
