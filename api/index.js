// api/index.js
// Vercel Serverless Function entry point
// Vercel's Node runtime natively supports an exported Express application.
// Exporting it directly preserves request metadata used by the workspace auth.
module.exports = require('../server.js');
