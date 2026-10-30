import { spawn } from 'bun';

console.log('🚀 Starting Portfolio Tracker (Bun API server on :3000 + Vite on :5173)...');

const server = spawn(['bun', 'server/index.ts'], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: { ...process.env, PORT: '3000' },
});

const vite = spawn(['bun', 'x', 'vite', '--port', '5173'], {
  stdio: ['inherit', 'inherit', 'inherit'],
});

const cleanup = () => {
  try {
    server.kill();
    vite.kill();
  } catch {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
