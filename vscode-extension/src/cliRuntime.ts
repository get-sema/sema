export interface CliInvocation {
  executable: string;
  args: string[];
}

/** Quote one argument for a POSIX shell without allowing interpolation. */
function quotePosixArg(value: string): string {
  return "'" + value.replace(/'/g, "'\"'\"'") + "'";
}

/** True when Codex should be run inside WSL rather than natively on this host. */
export function codexUsesWsl(
  providerId: string,
  wsl: boolean,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return wsl && platform === 'win32' && providerId === 'codex';
}

/**
 * Resolve the host process used for a local CLI command.
 *
 * With `sema.chat.codexUseWsl` on, a Windows host runs Codex inside WSL — login,
 * status, logout, capability probes, and the chat itself — so every call sees the
 * same credential store. Off (the default), Codex runs natively like the other CLIs.
 */
export function resolveCliInvocation(
  providerId: string,
  cliBin: string,
  args: readonly string[],
  wsl: boolean,
  platform: NodeJS.Platform = process.platform,
): CliInvocation {
  if (codexUsesWsl(providerId, wsl, platform)) {
    // `wsl.exe -- codex ...` does not load the user's shell PATH, so a Codex
    // installed under ~/.local/bin is invisible. Login is launched in an
    // interactive WSL terminal; use a login shell here to resolve the same PATH.
    const command = [cliBin, ...args].map(quotePosixArg).join(' ');
    return {
      executable: 'wsl.exe',
      args: ['--', 'bash', '-lc', command],
    };
  }
  return {
    executable: cliBin,
    args: [...args],
  };
}
