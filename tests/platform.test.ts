import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLinuxStatTpgid, parsePsNumber, platformSignalInfo, signalProcessGroup, type ProcessLookup } from '../src/platform.js';

function lookup(tpgid: string, pgid: string): ProcessLookup {
  return {
    platform: 'darwin',
    readFile: () => '',
    execFile: (_file, args) => args.includes('tpgid=') ? tpgid : pgid,
  };
}

function esrch(): NodeJS.ErrnoException {
  const err = new Error('missing process') as NodeJS.ErrnoException;
  err.code = 'ESRCH';
  return err;
}

test('parseLinuxStatTpgid reads Linux foreground process group from proc stat', () => {
  const stat = '12345 (bash with space) S 1 2 3 4 6789 0 0 0 0';
  assert.equal(parseLinuxStatTpgid(stat), 6789);
});

test('parseLinuxStatTpgid ignores missing or non-positive tpgid', () => {
  assert.equal(parseLinuxStatTpgid('bad stat'), undefined);
  assert.equal(parseLinuxStatTpgid('123 (bash) S 1 2 3 4 0 0'), undefined);
});

test('parsePsNumber accepts BSD ps numeric output and ignores zero', () => {
  assert.equal(parsePsNumber('  4242\n'), 4242);
  assert.equal(parsePsNumber('  0\n'), undefined);
  assert.equal(parsePsNumber(''), undefined);
});

test('platformSignalInfo prefers Linux /proc tpgid when present', () => {
  const info = platformSignalInfo(111, {
    platform: 'linux',
    readFile: () => '111 (bash) S 1 2 3 4 222 0 0 0',
    execFile: () => '333',
  });
  assert.equal(info.foregroundProcessGroup, 222);
  assert.equal(info.processGroup, 333);
  assert.deepEqual(info.preferredTarget, { mode: 'foreground-process-group', id: 222, source: 'linux-proc' });
});

test('platformSignalInfo uses BSD ps tpgid on macOS', () => {
  const info = platformSignalInfo(111, {
    platform: 'darwin',
    readFile: () => {
      throw new Error('not used');
    },
    execFile: (_file, args) => args.includes('tpgid=') ? '444' : '555',
  });
  assert.equal(info.foregroundProcessGroup, 444);
  assert.equal(info.processGroup, 555);
  assert.deepEqual(info.preferredTarget, { mode: 'foreground-process-group', id: 444, source: 'bsd-ps' });
});

test('platformSignalInfo falls back to process group then pid', () => {
  const processGroupInfo = platformSignalInfo(111, {
    platform: 'darwin',
    readFile: () => '',
    execFile: (_file, args) => args.includes('tpgid=') ? '0' : '555',
  });
  assert.deepEqual(processGroupInfo.preferredTarget, { mode: 'process-group', id: 555, source: 'posix-ps' });

  const pidInfo = platformSignalInfo(111, {
    platform: 'darwin',
    readFile: () => '',
    execFile: () => {
      throw new Error('ps unavailable');
    },
  });
  assert.deepEqual(pidInfo.preferredTarget, { mode: 'process', id: 111, source: 'pid' });
});

test('signalProcessGroup succeeds on foreground process group first', () => {
  const calls: number[] = [];
  const result = signalProcessGroup(111, 'INT', {
    lookup: lookup('444', '555'),
    kill: (pid) => {
      calls.push(pid);
    },
  });
  assert.equal(result.mode, 'foreground-process-group');
  assert.deepEqual(calls, [-444]);
});

test('signalProcessGroup falls back from tpgid to pgid on ESRCH', () => {
  const calls: number[] = [];
  const result = signalProcessGroup(111, 'TERM', {
    lookup: lookup('444', '555'),
    kill: (pid) => {
      calls.push(pid);
      if (pid === -444) throw esrch();
    },
  });
  assert.equal(result.mode, 'process-group');
  assert.deepEqual(calls, [-444, -555]);
});

test('signalProcessGroup falls back to pid after group ESRCH', () => {
  const calls: number[] = [];
  const result = signalProcessGroup(111, 'HUP', {
    lookup: lookup('444', '555'),
    kill: (pid) => {
      calls.push(pid);
      if (pid < 0) throw esrch();
    },
  });
  assert.equal(result.mode, 'process');
  assert.deepEqual(calls, [-444, -555, 111]);
});

test('signalProcessGroup dedupes equal tpgid and pgid', () => {
  const calls: number[] = [];
  const result = signalProcessGroup(111, 'INT', {
    lookup: lookup('444', '444'),
    kill: (pid) => {
      calls.push(pid);
      if (pid < 0) throw esrch();
    },
  });
  assert.equal(result.mode, 'process');
  assert.deepEqual(calls, [-444, 111]);
});
