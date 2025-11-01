// testParse.js
const { GoogleSheetsService } = require('./googleSheetsConnector');

try {
  const raw = process.env.GOOGLE_CREDENTIALS || require('fs').readFileSync('./key.json','utf8');
  const parsed = GoogleSheetsService.parseCredentials(raw);
  console.log('PARSE OK — type:', typeof parsed, 'keys:', Object.keys(parsed || {}).slice(0,6));
} catch (err) {
  console.error('PARSE ERROR:', err.message);
  process.exit(1);
}
