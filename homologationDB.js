// --- reemplaza estas utilidades en homologationDB.js ---

const clean = s => String(s ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');

// Core = 4 dígitos. Si hay sufijo de letras (…\d+[A-Z]+$), tomar los dígitos
// inmediatamente antes de las letras. Si no hay letras al final, tomar la
// última racha de dígitos al final. Pad a 4 con ceros por la izquierda.
function coreNumeric4(src) {
  const c = clean(src);

  // caso 1: termina en letras → capturar dígitos justo antes de las letras
  let m = c.match(/(\d+)[A-Z]+$/);
  if (m && m[1]) {
    const d = m[1];
    return d.slice(-4).padStart(4, '0');
  }

  // caso 2: termina en dígitos → tomar esa racha final
  m = c.match(/(\d+)$/);
  if (m && m[1]) {
    const d = m[1];
    return d.slice(-4).padStart(4, '0');
  }

  // sin dígitos → core 0000
  return '0000';
}
