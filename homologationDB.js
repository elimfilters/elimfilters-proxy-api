// homologationDB.js (SIMULACIÓN DE LA BASE DE DATOS MAESTRA)

const MASTER_HOMOLOGATION_DATA = {
    // ... otros registros ...

    // Registro para el filtro WIX 33166
    "33166": { // La clave de búsqueda puede ser el código WIX
        master_id: "F003",
        // Incluir la referencia correcta de Donaldson que se usará para el SKU
        oem_codes: ["RE509531", "3969341"],
        cross_reference: ["FF5507", "51515", "P556245"], // ¡Incluir P556245 aquí!
        
        // Agregar una clave de prioridad para el NODO 4:
        priority_cross_reference: "P556245", // <- La referencia que el NODO 4 debe usar
        priority_brand: "DONALDSON",         // <- La marca que el NODO 4 debe usar
        
        filter_family: "COMBUSTIBLE",
        duty_level: "HD", 
        specs: {
            "Height (mm)": "177",
            "Outer Diameter (mm)": "93",
            "Micron Rating": "10",
            // ... (el resto de las especificaciones de las 27 columnas)
        }
    },
    
    // ... otros registros ...
};
