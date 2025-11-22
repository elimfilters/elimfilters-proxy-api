const mongoose = require('mongoose');
const { Schema } = mongoose;

// Definición del sub-esquema para las Referencias Cruzadas (Cross References)
const CrossReferenceSchema = new Schema({
    manufacturer: { type: String, trim: true, required: true },
    part_number: { type: String, trim: true, required: true },
    // Puede añadir más metadatos si es necesario
});

// Definición del sub-esquema para las Aplicaciones de Equipo/Vehículo
const ApplicationSchema = new Schema({
    // Para HD (Donaldson)
    equipment: { type: String, trim: true },
    type: { type: String, trim: true },
    engine: { type: String, trim: true },

    // Para LD (FRAM) - usamos los mismos campos con un mapeo ligero
    year: { type: String, trim: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    
    // Campo genérico para cualquier aplicación detallada
    detail: { type: String, trim: true },
}, { _id: false }); // No necesitamos un ID para cada sub-documento

// Esquema Principal del Filtro
const FilterSchema = new Schema({
    // --- Identificación y Caching ---
    primary_reference: {
        type: String,
        required: true,
        unique: true, // IMPEDIRÁ QUE SE GUARDEN DUPLICADOS
        trim: true,
        index: true
    },
    
    // --- Metadatos del Scraper ---
    is_scraped: {
        type: Boolean,
        default: true
    },
    source_url: {
        type: String,
        trim: true
    },
    scraped_on: {
        type: Date,
        default: Date.now
    },

    // --- Datos para Generación de SKU ---
    duty_level: {
        type: String,
        enum: ['HD', 'LD', 'UNKNOWN'],
        required: true
    },
    filter_type: { // Corresponde a rawData.filter_family
        type: String,
        required: true,
        trim: true
    },

    // --- Datos Detallados del Scraper (Tablas y Atributos) ---
    cross_references: [CrossReferenceSchema],

    equipment_applications: [ApplicationSchema],
    
    // specs (Atributos técnicos) es un objeto flexible sin un esquema estricto
    specs: {
        type: Object,
        default: {}
    }
}, { timestamps: true });

// Exportar el modelo de Mongoose
module.exports = mongoose.model('Filter', FilterSchema);
