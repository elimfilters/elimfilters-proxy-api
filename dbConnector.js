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
        // Opciones para una conexión estable y evitar advertencias
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Tiempo de espera para seleccionar un servidor
            socketTimeoutMS: 45000, // Cierra los sockets después de 45s de inactividad
        };

        await mongoose.connect(mongoUri, options);
        
        console.log('✅ MongoDB: Conexión establecida exitosamente.');
    } catch (error) {
        console.error('❌ MongoDB: Fallo al conectar a la base de datos.', error.message);
        // Si la conexión falla, se lanza el error para que el servidor se detenga
        throw error;
    }
}

module.exports = {
    connectDB
};
