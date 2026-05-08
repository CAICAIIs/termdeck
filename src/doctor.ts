import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { platform, release } from 'node:os';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { platformSignalInfo, socketAccessMode } from './platform.js';
import { rootDir, socketPath } from './paths.js';

const require = createRequire(import.meta.url);

export type DoctorStatus = 'pass' | 'warn' | 'fail' | 'info';

export type DoctorCheck = {
  name: string;
  status: DoctorStatus;
  detail: string;
  hint?: string;
};

export type DoctorReport = {
  ok: boolean;
  checks: DoctorCheck[];
};

export type DoctorOptions = {
  requireDaemon?: boolean;
  cwd?: string;
};

export type DoctorDeps = {
  nodeVersion?: string;
  platform?: NodeJS.Platform;
  release?: string;
  rootDir?: string;
  socketPath?: string;
  cwd?: string;
  exists?: (path: string) => boolean;
  statMode?: (path: string) => number;
  canReadWriteDir?: (path: string) => boolean;
  readFile?: (path: string) => string;
  daemonPing?: (path: string) => Promise<void>;
  smokePty?: () => Promise<void>;
  signalInfo?: (pid: number) => ReturnType<typeof platformSignalInfo>;
};

export async function runDoctor(options: DoctorOptions = {}, deps: DoctorDeps = {}): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const cwd = deps.cwd ?? options.cwd ?? process.cwd();
  const actualRoot = deps.rootDir ?? rootDir;
  const actualSocket = deps.socketPath ?? socketPath;
  const exists = deps.exists ?? existsSync;
  const statMode = deps.statMode ?? ((path) => statSync(path).mode & 0o777);
  const readFile = deps.readFile ?? ((path) => readFileSync(path, 'utf8'));
  const canReadWriteDir = deps.canReadWriteDir ?? defaultCanReadWriteDir;
  const daemonPing = deps.daemonPing ?? pingSocket;
  const smokePty = deps.smokePty ?? smokeNodePty;
  const signalInfo = deps.signalInfo ?? platformSignalInfo;

  checks.push(nodeVersionCheck(deps.nodeVersion ?? process.version));
  checks.push({
    name: 'platform',
    status: 'info',
    detail: `${deps.platform ?? platform()} ${deps.release ?? release()}`,
  });

  checks.push(directoryCheck('TERMDECK_HOME', actualRoot, exists, canReadWriteDir));
  checks.push(directoryCheck('socket directory', dirname(actualSocket), exists, canReadWriteDir));
  checks.push(socketModeCheck(actualSocket, exists, statMode));
  checks.push(pnpmApprovalCheck(cwd, exists, readFile));

  try {
    await smokePty();
    checks.push({ name: 'node-pty runtime', status: 'pass', detail: 'spawn smoke test succeeded' });
  } catch (err) {
    checks.push({
      name: 'node-pty runtime',
      status: 'fail',
      detail: err instanceof Error ? err.message : String(err),
      hint: 'run pnpm install or node scripts/install-check.mjs to rebuild native bindings',
    });
  }

  try {
    await daemonPing(actualSocket);
    checks.push({ name: 'daemon socket', status: 'pass', detail: `reachable at ${actualSocket}` });
  } catch (err) {
    checks.push({
      name: 'daemon socket',
      status: options.requireDaemon ? 'fail' : 'warn',
      detail: err instanceof Error ? err.message : String(err),
      hint: 'start termdeckd, or use termdeck step <session> ... --autostart',
    });
  }

  try {
    const info = signalInfo(process.pid);
    checks.push({
      name: 'signal strategy',
      status: 'info',
      detail: `${info.preferredTarget.mode} ${info.preferredTarget.id} via ${info.preferredTarget.source}`,
    });
  } catch (err) {
    checks.push({
      name: 'signal strategy',
      status: 'warn',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return { ok: !checks.some((check) => check.status === 'fail'), checks };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = ['TermDeck doctor'];
  for (const check of report.checks) {
    const marker = check.status.toUpperCase().padEnd(4, ' ');
    lines.push(`${marker} ${check.name}: ${check.detail}`);
    if (check.hint) lines.push(`     hint: ${check.hint}`);
  }
  lines.push(report.ok ? 'Result: ok' : 'Result: failed');
  return `${lines.join('\n')}\n`;
}

function nodeVersionCheck(version: string): DoctorCheck {
  const major = Number(version.replace(/^v/, '').split('.')[0]);
  if (Number.isInteger(major) && major >= 22) return { name: 'node version', status: 'pass', detail: version };
  return {
    name: 'node version',
    status: 'fail',
    detail: version,
    hint: 'TermDeck requires Node.js 22 or newer',
  };
}

function directoryCheck(name: string, path: string, exists: (path: string) => boolean, canReadWriteDir: (path: string) => boolean): DoctorCheck {
  if (!exists(path)) return { name, status: 'warn', detail: `${path} does not exist yet` };
  if (!canReadWriteDir(path)) return { name, status: 'fail', detail: `${path} is not readable and writable` };
  return { name, status: 'pass', detail: path };
}

function socketModeCheck(path: string, exists: (path: string) => boolean, statMode: (path: string) => number): DoctorCheck {
  if (!exists(path)) return { name: 'socket permissions', status: 'warn', detail: `${path} does not exist yet` };
  const mode = statMode(path);
  const expected = socketAccessMode();
  if (mode === expected) return { name: 'socket permissions', status: 'pass', detail: modeString(mode) };
  return {
    name: 'socket permissions',
    status: 'warn',
    detail: `${modeString(mode)} expected ${modeString(expected)}`,
    hint: 'restart termdeckd so it can recreate the socket with private permissions',
  };
}

function pnpmApprovalCheck(cwd: string, exists: (path: string) => boolean, readFile: (path: string) => string): DoctorCheck {
  const npmrc = join(cwd, '.npmrc');
  const workspace = join(cwd, 'pnpm-workspace.yaml');
  const npmrcOk = exists(npmrc) && readFile(npmrc).includes('only-built-dependencies[]=node-pty');
  const workspaceOk = exists(workspace) && /node-pty:\s*true/.test(readFile(workspace));
  if (npmrcOk && workspaceOk) return { name: 'pnpm build approvals', status: 'pass', detail: 'pnpm 10 and pnpm 11+ configs include node-pty' };
  if (npmrcOk || workspaceOk) return { name: 'pnpm build approvals', status: 'warn', detail: 'only one pnpm approval config includes node-pty' };
  return {
    name: 'pnpm build approvals',
    status: 'warn',
    detail: 'node-pty build approval was not found in this checkout',
    hint: 'keep .npmrc only-built-dependencies[] and pnpm-workspace.yaml allowBuilds in sync',
  };
}

function defaultCanReadWriteDir(path: string): boolean {
  try {
    accessSync(path, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function pingSocket(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    socket.once('connect', () => {
      socket.end();
      resolve();
    });
    socket.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') reject(new Error(`termdeckd is not running at ${path}`));
      else reject(err);
    });
  });
}

async function smokeNodePty(): Promise<void> {
  const pty = require('node-pty') as typeof import('node-pty');
  const shell = process.platform === 'win32' ? 'cmd.exe' : 'sh';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'echo termdeck-pty-ok'] : ['-c', 'printf termdeck-pty-ok'];
  const child = pty.spawn(shell, args, { cols: 20, rows: 5, cwd: process.cwd(), env: process.env });
  await new Promise<void>((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('node-pty smoke test timed out'));
    }, 3_000);
    child.onData((data: string) => {
      output += data;
      if (output.includes('termdeck-pty-ok')) {
        clearTimeout(timeout);
        child.kill();
        resolve();
      }
    });
    child.onExit(({ exitCode }: { exitCode: number }) => {
      if (!output.includes('termdeck-pty-ok')) {
        clearTimeout(timeout);
        reject(new Error(`node-pty smoke test exited ${exitCode}`));
      }
    });
  });
}

function modeString(mode: number): string {
  return `0${(mode & 0o777).toString(8)}`;
}
