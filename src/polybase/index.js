const { Polybase } = require("@polybase/client");

const db = new Polybase({
	defaultNamespace: process.env.POLYBASE_NAMESPACE,
});

module.exports = { db };
