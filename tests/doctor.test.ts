import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDoctorReport, runDoctor } from '../src/doctor.js';

const baseDeps = {
  nodeVersion: 'v24.11.1',
  platform: 'darwin' as NodeJS.Platform,
  release: '25.0.0',
  rootDir: '/tmp/termdeck',
  socketPath: '/tmp/termdeck/termdeckd.sock',
  cwd: '/repo',
  exists: (path: string) => !path.endsWith('missing'),
  statMode: () => 0o600,
  canReadWriteDir: () => true,
  readFile: (path: string) => path.endsWith('.npmrc') ? 'only-built-dependencies[]=node-pty\n' : "allowBuilds:\n  node-pty: true\n",
  daemonPing: async () => {},
  smokePty: async () => {},
  signalInfo: () => ({
    platform: 'darwin' as NodeJS.Platform,
    foregroundProcessGroup: 10,
    processGroup: 10,
    preferredTarget: { mode: 'foreground-process-group' as const, id: 10, source: 'bsd-ps' as const },
  }),
};

test('doctor passes when runtime, approvals, pty, daemon, and permissions are healthy', async () => {
  const report = await runDoctor({}, baseDeps);
  assert.equal(report.ok, true);
  assert.equal(report.checks.find((check) => check.name === 'node-pty runtime')?.status, 'pass');
  assert.equal(report.checks.find((check) => check.name === 'daemon socket')?.status, 'pass');
});

test('doctor treats missing daemon as warning unless required', async () => {
  const deps = {
    ...baseDeps,
    daemonPing: async () => {
      throw new Error('termdeckd is not running');
    },
  };
  const optional = await runDoctor({}, deps);
  assert.equal(optional.ok, true);
  assert.equal(optional.checks.find((check) => check.name === 'daemon socket')?.status, 'warn');

  const required = await runDoctor({ requireDaemon: true }, deps);
  assert.equal(required.ok, false);
  assert.equal(required.checks.find((check) => check.name === 'daemon socket')?.status, 'fail');
});

test('doctor fails old node and node-pty smoke errors', async () => {
  const report = await runDoctor({}, {
    ...baseDeps,
    nodeVersion: 'v20.0.0',
    smokePty: async () => {
      throw new Error('native binding missing');
    },
  });
  assert.equal(report.ok, false);
  assert.equal(report.checks.find((check) => check.name === 'node version')?.status, 'fail');
  assert.equal(report.checks.find((check) => check.name === 'node-pty runtime')?.status, 'fail');
});

test('doctor formats a compact agent-readable report', async () => {
  const text = formatDoctorReport(await runDoctor({}, baseDeps));
  assert.match(text, /^TermDeck doctor/);
  assert.match(text, /PASS node version: v24\.11\.1/);
  assert.match(text, /Result: ok/);
});
