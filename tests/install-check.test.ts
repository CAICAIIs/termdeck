import test from 'node:test';
import assert from 'node:assert/strict';

type CheckWith = (deps: {
  nodePtyRoot?: () => string;
  nativeExists?: (root: string) => boolean;
  smokeSpawn?: () => string | undefined;
  rebuildFromSource?: (root: string) => void;
  platform?: NodeJS.Platform;
  log?: (message: string) => void;
}) => { rebuilt: boolean };

type RebuildFromSource = (root: string, options?: {
  platform?: NodeJS.Platform;
  execPath?: string;
  env?: NodeJS.ProcessEnv;
  pathDelimiter?: string;
  spawnSync?: (command: string, args: string[], options: {
    cwd: string;
    stdio: 'inherit';
    env: NodeJS.ProcessEnv;
  }) => { error?: unknown; status: number | null };
}) => void;

async function loadCheckWith(): Promise<CheckWith> {
  const mod = await import('../scripts/install-check.mjs') as { checkWith: CheckWith };
  return mod.checkWith;
}

async function loadRebuildFromSource(): Promise<RebuildFromSource> {
  const mod = await import('../scripts/install-check.mjs') as { rebuildFromSource: RebuildFromSource };
  return mod.rebuildFromSource;
}

test('install check passes without rebuild when runtime smoke succeeds', async () => {
  const checkWith = await loadCheckWith();
  const result = checkWith({
    nodePtyRoot: () => '/node-pty',
    nativeExists: () => true,
    smokeSpawn: () => undefined,
  });
  assert.deepEqual(result, { rebuilt: false });
});

test('install check rebuilds from source and retries smoke on non-Windows', async () => {
  const checkWith = await loadCheckWith();
  const events: string[] = [];
  const result = checkWith({
    nodePtyRoot: () => '/node-pty',
    nativeExists: () => true,
    smokeSpawn: () => events.length === 0 ? 'posix_spawnp failed' : undefined,
    rebuildFromSource: (root) => {
      events.push(root);
    },
    platform: 'darwin',
    log: () => {},
  });
  assert.deepEqual(result, { rebuilt: true });
  assert.deepEqual(events, ['/node-pty']);
});

test('install check fails when native binding is absent', async () => {
  const checkWith = await loadCheckWith();
  assert.throws(() => checkWith({
    nodePtyRoot: () => '/node-pty',
    nativeExists: () => false,
  }), /native binding is missing/);
});

test('install check does not auto-rebuild on Windows smoke failure', async () => {
  const checkWith = await loadCheckWith();
  assert.throws(() => checkWith({
    nodePtyRoot: () => '/node-pty',
    nativeExists: () => true,
    smokeSpawn: () => 'spawn failed',
    platform: 'win32',
  }), /runtime smoke test/);
});

test('node-pty rebuild uses the current Node runtime directory first', async () => {
  const rebuildFromSource = await loadRebuildFromSource();
  const calls: Array<{ command: string; args: string[]; env: NodeJS.ProcessEnv; cwd: string }> = [];
  rebuildFromSource('/node-pty', {
    execPath: '/opt/node-v25/bin/node',
    env: { PATH: '/usr/local/bin' },
    pathDelimiter: ':',
    spawnSync: (command, args, options) => {
      calls.push({ command, args, env: options.env, cwd: options.cwd });
      return { error: undefined, status: 0 };
    },
  });

  assert.deepEqual(calls, [{
    command: '/bin/sh',
    args: ['-lc', 'node scripts/prebuild.js || node-gyp rebuild'],
    env: {
      PATH: `/opt/node-v25/bin:${process.cwd()}/node_modules/.bin:/node-pty/node_modules/.bin:/usr/local/bin`,
      npm_config_build_from_source: 'true',
    },
    cwd: '/node-pty',
  }]);
});
