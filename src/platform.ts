import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

export type SignalDeliveryMode = 'foreground-process-group' | 'process-group' | 'process';

export type SignalTarget = {
  mode: SignalDeliveryMode;
  id: number;
  source: 'linux-proc' | 'bsd-ps' | 'posix-ps' | 'pid';
};

export type PlatformSignalInfo = {
  platform: NodeJS.Platform;
  foregroundProcessGroup?: number;
  processGroup?: number;
  preferredTarget: SignalTarget;
};

export type SignalProcessOptions = {
  lookup?: ProcessLookup;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
};

export type ProcessLookup = {
  platform: NodeJS.Platform;
  readFile(path: string): string;
  execFile(file: string, args: string[]): string;
};

const defaultLookup: ProcessLookup = {
  platform: process.platform,
  readFile: (path) => readFileSync(path, 'utf8'),
  execFile: (file, args) => execFileSync(file, args, { encoding: 'utf8', timeout: 1_000 }),
};

export function signalProcessGroup(pid: number, signal: string, options: SignalProcessOptions = {}): { mode: SignalDeliveryMode; detail: string } {
  signal = normalizeSignal(signal);
  const lookup = options.lookup ?? defaultLookup;
  const kill = options.kill ?? ((targetPid, sig) => {
    process.kill(targetPid, sig);
  });
  const info = platformSignalInfo(pid, lookup);
  const targets = dedupeTargets([
    info.preferredTarget,
    info.processGroup ? { mode: 'process-group', id: info.processGroup, source: 'posix-ps' as const } : undefined,
    { mode: 'process', id: pid, source: 'pid' as const },
  ]);

  for (const target of targets) {
    try {
      const killPid = target.mode === 'process' ? target.id : -target.id;
      kill(killPid, signal as NodeJS.Signals);
      return { mode: target.mode, detail: `sent ${signal} to ${target.mode} ${target.id} (${target.source})` };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err;
    }
  }

  kill(pid, signal as NodeJS.Signals);
  return { mode: 'process', detail: `sent ${signal} to process ${pid}` };
}

export function platformSignalInfo(pid: number, lookup: ProcessLookup = defaultLookup): PlatformSignalInfo {
  const foregroundProcessGroup = foregroundProcessGroupForPid(pid, lookup);
  const processGroup = processGroupForPid(pid, lookup);
  const preferredTarget =
    foregroundProcessGroup !== undefined
      ? ({ mode: 'foreground-process-group', id: foregroundProcessGroup, source: foregroundSource(lookup.platform) } as const)
      : processGroup !== undefined
        ? ({ mode: 'process-group', id: processGroup, source: 'posix-ps' } as const)
        : ({ mode: 'process', id: pid, source: 'pid' } as const);

  return {
    platform: lookup.platform,
    foregroundProcessGroup,
    processGroup,
    preferredTarget,
  };
}

export function parseLinuxStatTpgid(stat: string): number | undefined {
  const end = stat.lastIndexOf(')');
  if (end === -1) return undefined;
  const fields = stat.slice(end + 2).trim().split(/\s+/);
  return positiveInteger(fields[5]);
}

export function parsePsNumber(output: string): number | undefined {
  return positiveInteger(output.trim().split(/\s+/)[0]);
}

function foregroundProcessGroupForPid(pid: number, lookup: ProcessLookup): number | undefined {
  if (lookup.platform === 'linux') {
    try {
      return parseLinuxStatTpgid(lookup.readFile(`/proc/${pid}/stat`));
    } catch {
      return undefined;
    }
  }

  if (lookup.platform === 'darwin' || lookup.platform === 'freebsd' || lookup.platform === 'openbsd' || lookup.platform === 'netbsd') {
    try {
      return parsePsNumber(lookup.execFile('ps', ['-o', 'tpgid=', '-p', String(pid)]));
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function processGroupForPid(pid: number, lookup: ProcessLookup): number | undefined {
  try {
    return parsePsNumber(lookup.execFile('ps', ['-o', 'pgid=', '-p', String(pid)]));
  } catch {
    return undefined;
  }
}

function foregroundSource(platform: NodeJS.Platform): 'linux-proc' | 'bsd-ps' {
  return platform === 'linux' ? 'linux-proc' : 'bsd-ps';
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function dedupeTargets(targets: Array<SignalTarget | undefined>): SignalTarget[] {
  const seen = new Set<string>();
  const out: SignalTarget[] = [];
  for (const target of targets) {
    if (!target) continue;
    const killPid = target.mode === 'process' ? target.id : -target.id;
    const key = String(killPid);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

function normalizeSignal(signal: string): string {
  const s = signal.toUpperCase();
  return s.startsWith('SIG') ? s : `SIG${s}`;
}

export function socketAccessMode(): number {
  return 0o600;
}
