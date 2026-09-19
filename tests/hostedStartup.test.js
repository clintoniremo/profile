const {spawnSync} = require('child_process');
const path = require('path');

test('hosted API starts with read-only application files and returns a controlled setup response', () => {
  const script = `
    const fs = require('fs'), path = require('path'), os = require('os');
    const mkdir = fs.mkdirSync;
    fs.mkdirSync = function(target, options) {
      const relative = path.relative(os.tmpdir(), path.resolve(target));
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Read-only application directory');
      return mkdir.call(fs, target, options);
    };
    const app = require('./api');
    const server = app.listen(0, '127.0.0.1', async () => {
      try {
        const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/career-desk/state');
        const body = await response.json();
        if (response.status !== 503 || !body.error.includes('CAREER_DESK_TOKEN')) throw Error(JSON.stringify(body));
        console.log('HOSTED_STARTUP_OK');
      } catch (error) { console.error(error); process.exitCode = 1; }
      finally { server.close(); }
    });
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: {...process.env, VERCEL:'1', CAREER_DESK_TOKEN:''},
    encoding: 'utf8', timeout: 15000,
  });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('HOSTED_STARTUP_OK');
});

test('hosted storage never silently saves applications in process memory', async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    const {createStore} = require('../career-desk-server');
    await expect(createStore({revision:0,data:{}}).read()).rejects.toThrow('durable hosted storage');
  } finally {
    if(previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});
