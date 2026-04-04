import { execFileSync } from 'child_process';
import which from '../utils/which.js';

export type CodexExecutionMode = 'auto' | 'sandboxed' | 'unsafe';
export type EffectiveCodexExecutionMode = 'sandboxed' | 'unsafe';

export interface CodexRuntimeCompatibility {
  codexPath: string | null;
  bwrapPath: string | null;
  bwrapHasArgv0: boolean | null;
  reason: string | null;
}

export interface CodexRuntimeModeResult {
  configuredMode: CodexExecutionMode;
  effectiveMode: EffectiveCodexExecutionMode;
  compatibility: CodexRuntimeCompatibility;
}

export function getCodexExecutionMode(): CodexExecutionMode {
  const raw = String(process.env.RUNNER_CODEX_EXECUTION_MODE || 'auto').trim().toLowerCase();
  if (raw === 'sandboxed' || raw === 'unsafe') return raw;
  return 'auto';
}

export async function detectCodexRuntimeCompatibility(): Promise<CodexRuntimeCompatibility> {
  const codexPath = await which('codex');
  const bwrapPath = await which('bwrap');
  let bwrapHasArgv0: boolean | null = null;
  let reason: string | null = null;

  if (bwrapPath) {
    try {
      const help = execFileSync(bwrapPath, ['--help'], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      bwrapHasArgv0 = help.includes('--argv0');
    } catch {
      bwrapHasArgv0 = null;
    }
  }

  if (bwrapPath && bwrapHasArgv0 === false) {
    reason = '检测到 bwrap 不支持 --argv0，建议使用 RUNNER_CODEX_EXECUTION_MODE=unsafe';
  }

  return {
    codexPath,
    bwrapPath,
    bwrapHasArgv0,
    reason,
  };
}

export async function resolveCodexExecutionMode(): Promise<CodexRuntimeModeResult> {
  const configuredMode = getCodexExecutionMode();
  const compatibility = await detectCodexRuntimeCompatibility();

  if (configuredMode === 'sandboxed') {
    return {
      configuredMode,
      effectiveMode: 'sandboxed',
      compatibility,
    };
  }

  if (configuredMode === 'unsafe') {
    return {
      configuredMode,
      effectiveMode: 'unsafe',
      compatibility,
    };
  }

  return {
    configuredMode,
    effectiveMode: compatibility.bwrapPath && compatibility.bwrapHasArgv0 === false ? 'unsafe' : 'sandboxed',
    compatibility,
  };
}
