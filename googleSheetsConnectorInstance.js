// googleSheetsConnectorInstance.js
// Puente para compartir UNA sola instancia del servicio de Google Sheets.

let _instance = null;

function setInstance(i) {
  _instance = i;
}

function getInstance() {
  if (!_instance) throw new Error('Sheets instance no inicializada');
  return _instance;
}

// Proxy: expone los métodos/props de la instancia real
module.exports = new Proxy({}, {
  get(_t, prop) {
    const inst = getInstance();
    const val = inst[prop];
    return typeof val === 'function' ? val.bind(inst) : val;
  }
});

// Permite inyectar la instancia desde server.js
module.exports.setInstance = setInstance;
