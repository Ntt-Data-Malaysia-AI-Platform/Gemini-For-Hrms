// `npm run dev` (or `node dev.js`): starts the API server and the Vite dev server together; Ctrl+C stops both.
// Both run through this Node binary directly (no shell), so paths with spaces work on Windows.
import { spawn } from 'node:child_process';

const node = (args) => spawn(process.execPath, args, { stdio: 'inherit' });
const procs = [
  node(['--use-system-ca', 'server/index.js']),
  node(['node_modules/vite/bin/vite.js']),
];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { if (code) stop(); }));
