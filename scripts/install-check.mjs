import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function nodePtyRoot() {
  const pkg = require.resolve('node-pty/package.json');
  return pkg.slice(0, -'package.json'.length);
}

function nativeExists(root) {
  const native = [
    join(root, 'build/Release/pty.node'),
    join(root, 'build/Debug/pty.node'),
    join(root, 'prebuilds'),
  ];
  return native.some(existsSync);
}

function smokeSpawn() {
  const code = `
    const pty = require('node-pty');
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const p = pty.spawn(shell, [], { cwd: process.cwd(), cols: 20, rows: 5, env: process.env });
    p.kill();
  `;
  const res = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
  return res.status === 0 ? undefined : (res.stderr || res.stdout || `exit ${res.status}`).trim();
}

function rebuildFromSource(root) {
  const nodeGyp = require.resolve('node-gyp/bin/node-gyp.js');
  execFileSync(process.execPath, [nodeGyp, 'rebuild'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, npm_config_build_from_source: 'true' },
  });
}

function check() {
  const root = nodePtyRoot();
  if (!nativeExists(root)) {
    throw new Error('node-pty native binding is missing. pnpm users must allow node-pty build scripts or install a package with prebuilt bindings.');
  }

  const smokeError = smokeSpawn();
  if (!smokeError) return;

  if (process.platform === 'win32') {
    throw new Error(`node-pty native binding failed runtime smoke test: ${smokeError}`);
  }

  console.error(`node-pty native binding failed runtime smoke test, rebuilding from source: ${smokeError}`);
  rebuildFromSource(root);

  const retryError = smokeSpawn();
  if (retryError) {
    throw new Error(`node-pty native binding still fails after source rebuild: ${retryError}`);
  }
}

try {
  check();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
