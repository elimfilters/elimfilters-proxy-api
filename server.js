// server.js v3.8.2 — soporte CORS, healthcheck en /health y bind 0.0.0.0
require('dotenv').config();
const express = require('express');
const path = require('path');
let helmet;
try {
  helmet = require('helmet');
} catch (e) {
  console.warn('⚠️  Helmet no está instalado; continuando sin middleware de seguridad.');
}
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const GoogleSheetsService = require('./googleSheetsConnector');
const detectionService = require('./detectionService');
const normalizeQuery = require('./normalizeQuery');
const businessLogic = require('./businessLogic');
const rulesProtection = require('./rulesProtection');
const REGLAS_MAESTRAS = require('./config/MASTER_RULES.json');
const OEM_RANKING = require('./config/oemRanking.json');
const DUTY_SECTORS = require('./config/dutySectors.json');

const app = express();
const PORT = process.env.PORT || 3000;
// Confiar en proxy (para rate limit/IP correcto detrás de Railway/Nginx)
app.set('trust proxy', parseInt(process.env.TRUST_PROXY || '1', 10));

// Identificador de solicitud y manejo de errores no capturados
app.use((req, _res, next) => {
  req.request_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  next();
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err);
});

// Utilidad para validar URL absoluta
function isValidAbsoluteUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Validación de query del alias
function isValidAliasQuery(q) {
  const s = String(q || '').trim();
  if (!s) return false;
  if (s.length < 2 || s.length > 64) return false;
  // Permitir letras/números y separadores comunes
  if (!/^[A-Za-z0-9\-\/\s]+$/.test(s)) return false;
  return true;
}

// Webhook allowlist y circuito básico
const webhookBreaker = { failures: 0, openUntil: 0 };
function canUseWebhook() {
  return Date.now() > webhookBreaker.openUntil;
}
function recordWebhookFailure() {
  webhookBreaker.failures += 1;
  if (webhookBreaker.failures >= 3) {
    webhookBreaker.openUntil = Date.now() + 5 * 60 * 1000; // 5 minutos
  }
}
function recordWebhookSuccess() {
  webhookBreaker.failures = 0;
  webhookBreaker.openUntil = 0;
}
function isAllowedWebhookUrl(url) {
  try {
    const u = new URL(url);
    const allowed = (process.env.N8N_ALLOWED_HOSTS || '').split(',').map(h => h.trim()).filter(Boolean);
    if (allowed.length === 0) return true; // sin lista, permitir URLs válidas
    return allowed.includes(u.hostname);
  } catch {
    return false;
  }
}

// Seguridad HTTP (helmet) opcional
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: true }
  }));
}

// CORS restringido a dominios de elimfilters + orígenes de desarrollo
// Permite override por variable de entorno ALLOWED_ORIGINS=dominio1,dominio2
const devOrigins = [
  'http://localhost:8000',
  'http://localhost:3000',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:3000',
  'http://localhost:8010',
  'http://127.0.0.1:8010'
];
const envAllowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowedOrigins = [
  'https://elimfilters.com',
  'https://www.elimfilters.com',
  ...devOrigins,
  ...envAllowed
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Límite básico global
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);
// Límite específico para alias público
const aliasLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.ALIAS_RATE_LIMIT_PER_MIN || '30', 10),
  standardHeaders: true,
  legacyHeaders: false
});

// Instancia de Google Sheets
let sheetsInstance;
let server;

async function initializeServices() {
  try {
    sheetsInstance = new GoogleSheetsService();
    await sheetsInstance.initialize();
    // Asegurar encabezados del Master si la hoja está vacía
    try {
      const ensured = await sheetsInstance.ensureMasterHeaders();
      if (!ensured) {
        console.warn('⚠️ No se pudieron asegurar los encabezados del Master. Verifique permisos/ID.');
      }
    } catch (e) {
      console.warn('⚠️ Error asegurando encabezados del Master:', e.message);
    }
    detectionService.setSheetsInstance(sheetsInstance);
    console.log('✅ Servicios inicializados correctamente');
  } catch (error) {
    console.error('❌ Error inicializando servicios:', error);
  }
}

// Endpoint de salud para Railway
app.get('/health', (req, res) => {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || '';
  const timeoutMs = parseInt(process.env.N8N_TIMEOUT_MS || '5000', 10);
  const allowedHostsEnv = (process.env.N8N_ALLOWED_HOSTS || '').trim();
  const allowedHosts = allowedHostsEnv ? allowedHostsEnv.split(',').map(s => s.trim()).filter(Boolean) : [];
  const webhookEnabled = !!webhookUrl;
  const allowedHostOk = webhookEnabled ? isAllowedWebhookUrl(webhookUrl) : false;
  const breakerOpen = Date.now() < (webhookBreaker.openUntil || 0);
  const failures = webhookBreaker.failures || 0;
  const sheetsFlushIntervalMs = parseInt(process.env.SHEETS_FLUSH_INTERVAL_MS || '60000', 10);
  const aliasRateLimitPerMin = parseInt(process.env.ALIAS_RATE_LIMIT_PER_MIN || '30', 10);
  res.json({
    status: 'ok',
    service: 'ELIMFILTERS Proxy API',
    version: '3.8.2',
    features: {
      google_sheets: sheetsInstance ? 'connected' : 'disconnected',
      cross_reference_db: 'active',
      wordpress_ready: true,
      alias_webhook: {
        enabled: webhookEnabled,
        allowed_host: allowedHostOk,
        breaker_open: breakerOpen,
        failures,
        timeout_ms: timeoutMs,
        allowed_hosts: allowedHosts
      }
    },
    endpoints: {
      health: 'GET /health',
      detect: 'GET /api/v1/filters/search',
      prefixes: 'GET /api/v1/prefixes',
      oem_ranking: 'GET /api/v1/oem-ranking'
    },
    limits: {
      alias_rate_limit_per_min: aliasRateLimitPerMin
    },
    sheets: {
      flush_interval_ms: sheetsFlushIntervalMs
    }
  });
});

