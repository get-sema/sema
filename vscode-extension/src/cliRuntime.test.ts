import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCliInvocation } from './cliRuntime';

test('Codex control commands use WSL on Windows', () => {
  assert.deepEqual(
    resolveCliInvocation('codex', 'codex', ['login', 'status'], true, 'win32'),
    {
      executable: 'wsl.exe',
      args: ['--', 'bash', '-lc', "'codex' 'login' 'status'"],
    },
  );
});

test('a configured Codex path is passed to the WSL runtime', () => {
  assert.deepEqual(
    resolveCliInvocation('codex', '/opt/codex/bin/codex', ['logout'], true, 'win32'),
    {
      executable: 'wsl.exe',
      args: ['--', 'bash', '-lc', "'/opt/codex/bin/codex' 'logout'"],
    },
  );
});

test('configured paths and arguments cannot inject WSL shell syntax', () => {
  assert.deepEqual(
    resolveCliInvocation('codex', "/opt/user's bin/codex", ['-c', 'key=$(unsafe)'], true, 'win32'),
    {
      executable: 'wsl.exe',
      args: [
        '--',
        'bash',
        '-lc',
        "'/opt/user'\"'\"'s bin/codex' '-c' 'key=$(unsafe)'",
      ],
    },
  );
});

test('other Windows CLIs continue to execute natively', () => {
  assert.deepEqual(
    resolveCliInvocation('claude-code', 'claude.exe', ['auth', 'status'], true, 'win32'),
    {
      executable: 'claude.exe',
      args: ['auth', 'status'],
    },
  );
});

test('Codex executes directly when the extension host is already Linux', () => {
  assert.deepEqual(
    resolveCliInvocation('codex', 'codex', ['login', 'status'], true, 'linux'),
    {
      executable: 'codex',
      args: ['login', 'status'],
    },
  );
});

test('Codex runs natively on Windows unless WSL is opted into', () => {
  assert.deepEqual(
    resolveCliInvocation('codex', 'codex.exe', ['login', 'status'], false, 'win32'),
    {
      executable: 'codex.exe',
      args: ['login', 'status'],
    },
  );
});
