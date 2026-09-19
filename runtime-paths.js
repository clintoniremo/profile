const path = require('path');
const os = require('os');

// Only generated files belong in the serverless runtime's writable directory.
const root = process.env.VERCEL ? path.join(os.tmpdir(), 'zuriel') : __dirname;
module.exports = {
  uploads: path.join(root, 'uploads'),
  applications: path.join(root, 'applications'),
};
