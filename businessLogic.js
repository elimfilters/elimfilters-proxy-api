const { getRuleEngine } = require('./rulesProtection');

function enrich(records, ctx = {}) {
  const engine = getRuleEngine();
  const items = records.map(r => {
    const input = {
      family: String(r.Family || r.FAMILIA || '').toUpperCase(),
      size: Number(r.Size || r.SIZE || 0)
    };
    const decision = engine.evaluate(input);
    return { ...r, decision };
  });

  const summary = { count: items.length };
  return { items, summary };
}

module.exports = { enrich };
