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

async function loadCheckWith(): Promise<CheckWith> {
  const mod = await import('../scripts/install-check.mjs') as { checkWith: CheckWith };
  return mod.checkWith;
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
