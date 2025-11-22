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
        await mongoose.connect(mongoUri, {
            // Opciones recomendadas para evitar advertencias de depreciación
            // (pueden variar según la versión de Mongoose)
        });
        
        console.log('✅ MongoDB: Conexión establecida exitosamente.');
    } catch (error) {
        console.error('❌ MongoDB: Fallo al conectar a la base de datos.', error.message);
        // Si la conexión falla, se puede optar por detener la aplicación
        // process.exit(1); 
        throw error;
    }
}

module.exports = {
    connectDB
};
