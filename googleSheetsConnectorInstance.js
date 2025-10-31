const GoogleSheetsService = require('./googleSheetsConnector');

let instance;

module.exports = {
  async getInstance() {
    if (!instance) {
      instance = new GoogleSheetsService();
      await instance.initialize();
    }
    return instance;
  }
};
