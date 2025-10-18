# syntax=docker/dockerfile:1.5

# Imagen base ligera con Node.js 20
FROM node:20-alpine

# Crea el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de dependencias (package.json y package-lock.json si existiera)
COPY package*.json ./

# Instala las dependencias sin exigir lockfile
# Evita auditorías y avisos innecesarios
RUN npm install --no-audit --no-fund

# Copia todo el código del proyecto dentro del contenedor
COPY . .

# Expone el puerto que usará la aplicación
EXPOSE 3000

# Comando por defecto para iniciar la API
CMD ["node", "server.js"]
