import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export function nodePtyRoot() {
  const pkg = require.resolve('node-pty/package.json');
  return pkg.slice(0, -'package.json'.length);
}

export function nativeExists(root) {
  const native = [
    join(root, 'build/Release/pty.node'),
    join(root, 'build/Debug/pty.node'),
    join(root, 'prebuilds'),
  ];
  return native.some(existsSync);
}

export function smokeSpawn() {
  const code = `
    const pty = require('node-pty');
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const p = pty.spawn(shell, [], { cwd: process.cwd(), cols: 20, rows: 5, env: process.env });
    p.kill();
  `;
  const res = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
  return res.status === 0 ? undefined : (res.stderr || res.stdout || `exit ${res.status}`).trim();
}

export function rebuildFromSource(root) {
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'node scripts\\prebuild.js || node-gyp rebuild']
    : ['-lc', 'node scripts/prebuild.js || node-gyp rebuild'];
  const pathPrefix = [
    join(process.cwd(), 'node_modules', '.bin'),
    join(root, 'node_modules', '.bin'),
    process.env.PATH ?? '',
  ].join(process.platform === 'win32' ? ';' : ':');
  const res = spawnSync(shell, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PATH: pathPrefix, npm_config_build_from_source: 'true' },
  });
  if (res.error) {
    throw new Error(`node-pty source rebuild failed to start: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`node-pty source rebuild failed with exit code ${res.status}`);
  }
}

export function checkWith(deps = {}) {
  const root = (deps.nodePtyRoot ?? nodePtyRoot)();
  const hasNative = (deps.nativeExists ?? nativeExists)(root);
  if (!hasNative) {
    throw new Error('node-pty native binding is missing. pnpm users must allow node-pty build scripts or install a package with prebuilt bindings.');
  }

  const runSmoke = deps.smokeSpawn ?? smokeSpawn;
  const smokeError = runSmoke();
  if (!smokeError) return { rebuilt: false };

  const platform = deps.platform ?? process.platform;
  if (platform === 'win32') {
    throw new Error(`node-pty native binding failed runtime smoke test: ${smokeError}`);
  }

  (deps.log ?? console.error)(`node-pty native binding failed runtime smoke test, rebuilding from source: ${smokeError}`);
  (deps.rebuildFromSource ?? rebuildFromSource)(root);

  const retryError = runSmoke();
  if (retryError) {
    throw new Error(`node-pty native binding still fails after source rebuild: ${retryError}`);
  }
  return { rebuilt: true };
}

function isMain() {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMain()) {
  try {
    checkWith();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
