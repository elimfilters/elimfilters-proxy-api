const mongoose = require('mongoose');

/**
 * Establece la conexión a la base de datos MongoDB.
 */
async function connectDB() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        console.error('❌ ERROR CRÍTICO: MONGODB_URI no definida en las variables de entorno.');
        throw new Error('MONGODB_URI is required.');
    }

    try {
        // Conexión simple sin opciones obsoletas
        await mongoose.connect(mongoUri);
        
        console.log('✅ MongoDB: Conexión establecida exitosamente.');
    } catch (error) {
        console.error('❌ MongoDB: Fallo al conectar a la base de datos.', error.message);
        throw error;
    }
}

module.exports = {
    connectDB
};