// Diagnóstico de Master Sheet: headers y estado
app.get('/health/master', async (req, res) => {
  try {
    const connected = !!sheetsInstance;
    const headers = connected ? await sheetsInstance.getHeaders() : [];
    const hasQueryNorm = headers.includes('query_norm');
    const hasSku = headers.includes('sku');
    const hasOEMNumber = headers.includes('oem_number');
    const hasFamily = headers.includes('family');
    const hasDuty = headers.includes('duty');
    const hasCrossBrand = headers.includes('cross_brand');
    const hasCrossPartNumber = headers.includes('cross_part_number');
    const pendingStats = connected && sheetsInstance.getPendingWritesStats ? sheetsInstance.getPendingWritesStats() : { exists: false, count: 0 };
  res.json({
    connected,
    sheet: process.env.SHEET_NAME || 'Master',
    headers,
      columns: {
        query_norm: hasQueryNorm,
        sku: hasSku,
        family: hasFamily,
        duty: hasDuty,
        oem_number: hasOEMNumber,
        cross_brand: hasCrossBrand,
        cross_part_number: hasCrossPartNumber
      },
      pending_writes: pendingStats
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Tabla canónica de prefijos (reglas protegidas)
app.get('/api/v1/prefixes', (req, res) => {
  try {
    const protectedRules = rulesProtection.getProtectedRules();
    // Construir salida segura sin exponer estructuras internas no necesarias
    const decisionTable = protectedRules.decisionTable || {};
    const families = Array.from(new Set(Object.keys(decisionTable).map(k => k.split('|')[0])));
    const duties = Array.from(new Set(Object.keys(decisionTable).map(k => k.split('|')[1])));

    // Prefijos únicos y mapeo desde archivo de reglas maestras (fuente documental)
    const allPrefixes = Array.isArray(REGLAS_MAESTRAS.allPrefixes) ? REGLAS_MAESTRAS.allPrefixes : Array.from(new Set(Object.values(decisionTable)));
    const prefixMapping = REGLAS_MAESTRAS.prefixMapping || {};

    // Sinónimos comunes para normalización (documental)
    const synonyms = {
      AIR: ['AIRE'],
      HOUSING: ['CARCAZA AIR FILTER'],
      TURBINE: ['TURBINE SERIES'],
      AIR_DRYER: ['AIR DRYER']
    };

    return res.json({
      ok: true,
      version: protectedRules.version,
      correctionVersion: protectedRules.correctionVersion,
      lastUpdate: protectedRules.lastUpdate,
      families,
      duties,
      decisionTable,
      allPrefixes,
      prefixMapping,
      synonyms
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Metadatos: listas de OEM y cross-reference por sector HD/LD
app.get('/api/v1/metadata/sectors', (req, res) => {
  try {
    return res.json({ ok: true, version: DUTY_SECTORS.version || '1.0.0', ...DUTY_SECTORS });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Ranking OEM por región/duty (auditoría)
app.get('/api/v1/oem-ranking', (req, res) => {
  try {
    const regionParam = String(req.query.region || '').toUpperCase();
    const defaultRegion = String(process.env.OEM_RANK_REGION || 'GLOBAL').toUpperCase();
    const availableRegions = Array.isArray(OEM_RANKING.regions) ? OEM_RANKING.regions : Object.keys(OEM_RANKING.ranking || {});
    const region = availableRegions.includes(regionParam) ? regionParam : defaultRegion;

    const ranking = (OEM_RANKING.ranking && OEM_RANKING.ranking[region]) || (OEM_RANKING.ranking && OEM_RANKING.ranking['GLOBAL']) || {};
    const familyOverrides = (OEM_RANKING.family_overrides && (OEM_RANKING.family_overrides[region] || OEM_RANKING.family_overrides['GLOBAL'])) || {};
    const synonyms = OEM_RANKING.synonyms || {};

    return res.json({
      ok: true,
      version: OEM_RANKING.version,
      region,
      defaultRegion,
      regions: availableRegions,
      ranking,
      family_overrides: familyOverrides,
      synonyms
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Endpoint principal de búsqueda
app.get('/api/v1/filters/search', async (req, res) => {
  // Helper: misma validación que alias; asegura prefijo y últimos 4 dígitos numéricos
  function computeOk(row) {
    try {
      const fam = row && row.family ? String(row.family) : '';
      const duty = String(row && row.duty ? row.duty : 'HD').toUpperCase();
      const sku = String(row && row.sku ? row.sku : '').trim();
      const last4Raw = String(row && row.last4_digits ? row.last4_digits : '');
      const last4 = last4Raw.replace(/\D/g, '').slice(-4).padStart(4, '0');
      const normalizedFamily = detectionService.mapFamilyForPrefix ? detectionService.mapFamilyForPrefix(fam) : String(fam || '').toUpperCase();
      const expectedPrefix = rulesProtection.getPrefix(normalizedFamily, duty);
      const hasValidPrefix = !!expectedPrefix && sku.startsWith(expectedPrefix);
      const hasValidLast4 = /^\d{4}$/.test(last4);
      const endsWithLast4 = sku.length >= 7 && sku.slice(-4) === last4;
      return !!(hasValidPrefix && hasValidLast4 && endsWithLast4);
    } catch (_) {
      return false;
    }
  }
  if (!sheetsInstance) {
    return res.status(503).json({ error: 'Sheets no inicializado. Verifica GOOGLE_SHEETS_SPREADSHEET_ID, SHEET_NAME, GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY.' });
  }
  const part = req.query.part?.trim();
  console.log('🔍 Consulta recibida:', part);

  if (!part) {
    return res.status(400).json({ error: 'Parámetro "part" requerido' });
  }

  try {
    const queryNorm = normalizeQuery(part);
    const masterResult = await sheetsInstance.findRowByQuery(queryNorm);
    console.log('📘 Resultado en Sheet Master:', masterResult);

    if (masterResult && masterResult.found) {
      console.log('✅ Encontrado en Master → devolviendo resultado');
      // Si faltan campos canónicos, enriquecer con detección local y actualizar la fila
      try {
        const criticalKeys = [
          'manufactured_by','last4_source','last4_digits',
          'source','homologated_sku','filter_type','description',
          'media_type','subtype'
        ];
        const missingCritical = criticalKeys.some(k => !String(masterResult[k] || '').trim());
        // Verificación explícita de fabricante DONALDSON/FRAM según duty
        const verification = await detectionService.verifyManufacturer(part, sheetsInstance);
        const manufacturerMismatch = verification.confirmed && String(masterResult.manufactured_by || '').toUpperCase() !== verification.manufacturer;
        // Comparar con nueva lógica: si difieren family/sku/filter_type/media_type/subtype/duty/source, refrescar
        let detectionCurrent = null;
        try { detectionCurrent = await detectionService.detectFilter(part, sheetsInstance); } catch (_) {}
        const differsCore = detectionCurrent && (
          String(masterResult.family || '').toUpperCase() !== String(detectionCurrent.family || '').toUpperCase()
          || String(masterResult.homologated_sku || '').toUpperCase() !== String(detectionCurrent.homologated_sku || '').toUpperCase()
          || String(masterResult.filter_type || '').toUpperCase() !== String(detectionCurrent.filter_type || '').toUpperCase()
          || String(masterResult.media_type || '').toUpperCase() !== String(detectionCurrent.media_type || '').toUpperCase()
          || String(masterResult.subtype || '').toUpperCase() !== String(detectionCurrent.subtype || '').toUpperCase()
          || String(masterResult.duty || '').toUpperCase() !== String(detectionCurrent.duty || '').toUpperCase()
          || String(masterResult.source || '').toUpperCase() !== String(detectionCurrent.source || '').toUpperCase()
        );
        const needsEnrichment = missingCritical || manufacturerMismatch || differsCore;
        if (needsEnrichment) {
          const enriched = detectionCurrent || await detectionService.detectFilter(part, sheetsInstance);
          try { await sheetsInstance.replaceOrInsertRow(enriched); } catch (_) {}
          // Releer fila ya actualizada para consistencia
          const refreshed = await sheetsInstance.findRowByQuery(queryNorm);
          if (refreshed && refreshed.found) {
            const headers = await sheetsInstance.getHeaders();
            const padded = { ...refreshed };
            headers.forEach(h => { if (!(h in padded)) padded[h] = ''; });
            // Asegurar señales de fabricación Donaldson/FRAM en la respuesta
            padded.donaldson_fabrica = verification.manufacturer === 'DONALDSON' && !!verification.confirmed;
            padded.fram_fabrica = verification.manufacturer === 'FRAM' && !!verification.confirmed;
            padded.sector = verification.sector;
            return res.json({ found: true, data: padded });
          } else {
            // Si no se pudo refrescar en Master, devolver enriquecido directamente
            const headers = await sheetsInstance.getHeaders();
            const paddedDirect = { ...enriched };
            headers.forEach(h => { if (!(h in paddedDirect)) paddedDirect[h] = ''; });
            try {
              const v = await detectionService.verifyManufacturer(part, sheetsInstance);
              paddedDirect.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
              paddedDirect.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
              paddedDirect.sector = v.sector;
            } catch (_) {}
            return res.json({ found: true, data: paddedDirect });
          }
        }
        // Si no requiere enriquecimiento, validar desalineación de last4 y refrescar si cambió la lógica
        try {
          const detection = await detectionService.detectFilter(part, sheetsInstance);
          const differsLast4 = (
            String(masterResult.last4_source || '') !== String(detection.last4_source || '')
            || String(masterResult.last4_digits || '') !== String(detection.last4_digits || '')
          );
          if (differsLast4) {
            await sheetsInstance.replaceOrInsertRow({ ...detection, query_norm: queryNorm });
            const refreshed2 = await sheetsInstance.findRowByQuery(queryNorm);
            if (refreshed2 && refreshed2.found) {
              const headers = await sheetsInstance.getHeaders();
              const padded2 = { ...refreshed2 };
              headers.forEach(h => { if (!(h in padded2)) padded2[h] = ''; });
              const verification2 = await detectionService.verifyManufacturer(part, sheetsInstance);
              padded2.donaldson_fabrica = verification2.manufacturer === 'DONALDSON' && !!verification2.confirmed;
              padded2.fram_fabrica = verification2.manufacturer === 'FRAM' && !!verification2.confirmed;
              padded2.sector = verification2.sector;
              return res.json({ found: true, data: padded2 });
            }
          }
        } catch (_) {}
        // Asegurar que incluimos todas las columnas del Master
        const headers = await sheetsInstance.getHeaders();
        const padded = { ...masterResult };
        headers.forEach(h => { if (!(h in padded)) padded[h] = ''; });
        // Asegurar señales de fabricación Donaldson/FRAM en la respuesta
        const verification2 = await detectionService.verifyManufacturer(part, sheetsInstance);
        padded.donaldson_fabrica = verification2.manufacturer === 'DONALDSON' && !!verification2.confirmed;
        padded.fram_fabrica = verification2.manufacturer === 'FRAM' && !!verification2.confirmed;
        padded.sector = verification2.sector;
        return res.json({ found: true, data: padded });
      } catch (_) {
        // Fallback: devolver master y señales básicas de verificación si están disponibles
        try {
          const verification3 = await detectionService.verifyManufacturer(part, sheetsInstance);
          const basic = { ...masterResult };
          basic.donaldson_fabrica = verification3.manufacturer === 'DONALDSON' && !!verification3.confirmed;
          basic.fram_fabrica = verification3.manufacturer === 'FRAM' && !!verification3.confirmed;
          basic.sector = verification3.sector;
          return res.json({ found: true, data: basic });
        } catch (__e) {
          return res.json({ found: true, data: masterResult });
        }
      }
    }

    console.log('⚙️ No existe en Master → validación: cross confirmado o n8n');
    // Aceptar directamente si el código es cross confirmado (Donaldson/FRAM)
    const verification = await detectionService.verifyManufacturer(part, sheetsInstance);
    console.log('🔎 Verificación fabricante:', verification);
    if (verification?.confirmed && (verification.manufacturer === 'DONALDSON' || verification.manufacturer === 'FRAM' || verification.manufacturer === 'FORD')) {
      let accepted;
      try {
        accepted = await detectionService.detectFilter(part, sheetsInstance);
      } catch (e) {
        if (e && e.message === 'DISCONTINUED_NO_REPLACEMENT') {
          return res.status(422).json({
            found: false,
            error: 'NO_REPLACEMENT',
            message: 'Código descontinuado sin reemplazo en Master. No se genera SKU.',
            details: e.context || { part }
          });
        }
        throw e;
      }
      // Si se fuerza nuevo SKU en supersession y hay webhook configurado, intentar generación externa
      if (accepted && accepted.force_new_sku_on_supersession) {
        const webhook = process.env.N8N_WEBHOOK_URL;
        if (webhook && isValidAbsoluteUrl(webhook)) {
          try {
            const n8nResponse = await fetch(webhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ part })
            });
            const n8nData = await n8nResponse.json();
            if (n8nData?.reply) {
              const enriched = { ...n8nData.reply };
              enriched.ok = computeOk(enriched);
              try { await sheetsInstance.replaceOrInsertRow(enriched); } catch (_) {}
              const headers = await sheetsInstance.getHeaders();
              const paddedGen = { ...enriched };
              headers.forEach(h => { if (!(h in paddedGen)) paddedGen[h] = ''; });
              return res.json({ found: true, data: paddedGen });
            }
            console.warn('❌ n8n no devolvió "reply" en supersession forzada; se continúa con persistencia local');
          } catch (e) {
            console.warn('❌ Error invocando n8n (supersession forzada):', e.message);
          }
        }
      }
      if (accepted && String(accepted.sku || '').trim()) {
        try { await sheetsInstance.replaceOrInsertRow(accepted); } catch (_) {}
      }
      const storedAccepted = await sheetsInstance.findRowByQuery(normalizeQuery(part));
      if (storedAccepted && storedAccepted.found) {
        // Devolver desde cache si se logró persistir
        const headers = await sheetsInstance.getHeaders();
        const paddedStored = { ...storedAccepted };
        headers.forEach(h => { if (!(h in paddedStored)) paddedStored[h] = ''; });
        try {
          const v = await detectionService.verifyManufacturer(part, sheetsInstance);
          paddedStored.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
          paddedStored.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
          paddedStored.sector = v.sector;
        } catch (_) {}
        return res.json({ found: true, data: paddedStored });
      }
      // Fallback: devolver el objeto enriquecido con padding aunque no se haya persistido
      const headers = await sheetsInstance.getHeaders();
      const paddedAccepted = { ...accepted };
      headers.forEach(h => { if (!(h in paddedAccepted)) paddedAccepted[h] = ''; });
      try {
        const v = await detectionService.verifyManufacturer(part, sheetsInstance);
        paddedAccepted.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
        paddedAccepted.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
        paddedAccepted.sector = v.sector;
      } catch (_) {}
      return res.json({ found: true, data: paddedAccepted });
    }

    // Si no es cross confirmado, intentar validar vía n8n
    const webhook = process.env.N8N_WEBHOOK_URL;
    if (webhook && isValidAbsoluteUrl(webhook)) {
      const n8nResponse = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part })
      });

      const n8nData = await n8nResponse.json();
      console.log('📦 Respuesta n8n:', n8nData);

      if (n8nData?.reply) {
        console.log('🆕 Nuevo SKU generado, registrando en Master...');
        const enriched = { ...n8nData.reply };
        enriched.ok = computeOk(enriched);
        await sheetsInstance.replaceOrInsertRow(enriched);
        console.log('✅ Registro completado, devolviendo al cliente');
        try {
          const v = await detectionService.verifyManufacturer(part, sheetsInstance);
          enriched.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
          enriched.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
          enriched.sector = v.sector;
        } catch (_) {}
        return res.json({ found: false, data: enriched });
      }

      console.warn('❌ Flujo n8n no devolvió un "reply" válido → fallback local detectFilter (persistir en Master)');
      try {
        const local = await detectionService.detectFilter(part, sheetsInstance);
        const queryNormLocal = normalizeQuery(part);
        const toStore = { ...local, query_norm: queryNormLocal };
        try { await sheetsInstance.replaceOrInsertRow(toStore); } catch (_) {}
        const stored = await sheetsInstance.findRowByQuery(queryNormLocal);
        if (stored && stored.found) {
          const headers = await sheetsInstance.getHeaders();
          const paddedStored = { ...stored };
          headers.forEach(h => { if (!(h in paddedStored)) paddedStored[h] = ''; });
          try {
            const v = await detectionService.verifyManufacturer(part, sheetsInstance);
            paddedStored.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
            paddedStored.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
            paddedStored.sector = v.sector;
          } catch (_) {}
          return res.json({ found: true, data: paddedStored });
        }
        // Si no se pudo persistir, devolver enriquecido con padding
        const headers = await sheetsInstance.getHeaders();
        const paddedLocal = { ...local };
        headers.forEach(h => { if (!(h in paddedLocal)) paddedLocal[h] = ''; });
        try {
          const v = await detectionService.verifyManufacturer(part, sheetsInstance);
          paddedLocal.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
          paddedLocal.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
          paddedLocal.sector = v.sector;
        } catch (_) {}
        return res.json({ found: true, data: paddedLocal });
      } catch (e) {
        if (e && e.message === 'DISCONTINUED_NO_REPLACEMENT') {
          return res.status(422).json({
            found: false,
            error: 'NO_REPLACEMENT',
            message: 'Código descontinuado sin reemplazo en Master. No se genera SKU.',
            details: e.context || { part }
          });
        }
        return res.status(422).json({ found: false, error: 'Código no validado en fuentes confiables. No se procesa.' });
      }
    } else {
      console.warn('⚠️ n8n deshabilitado o URL inválida → fallback local detectFilter (persistir en Master)');
      try {
        const local = await detectionService.detectFilter(part, sheetsInstance);
        const queryNormLocal = normalizeQuery(part);
        const toStore = { ...local, query_norm: queryNormLocal };
        try { await sheetsInstance.replaceOrInsertRow(toStore); } catch (_) {}
        const stored = await sheetsInstance.findRowByQuery(queryNormLocal);
        if (stored && stored.found) {
          const headers = await sheetsInstance.getHeaders();
          const paddedStored = { ...stored };
          headers.forEach(h => { if (!(h in paddedStored)) paddedStored[h] = ''; });
          try {
            const v = await detectionService.verifyManufacturer(part, sheetsInstance);
            paddedStored.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
            paddedStored.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
          } catch (_) {}
          return res.json({ found: true, data: paddedStored });
        }
        // Si no se pudo persistir, devolver enriquecido con padding
        const headers = await sheetsInstance.getHeaders();
        const paddedLocal = { ...local };
        headers.forEach(h => { if (!(h in paddedLocal)) paddedLocal[h] = ''; });
        try {
          const v = await detectionService.verifyManufacturer(part, sheetsInstance);
          paddedLocal.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
          paddedLocal.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
        } catch (_) {}
        return res.json({ found: true, data: paddedLocal });
      } catch (e) {
        if (e && e.message === 'DISCONTINUED_NO_REPLACEMENT') {
          return res.status(422).json({
            found: false,
            error: 'NO_REPLACEMENT',
            message: 'Código descontinuado sin reemplazo en Master. No se genera SKU.',
            details: e.context || { part }
          });
        }
        return res.status(422).json({ found: false, error: 'Validación web deshabilitada. No se procesa.' });
      }
    }
  } catch (error) {
    console.error('💥 Error en /filters/search:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Registro de equivalencias OEM→Cross en Master
app.post('/api/v1/cross/register', async (req, res) => {
  try {
    const { oem_number, brand, part_number, family } = req.body || {};
    if (!oem_number || !brand || !part_number) {
      return res.status(400).json({ error: 'Campos requeridos: oem_number, brand, part_number' });
    }

    if (!sheetsInstance) {
      return res.status(503).json({ error: 'Sheets no inicializado' });
    }

    const b = String(brand).trim().toUpperCase();
    const fam = String(family || '').trim() || 'AIR';

    let saved = false;
    if (b === 'DONALDSON' || b === 'FRAM') {
      saved = await sheetsInstance.saveCrossReference(oem_number, b, part_number, fam);
    } else {
      return res.status(400).json({ error: 'Brand soportado: DONALDSON o FRAM' });
    }

    // Enriquecer fila con columnas canónicas y upsert
    let enriched = null;
    try {
      enriched = await detectionService.detectFilter(oem_number, sheetsInstance);
      await sheetsInstance.replaceOrInsertRow(enriched);
    } catch (e) {
      console.warn('⚠️ Enrichment tras registro falló:', e.message);
    }

    return res.json({ ok: !!saved, enriched });
  } catch (e) {
    console.error('❌ Error registrando cross:', e);
    return res.status(500).json({ error: e.message });
  }
});

// Alias legacy para compatibilidad con WordPress plugin
// Acepta GET y POST y responde con estructura { status: 'OK', data: {...}, source, response_time_ms }
app.all('/api/detect-filter', aliasLimiter, async (req, res) => {
  // Helper: validar estructura del SKU y últimos 4 alfanuméricos
  function computeOk(row) {
    try {
      const fam = row && row.family ? String(row.family) : '';
      const duty = String(row && row.duty ? row.duty : 'HD').toUpperCase();
      const sku = String(row && row.sku ? row.sku : '').trim();
      const last4Raw = String(row && (row.last4_digits || row.last4 || row.query_norm || ''));
      const last4 = last4Raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-4).padStart(4, '0');
      const normalizedFamily = detectionService.mapFamilyForPrefix ? detectionService.mapFamilyForPrefix(fam) : String(fam || '').toUpperCase();
      const expectedPrefix = rulesProtection.getPrefix(normalizedFamily, duty);
      const hasValidPrefix = !!expectedPrefix && sku.startsWith(expectedPrefix);
      const hasValidLast4 = /^[A-Z0-9]{4}$/.test(last4);
      const endsWithLast4 = sku.length >= 7 && sku.slice(-4) === last4;
      return !!(hasValidPrefix && hasValidLast4 && endsWithLast4);
    } catch (_) {
      return false;
    }
  }
  if (!sheetsInstance) {
    return res.status(503).json({ status: 'ERROR', message: 'Sheets no inicializado. Verifica variables GOOGLE_* en Railway.', request_id: req.request_id });
  }
  const started = Date.now();
  // Evitar cacheo de alias en proxies/CDN
  try { res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'); } catch (_) {}
  if (!(req.method === 'GET' || req.method === 'POST')) {
    return res.status(405).json({ status: 'ERROR', message: 'Método no permitido. Use GET o POST.', request_id: req.request_id });
  }
  // Compatibilidad WP: aceptar application/json, x-www-form-urlencoded y multipart/form-data
  // Nota: express.json y express.urlencoded ya están registrados globalmente
  const q =
    (req.method === 'POST' ? (req.body?.query || req.body?.part || req.body?.code || req.body?.q) : null)
    || req.query.part || req.query.code || req.query.q;

  if (!q) {
    return res.status(400).json({ status: 'ERROR', message: 'Parámetro "query" o "part" requerido', request_id: req.request_id });
  }
  if (!isValidAliasQuery(q)) {
    return res.status(400).json({ status: 'ERROR', message: 'Query inválida: caracteres o longitud no permitidos', request_id: req.request_id });
  }

  try {
    const queryNorm = normalizeQuery(q);
    const masterResult = await sheetsInstance.findRowByQuery(queryNorm);
    if (masterResult && masterResult.found) {
      const data = { ...masterResult, original_query: q };
      // Metadatos obligatorios
      data.created_at = new Date().toISOString();
      // Asegurar homologated_sku presente (si falta, usar sku)
      if (!('homologated_sku' in data) || !String(data.homologated_sku || '').trim()) {
        data.homologated_sku = String(data.sku || '').trim();
      }
      try {
        const v = await detectionService.verifyManufacturer(q, sheetsInstance);
        data.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
        data.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
      } catch (_) {}
      // Sanitización de listas OEM y cross-reference (máx 10, solo códigos)
      const sanitizeList = (v, duty = String(data.duty || '').toUpperCase()) => {
        if (!v) return '';
        const raw = Array.isArray(v) ? v.join(',') : String(v);
        const arr = raw
          .split(/[,;\n]+/)
          .map(s => String(s).trim().toUpperCase())
          .filter(s => s)
          .map(s => s.replace(/[^A-Z0-9]/g, ''))
          .filter(Boolean);
        // Preferir Donaldson primero con heurística simple (P + 5-6 dígitos)
        const isDonaldsonCode = (s) => /^P\d{5,6}$/.test(s);
        arr.sort((a, b) => {
          const ad = isDonaldsonCode(a) ? 0 : 1;
          const bd = isDonaldsonCode(b) ? 0 : 1;
          if (ad !== bd) return ad - bd;
          // Estable: por longitud y lexicográfico
          if (a.length !== b.length) return a.length - b.length;
          return a.localeCompare(b);
        });
        return arr.slice(0, 10).join(',');
      };
      if ('oem_codes' in data) data.oem_codes = sanitizeList(data.oem_codes);
      if ('oem_code' in data && !('oem_codes' in data)) data.oem_code = sanitizeList(data.oem_code);
      if ('all_cross_references' in data) data.all_cross_references = sanitizeList(data.all_cross_references);
      if ('cross_reference' in data) data.cross_reference = sanitizeList(data.cross_reference);
      // Columnas técnicas obligatorias (vacías si no aplican)
      ['rated_flow_gpm','service_life_hours','change_interval_km','water_separation_efficiency_percent','drain_type']
        .forEach(k => { if (!(k in data)) data[k] = ''; });
      // Descripción fija para EL82100
      if (String(data.sku || '').toUpperCase() === 'EL82100') {
        data.description = (
          'El EL82100 es un filtro de aceite full flow para motores diésel de servicio pesado, fabricado bajo estándares OEM. Incorpora media filtrante ELIMTEK™ que ofrece alta eficiencia de filtrado y gran capacidad de retención de partículas. Está diseñado para resistir altas presiones, temperaturas extremas y condiciones severas de operación. Compatible con aceites minerales y sintéticos, optimiza el rendimiento del motor y extiende los intervalos de mantenimiento. Ideal para flotas de transporte, maquinaria pesada, buses y equipos industriales. Ventajas clave: media filtrante ELIMTEK™ de alta eficiencia, soporta presiones y temperaturas extremas, compatible con aceites minerales y sintéticos, diseñado para servicio prolongado y alto rendimiento en HD. ' +
          'Engine Lubricants (API CI-4/CI-4+, CJ-4, CK-4, or ACEA E7/E9 compliant)\n' +
          'The EL82100 is a full-flow oil filter for heavy-duty diesel engines, built to OEM standards. It features ELIMTEK™ high-efficiency filtration media, ensuring superior particle retention and extended dirt-holding capacity. Designed to endure high pressures, extreme temperatures, and severe service conditions. Compatible with both synthetic and mineral engine oils. It enhances engine performance and extends maintenance intervals. Ideal for transport fleets, heavy machinery, buses, and industrial equipment. Key benefits: ELIMTEK™ high-efficiency media, withstands pressure and heat, long-service design, and reliable engine protection under HD usage. ' +
          'Engine Lubricants (API CI-4/CI-4+, CJ-4, CK-4, or ACEA E7/E9 compliant)'
        );
      }
      // Añadir validación estricta ok=false si no cumple prefijo/last4
      data.ok = computeOk(data);
      const payload = {
        status: 'OK',
        data,
        source: 'cache',
        response_time_ms: Date.now() - started,
        request_id: req.request_id
      };
      return res.json(payload);
    }
    // Validación estricta: si no existe en Master, rechazar sin generar SKU ni datos
    return res.status(422).json({
      status: 'ERROR',
      message: 'Código inválido o no existente en base verificada. No se genera SKU ni datos.',
      data: { ok: false },
      response_time_ms: Date.now() - started,
      request_id: req.request_id
    });

    const webhook = process.env.N8N_WEBHOOK_URL;
    if (webhook && isValidAbsoluteUrl(webhook) && isAllowedWebhookUrl(webhook) && canUseWebhook()) {
      try {
        const controller = new AbortController();
        const timeoutMs = parseInt(process.env.N8N_TIMEOUT_MS || '5000', 10);
        const t = setTimeout(() => controller.abort(), timeoutMs);
        const n8nResponse = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ part: q }),
          signal: controller.signal
        });
        clearTimeout(t);
        const n8nData = await n8nResponse.json();
        if (n8nData?.reply) {
          const enrichedForStore = { ...n8nData.reply };
          enrichedForStore.ok = computeOk(enrichedForStore);
          await sheetsInstance.replaceOrInsertRow(enrichedForStore);
          const payload = {
            status: 'OK',
            data: (function(reply){
              const enriched = { ...reply, original_query: q };
              // Validación ok basada en prefijo y últimos 4 dígitos numéricos
              enriched.ok = computeOk(enriched);
              return enriched;
            })(n8nData.reply),
            source: 'generated',
            response_time_ms: Date.now() - started,
            request_id: req.request_id
          };
          try {
            const v = await detectionService.verifyManufacturer(q, sheetsInstance);
            payload.data.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
            payload.data.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
          } catch (_) {}
          recordWebhookSuccess();
          return res.json(payload);
        }
        console.warn('❌ Flujo n8n sin "reply" válido en alias; se usa fallback local');
        recordWebhookFailure();
      } catch (e) {
        console.warn('❌ Error invocando n8n desde alias:', e.message);
        recordWebhookFailure();
      }
    } else {
      console.warn('⚠️ n8n deshabilitado o URL inválida en alias → no se procesa sin validación web');
    }

    // Alias: aceptar si es cross confirmado (Donaldson/FRAM)
    const verification = await detectionService.verifyManufacturer(q, sheetsInstance);
    console.log('🔎 Verificación fabricante (alias):', verification);
    if (verification?.confirmed && (verification.manufacturer === 'DONALDSON' || verification.manufacturer === 'FRAM' || verification.manufacturer === 'FORD')) {
      let accepted;
      try {
        accepted = await detectionService.detectFilter(q, sheetsInstance);
      } catch (e) {
        if (e && e.message === 'DISCONTINUED_NO_REPLACEMENT') {
          return res.status(422).json({
            status: 'ERROR',
            message: 'Código descontinuado sin reemplazo en Master. No se genera SKU.',
            details: e.context || { part: q },
            response_time_ms: Date.now() - started,
            request_id: req.request_id
          });
        }
        throw e;
      }
      // Alias: si se fuerza nuevo SKU en supersession y hay webhook, usar generación externa
      if (accepted && accepted.force_new_sku_on_supersession) {
        const webhook = process.env.N8N_WEBHOOK_URL;
        if (webhook && isValidAbsoluteUrl(webhook) && isAllowedWebhookUrl(webhook) && canUseWebhook()) {
          try {
            const controller = new AbortController();
            const timeoutMs = parseInt(process.env.N8N_TIMEOUT_MS || '5000', 10);
            const t = setTimeout(() => controller.abort(), timeoutMs);
            const n8nResponse = await fetch(webhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ part: q }),
              signal: controller.signal
            });
            clearTimeout(t);
            const n8nData = await n8nResponse.json();
            if (n8nData?.reply) {
              const enrichedForStore = { ...n8nData.reply };
              enrichedForStore.ok = computeOk(enrichedForStore);
              await sheetsInstance.replaceOrInsertRow(enrichedForStore);
              let finalData = { ...n8nData.reply, original_query: q };
        try {
          const headers = await sheetsInstance.getHeaders();
          headers.forEach(h => { if (!(h in finalData)) finalData[h] = ''; });
        } catch (_) {}
        const payload = {
          status: 'OK',
          data: finalData,
          source: 'generated',
          response_time_ms: Date.now() - started,
          request_id: req.request_id
        };
        // Validación ok para datos generados externamente
        payload.data.ok = computeOk(payload.data);
        recordWebhookSuccess();
        return res.json(payload);
      }
            console.warn('❌ n8n sin "reply" válido en supersession forzada (alias); se continúa con persistencia local');
            recordWebhookFailure();
          } catch (e) {
            console.warn('❌ Error invocando n8n (alias, supersession forzada):', e.message);
            recordWebhookFailure();
          }
        }
      }
      if (accepted && String(accepted.sku || '').trim()) {
        try { await sheetsInstance.replaceOrInsertRow(accepted); } catch (_) {}
      }
      const stored = await sheetsInstance.findRowByQuery(normalizeQuery(q));
      if (stored && stored.found) {
        let finalData = { ...stored, original_query: q };
        try {
          const headers = await sheetsInstance.getHeaders();
          headers.forEach(h => { if (!(h in finalData)) finalData[h] = ''; });
        } catch (_) {}
        try {
          const v = await detectionService.verifyManufacturer(q, sheetsInstance);
          finalData.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
          finalData.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
          finalData.sector = v.sector;
        } catch (_) {}
        finalData.ok = computeOk(finalData);
        const payload = {
          status: 'OK',
          data: finalData,
          source: 'cache',
          response_time_ms: Date.now() - started,
          request_id: req.request_id
        };
        return res.json(payload);
      }
      // Fallback: devolver el enriquecido con padding aunque falle Google Sheets
      let finalData = { ...accepted, original_query: q };
      try {
        const headers = await sheetsInstance.getHeaders();
        headers.forEach(h => { if (!(h in finalData)) finalData[h] = ''; });
      } catch (_) {}
      try {
        const v = await detectionService.verifyManufacturer(q, sheetsInstance);
        finalData.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
        finalData.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
        finalData.sector = v.sector;
      } catch (_) {}
      finalData.ok = computeOk(finalData);
      const payload = {
        status: 'OK',
        data: finalData,
        source: 'generated',
        response_time_ms: Date.now() - started,
        request_id: req.request_id
      };
      return res.json(payload);
    }
    // Fallback local: enriquecer, persistir en Master y devolver la fila del Master
    try {
      const accepted = await detectionService.detectFilter(q, sheetsInstance);
      const queryNormLocal = normalizeQuery(q);
      const toStore = { ...accepted, query_norm: queryNormLocal };
      try { await sheetsInstance.replaceOrInsertRow(toStore); } catch (_) {}
      const stored = await sheetsInstance.findRowByQuery(queryNormLocal);
      let finalData = { ...(stored || accepted), original_query: q };
      try {
        const headers = await sheetsInstance.getHeaders();
        headers.forEach(h => { if (!(h in finalData)) finalData[h] = ''; });
      } catch (_) {}
      try {
        const v = await detectionService.verifyManufacturer(q, sheetsInstance);
        finalData.donaldson_fabrica = v.manufacturer === 'DONALDSON' && !!v.confirmed;
        finalData.fram_fabrica = v.manufacturer === 'FRAM' && !!v.confirmed;
        finalData.sector = v.sector;
      } catch (_) {}
      finalData.ok = computeOk(finalData);
      const payload = {
        status: 'OK',
        data: finalData,
        source: stored ? 'cache' : 'local',
        response_time_ms: Date.now() - started,
        request_id: req.request_id
      };
      return res.json(payload);
    } catch (e) {
      if (e && e.message === 'DISCONTINUED_NO_REPLACEMENT') {
        return res.status(422).json({
          status: 'ERROR',
          message: 'Código descontinuado sin reemplazo en Master. No se genera SKU.',
          details: e.context || { part: q },
          response_time_ms: Date.now() - started,
          request_id: req.request_id
        });
      }
      return res.status(422).json({
        status: 'ERROR',
        message: 'Código no validado en fuentes confiables. No se procesa',
        response_time_ms: Date.now() - started,
        request_id: req.request_id
      });
    }
  } catch (error) {
    console.error('💥 Error en alias /api/detect-filter:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Error interno del servidor', request_id: req.request_id });
  }
});

// Middleware global de manejo de errores
// Debe ir después de las rutas
app.use((err, req, res, _next) => {
  try {
    console.error('💥 Error middleware:', err);
  } catch (_) {}
  const status = typeof err?.status === 'number' ? err.status : 500;
  return res.status(status).json({ status: 'ERROR', message: err?.message || 'Error interno del servidor', request_id: req.request_id });
});

// Arrancar servidor inmediatamente y realizar inicialización en segundo plano
server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT} en 0.0.0.0 (Sheets: ${sheetsInstance ? 'ok' : 'pendiente'})`);
});

initializeServices().catch(err => {
  console.error('❌ Inicialización parcial: Google Sheets no disponible:', err?.message || err);
});

// Shutdown limpio: cerrar servidor y flush de pendientes
['SIGINT', 'SIGTERM'].forEach(sig => {
  process.on(sig, async () => {
    try { console.log(`🛑 Señal ${sig} recibida. Cerrando servidor...`); } catch (_) {}
    try { if (sheetsInstance && sheetsInstance.shutdown) await sheetsInstance.shutdown(); } catch (_) {}
    try {
      if (server) {
        server.close(() => {
          try { console.log('✅ Servidor HTTP cerrado'); } catch (_) {}
          process.exit(0);
        });
        // Fallback si close no retorna
        setTimeout(() => process.exit(0), 5000);
      } else {
        process.exit(0);
      }
    } catch (_) {
      process.exit(0);
    }
  });
});

// Assets y demo de WordPress (visualización rápida)
app.use('/wordpress-assets', express.static(path.join(__dirname, 'wordpress-integration', 'assets')));
// Alias adicional para compatibilidad con demo.html
app.use('/assets', express.static(path.join(__dirname, 'wordpress-integration', 'assets')));
// Página Part Search servida desde el mismo origen del API
app.get('/part-search', (req, res) => {
  res.sendFile(path.join(__dirname, 'wordpress-integration', 'part-search.html'));
});
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'wordpress-integration', 'demo.html'));
});
