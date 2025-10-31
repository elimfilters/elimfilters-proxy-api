// googleSheetsConnectorInstance.js
// pequeño puente para compartir la instancia

let _instance = null;

function setInstance(i) { _instance = i; }
function getInstance() {
  if (!_instance) throw new Error('Sheets instance no inicializada');
  return _instance;
}

// proxy simple a métodos usados
module.exports = new Proxy({}, {
  get(_, prop) {
    const inst = getInstance();
    const val = inst[prop];
    if (typeof val === 'function') return val.bind(inst);
    return val;
  }
});
module.exports.setInstance = setInstance;
