export interface CliInvocation {
  executable: string;
  args: string[];
}

/** Quote one argument for a POSIX shell without allowing interpolation. */
function quotePosixArg(value: string): string {
  return "'" + value.replace(/'/g, "'\"'\"'") + "'";
}

/**
 * Resolve the host process used for a local CLI control command.
 *
 * On Windows, sema launches Codex login inside WSL. Status, logout, and
 * capability probes must use that same runtime or they may observe the Windows
 * credential store while the interactive login updated the WSL credential
 * store (or vice versa).
 */
export function resolveCliInvocation(
  providerId: string,
  cliBin: string,
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
): CliInvocation {
  if (platform === 'win32' && providerId === 'codex') {
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
