# ELIMFILTERS Proxy API v3.0.0

## ⚠️ LEE INSTRUCCIONES.txt PRIMERO

Este paquete contiene **SOLO** los archivos necesarios para el proxy v3.0.0.

## ✅ Incluye

- ✅ server.js v3.0.0
- ✅ businessLogic.js v2.2.3
- ✅ rulesProtection.js v2.2.3  
- ✅ config/REGLAS_MAESTRAS.json v2.2.3
- ✅ Todos los módulos necesarios
- ✅ Sin archivos extras
- ✅ Sin n8n

## 🚀 Deployment

1. **ELIMINAR** archivos viejos del repo
2. **COPIAR** todo este ZIP al repo
3. **PUSH** a GitHub
4. Railway auto-deploys

## 🔍 Verificar

```bash
curl https://tu-url.railway.app/health
```

Debe mostrar: `"version": "3.0.0"`

## 📋 Archivos en este paquete

```
├── server.js                    (v3.0.0)
├── businessLogic.js             (v2.2.3)
├── rulesProtection.js           (v2.2.3)
├── package.json                 (v3.0.0)
├── filterProcessor.js
├── detectionService.js
├── googleSheetsConnector.js
├── jsonBuilder.js
├── utils.js
├── security.js
├── dataAccess.js
├── homologationDB.js
├── Dockerfile
├── railway.json
├── .env.example
├── .gitignore
├── config/
│   └── REGLAS_MAESTRAS.json    (v2.2.3)
├── INSTRUCCIONES.txt            ← LEE ESTO
└── README.md                    ← Estás aquí
```
---
<!-- Trigger rebuild 2025-10-29 -->
```
Trigger rebuild
