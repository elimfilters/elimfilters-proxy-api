// googleSheetsConnectorInstance.js
// Puente Proxy para compartir UNA instancia del conector (factory.create()).

'use strict';

let _instance = null;

function setInstance(i) { _instance = i; }
function getInstance() {
  if (!_instance) throw new Error('Sheets instance no inicializada');
  return _instance;
}

module.exports = new Proxy({}, {
  get(_t, prop) {
    const inst = getInstance();
    const val = inst[prop];
    return (typeof val === 'function') ? val.bind(inst) : val;
  }
});

module.exports.setInstance = setInstance;
