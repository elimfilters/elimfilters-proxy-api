// ============================================================================
// GOOGLE SHEETS CONNECTOR — ELIMFILTERS API
// Lee / escribe en el MASTER DB y en UNKNOWN CODES.
// ============================================================================

const { google } = require("googleapis");

// ============================================================================
// CONFIG
// ============================================================================
const SPREADSHEET_ID = "1ZYI5c0enkuvWAveu8HMaCUk1cek_VDrX8GtgKW7VP6U";

// Rango principal del Master Sheet
const MASTER_RANGE = "MASTER!A:AZ";

// Sheet donde se guardan códigos desconocidos
const UNKNOWN_RANGE = "UNKNOWN!A:A";

// ============================================================================
// AUTENTICACIÓN GOOGLE SERVICE ACCOUNT
// ============================================================================
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: "elimfilters-railway",
    client_email: "elimfilters-railway@gen-lang-client-0000922456.iam.gserviceaccount.com",
    private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC4job4vYUaJw8v
LOZQvjFzZCnsrwHOG/QBaxejVZ2B777lNaYpNIrsA68+0DaldLu2LbVrttkdp3w1
6vqhkAYFE4fNiLhzCm9BQKN6tiVW0BbmzDjKmt5TW0MVTuHbDaOett+U4jWJYCUJ
wF4J9I+vKnId2WKaImzERaaVBRcMzDJF4Ru2CjsTJipnZKfuxDwRg+1d8L/9nVIL
qtxN+A97t3Bd/mg7xd9/x6SQVPxD/eS7SLKsFnlES2NyyAAGNYMt6yUh6vACF7WS
eNHxdYoVVB8vH0qIvmfV/TRkAtQaKbEBaLc9AfFaA9mP/GDXjekwk+l60//pn4MN
KzRZTC8/AgMBAAECggEAUw0wh/chUqeJGb2m12b/ceH9S9llgo7pu0mqFYKNos90
pEkEQT631YXC8w1XyhVB87WWEqbyBXo9VzYrG1FopBgp4MBJ4NstPbwM1Ufqfaqe
47W7SNFwgypqgchBswXsP5wj+Sfi17NAd6btqqU3k6gSOoR87sfXEmwVjrH/sW3d
Io+jh9ZmhRu/nnflsUr0BtdfxIIhTF87gySXWXYugo9u3yLpJTAn86cFZygBA2al
AwugQLEeib97lQKQCSPQ2Y+qqM3FraDw+u0e2+slZWiWI9j8NsZFfx9g2j7A9a4w
oUE0gRG9CaX26X+UaZoW1QpVmL5xa7zG68L7RBxFoQKBgQD5hVGbqpIsBi7PdzM6
tvEPtilduH/ntDY/YCYga8Qxle6C0WQ8i+5gYnJ0G64rbBjkwE29/Z3l7bgFomyY
KwKxIeHu98TkRqDxlR4CXfpY6iQBCS9ubEiPA8NPHs1tDHccUnKCPjHxGZ4NoxM0
J4PLaFSOa7heOlFvZI19ZgWf5QKBgQC9WVy4MZOAu32L8gmZlN9Qc49HtGyGFGnR
IVyTEXrNd85DOBM9xpuOxonaMGl/HVcORVkFlok/mayhyzwCMeYamj/3Em4j8C7M
6ggN9hJ++WpHougMB1QGrQg1q7WQ0caqE5pRuY8NzFVDrwz0oyLebGZKQwz13W40
o6JpFA54UwKBgQDi6qtctbJY9wZ7BhxAuT5g23ijEra/MNRkrjv+IAM8VO2jammN
5nPSk7UigknSk2vQHFKXBZ4jDBzeguffOr4n+HhPqmQUdWbITKQN4wlY8xXrGz9X
XIJgDTwBKDIJidyIlTIt4AHrETD7leJQ+96PjUHYg34Xs1F7zCYgdDeJQQKBgQCV
DPQs1nG7Q1u3vwaJjCQiC2V9V2yaOxV1F2LtLjRR635Fca3L0jx/ro+zXqqc8nal
+Db0bCSMGSdIkVgiji8JP+UcU7i5t4bPrWY7vzmeFC3ySC2L0nT1cF3nCcy6PDe7
iATRUlVm0jNIPVLgfE6lcgUvbgqUvALVkv3042HkmwKBgFgK+JFv7mwQZdtvx3Xg
ZXECtYvN/jNPaWGR1LQXN8qmTMUYG4kv0ZQ9G3+Ld4pkjH1HNsWH4Y8FwdkYdRiR
fFN6OY+0vMDPrOT908NL+ksmHJ68Qefnec2bV36/Z67VEXNaoo1xdbCakvpjCbPq
/OCZYggj+FkuRuySH8yEkO+n
-----END PRIVATE KEY-----`
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheetsClient = google.sheets({ version: "v4", auth });

// ============================================================================
// LEER TODAS LAS FILAS DEL MASTER
// ============================================================================
async function readAllRows() {
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: MASTER_RANGE
  });

  const [header, ...rows] = res.data.values;
  if (!header) return [];

  return rows.map((r, idx) => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = r[i] || "";
    });
    obj._rowIndex = idx + 2;
    return obj;
  });
}

// ============================================================================
// BUSCAR POR SKU
// ============================================================================
async function findRowBySKU(sku) {
  const rows = await readAllRows();
  return rows.find(r => r.sku === sku) || null;
}

// ============================================================================
// BUSCAR POR OEM / CROSS
// ============================================================================
async function findRowByOEM(code) {
  const rows = await readAllRows();
  return (
    rows.find(r =>
      (r.oem_codes || "").toUpperCase().includes(code.toUpperCase()) ||
      (r.cross_reference || "").toUpperCase().includes(code.toUpperCase())
    ) || null
  );
}

// ============================================================================
// BUSCAR POR query_norm
// ============================================================================
async function findRowByQueryNorm(q) {
  const rows = await readAllRows();
  return rows.find(r => r.query_norm === q) || null;
}

// ============================================================================
// INSERTAR NUEVA FILA
// ============================================================================
async function insertRow(record) {
  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: MASTER_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [Object.values(record)]
    }
  });
}

// ============================================================================
// ACTUALIZAR FILA EXISTENTE
// ============================================================================
async function updateRow(rowIndex, record) {
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `MASTER!A${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [Object.values(record)]
    }
  });
}

// ============================================================================
// GUARDAR CÓDIGO DESCONOCIDO
// ============================================================================
async function saveUnknownCode(code) {
  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: UNKNOWN_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[code]]
    }
  });
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  readAllRows,
  findRowBySKU,
  findRowByOEM,
  findRowByQueryNorm,
  insertRow,
  updateRow,
  saveUnknownCode
};
