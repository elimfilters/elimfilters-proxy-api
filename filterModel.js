const mongoose = require('mongoose');

// Este es el "molde" o esquema para guardar los datos scrapeados en MongoDB
const FilterSchema = new mongoose.Schema({
  priority_reference: { type: String, required: true, unique: true }, // El código principal del filtro
  duty_level: { type: String, required: true }, // 'HD' o 'LD'
  filter_family: { type: String, required: true }, // 'OIL', 'AIR', etc.
  specs: { type: mongoose.Schema.Types.Mixed, default: {} }, // Un objeto para especificaciones técnicas
  cross_reference: { type: [String], default: [] }, // Un array de códigos cruzados
  equipment_applications: { type: [String], default: [] }, // Un array de equipos donde aplica
  source: { type: String, required: true }, // 'DONALDSON_SCRAPER' o 'FRAM_SCRAPER'
  createdAt: { type: Date, default: Date.now }
});

// Le decimos a Mongoose que use este esquema
const Filter = mongoose.model('Filter', FilterSchema);

module.exports = Filter;
