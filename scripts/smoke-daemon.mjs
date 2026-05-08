#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const built = process.argv.includes('--built');
const root = mkdtempSync(join(tmpdir(), 'termdeck-smoke-'));
const port = String(8900 + Math.floor(Math.random() * 500));
const env = { ...process.env, TERMDECK_HOME: root, TERMDECK_WEB_PORT: port };
const daemonArgs = built ? ['dist/daemon.js'] : ['--import', 'tsx', 'src/daemon.ts'];
const cliPrefix = built ? [process.execPath, 'dist/cli.js'] : [process.execPath, '--import', 'tsx', 'src/cli.ts'];

function run(args, options = {}) {
  return new Promise((resolve, reject) => {
    const [cmd, ...rest] = args;
    const child = spawn(cmd, rest, { env, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} ${rest.join(' ')} failed with ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
  });
}

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      await run([...cliPrefix, 'list']);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('termdeckd did not become ready');
}

const daemon = spawn(process.execPath, daemonArgs, { env, stdio: ['ignore', 'pipe', 'pipe'] });
let daemonOutput = '';
let daemonExited = false;
daemon.stdout.on('data', (chunk) => { daemonOutput += String(chunk); });
daemon.stderr.on('data', (chunk) => { daemonOutput += String(chunk); });
daemon.once('exit', () => { daemonExited = true; });

try {
  await waitReady();
  await run([...cliPrefix, 'doctor', '--require-daemon']);
  await run([...cliPrefix, 'new', 'smoke', '--cwd', process.cwd(), '--rows', '24', '--cols', '80']);
  const step = await run([...cliPrefix, 'step', 'smoke', 'printf smoke-ok', '--timeout-ms', '5000', '--lines', '4']);
  if (!step.stdout.includes('smoke-ok') || !step.stdout.includes('[termdeck] status=ready')) throw new Error(`unexpected step output:\n${step.stdout}`);
  const state = await run([...cliPrefix, 'state', 'smoke', '--lines', '4', '--json']);
  const parsed = JSON.parse(state.stdout);
  if (!parsed.ok || parsed.status !== 'ready') throw new Error(`unexpected state json:\n${state.stdout}`);
  const log = await run([...cliPrefix, 'log', 'smoke', '--lines', '20']);
  if (!log.stdout.includes('smoke-ok')) throw new Error(`log did not include command output:\n${log.stdout}`);
  const res = await fetch(`http://127.0.0.1:${port}/api/sessions`);
  if (res.status !== 200 || !(await res.text()).includes('smoke')) throw new Error(`web API smoke failed with ${res.status}`);
  console.log(`termdeck daemon smoke passed (${built ? 'built' : 'source'})`);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  if (daemonOutput) console.error(`\ntermdeckd output:\n${daemonOutput}`);
  process.exitCode = 1;
} finally {
  if (!daemonExited) {
    daemon.kill('SIGTERM');
    await new Promise((resolve) => daemon.once('exit', resolve));
  }
  rmSync(root, { recursive: true, force: true });
}
