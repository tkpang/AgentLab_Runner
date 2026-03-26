import os from 'os';
import process from 'process';
import { spawn } from 'child_process';
import { ClaudeCodeAdapter } from './adapters/claude-code.js';
import { CodexAdapter } from './adapters/codex.js';
import { CustomCliAdapter } from './adapters/custom-cli.js';
import type { AdapterRunResult } from './adapters/base.js';
import type { HeartbeatOutputPayload } from './adapters/output.js';

type RunnerJobClaim = {
  id: string;
  companyId: string;
  heartbeatId: string;
  issueId: string | null;
  agentId: string;
  runnerEnvironmentId: string;
  prompt: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeEnv: Record<string, string>;
};

type RunnerApiResponse<T> = {
  ok?: boolean;
  error?: string;
} & T;

const SERVER = (process.env.RUNNER_SERVER || 'http://127.0.0.1:3200').replace(/\/+$/, '');
const TOKEN = String(process.env.RUNNER_TOKEN || '').trim();
const RUNNER_ID = String(process.env.RUNNER_ID || `${os.hostname()}-${process.pid}`).trim();
const HELLO_INTERVAL_MS = Math.max(10_000, Number.parseInt(process.env.RUNNER_HELLO_INTERVAL_MS || '30000', 10) || 30000);
const CONTROL_POLL_MS = Math.max(500, Number.parseInt(process.env.RUNNER_CONTROL_POLL_MS || '1200', 10) || 1200);
const HEALTH_INTERVAL_MS = Math.max(20_000, Number.parseInt(process.env.RUNNER_HEALTH_INTERVAL_MS || '60000', 10) || 60000);

if (!TOKEN) {
  console.error('Missing RUNNER_TOKEN');
  process.exit(1);
}

const adapters = {
  'claude-code': new ClaudeCodeAdapter(),
  codex: new CodexAdapter(),
  'custom-cli': new CustomCliAdapter(),
} as const;

async function apiPost<T>(path: string, payload: Record<string, unknown> = {}): Promise<RunnerApiResponse<T>> {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-runner-token': TOKEN,
    },
    body: JSON.stringify({ ...payload, token: TOKEN }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as RunnerApiResponse<T>;
}

function detectPlatform(): 'linux' | 'windows' | 'macos' | 'other' {
  if (process.platform === 'linux') return 'linux';
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'other';
}

async function hello(): Promise<void> {
  await apiPost('/api/runner/hello', {
    hello: {
      runnerId: RUNNER_ID,
      host: os.hostname(),
      platform: detectPlatform(),
      arch: process.arch,
      node: process.version,
      cwd: process.cwd(),
      pid: process.pid,
      ts: new Date().toISOString(),
    },
  });
}

async function runCommand(command: string, args: string[], timeoutMs = 8000): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      proc.kill('SIGTERM');
      resolve({ ok: false, output: 'timeout' });
    }, timeoutMs);
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('error', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: false, output: 'not_found' });
    });
    proc.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const output = (stdout || stderr || '').trim();
      resolve({ ok: code === 0, output });
    });
  });
}

async function collectHealthSnapshot(): Promise<Record<string, unknown>> {
  const codexVersion = await runCommand('codex', ['--version'], 6000);
  const claudeVersion = await runCommand('claude', ['--version'], 6000);
  const codexModels = codexVersion.ok ? await runCommand('codex', ['models'], 7000) : { ok: false, output: 'skipped' };
  const claudeModels = claudeVersion.ok ? await runCommand('claude', ['models'], 7000) : { ok: false, output: 'skipped' };

  return {
    checkedAt: new Date().toISOString(),
    platform: detectPlatform(),
    host: os.hostname(),
    node: process.version,
    adapters: {
      codex: {
        installed: codexVersion.ok,
        version: codexVersion.output || '',
        modelsProbe: codexModels.ok ? codexModels.output : '',
        modelsProbeOk: codexModels.ok,
      },
      claudeCode: {
        installed: claudeVersion.ok,
        version: claudeVersion.output || '',
        modelsProbe: claudeModels.ok ? claudeModels.output : '',
        modelsProbeOk: claudeModels.ok,
      },
    },
  };
}

async function reportHealth(): Promise<void> {
  const health = await collectHealthSnapshot();
  await apiPost('/api/runner/health', { health });
}

async function emitRunnerLog(level: 'info' | 'warn' | 'error', message: string): Promise<void> {
  await apiPost('/api/runner/log', {
    level,
    message,
  });
}

async function postOutput(jobId: string, payload: HeartbeatOutputPayload): Promise<void> {
  await apiPost('/api/runner/jobs/' + encodeURIComponent(jobId) + '/output', {
    chunk: payload.chunk,
    structured: payload.structured || null,
  });
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

async function executeJob(job: RunnerJobClaim): Promise<void> {
  const adapter = adapters[job.adapterType as keyof typeof adapters];
  if (!adapter) {
    await emitRunnerLog('error', `unsupported adapter: ${job.adapterType}, job=${job.id}`);
    await apiPost('/api/runner/jobs/' + encodeURIComponent(job.id) + '/complete', {
      success: false,
      error: `Runner 不支持的适配器: ${job.adapterType}`,
    });
    return;
  }

  const abortController = new AbortController();
  let controlTimer: NodeJS.Timeout | null = null;
  try {
    const initialControl = await apiPost<{ cancelRequested?: boolean; cancelReason?: string }>(
      '/api/runner/jobs/' + encodeURIComponent(job.id) + '/touch',
      { runnerId: RUNNER_ID },
    );
    if (initialControl.cancelRequested) {
      throw new Error(initialControl.cancelReason || '任务已被取消');
    }

    controlTimer = setInterval(() => {
      void apiPost<{ cancelRequested?: boolean; cancelReason?: string }>(
        '/api/runner/jobs/' + encodeURIComponent(job.id) + '/touch',
        { runnerId: RUNNER_ID },
      ).then((control) => {
        if (control.cancelRequested && !abortController.signal.aborted) {
          abortController.abort(control.cancelReason || '用户手动终止');
        }
      }).catch(() => {
        // Ignore transient control errors; next polling cycle will retry.
      });
    }, CONTROL_POLL_MS);

    const heartbeatOutputEmitter = async (payload: HeartbeatOutputPayload) => {
      await postOutput(job.id, payload);
    };

    const result: AdapterRunResult = await adapter.run(job.prompt, {
      ...job.adapterConfig,
      _envOverrides: job.runtimeEnv || {},
      _agentId: job.agentId,
      _heartbeatId: job.heartbeatId,
      _issueId: job.issueId,
      _abortSignal: abortController.signal,
      _heartbeatOutputEmitter: heartbeatOutputEmitter,
    });

    await apiPost('/api/runner/jobs/' + encodeURIComponent(job.id) + '/complete', {
      success: true,
      result,
    });
    await emitRunnerLog('info', `job=${job.id} success adapter=${job.adapterType} tokens=${result.tokenUsage} costCents=${result.costCents}`);
  } catch (err) {
    await apiPost('/api/runner/jobs/' + encodeURIComponent(job.id) + '/complete', {
      success: false,
      error: toErrorMessage(err),
    });
    await emitRunnerLog('error', `job=${job.id} failed: ${toErrorMessage(err)}`);
  } finally {
    if (controlTimer) clearInterval(controlTimer);
  }
}

let stopped = false;

async function runLoop(): Promise<void> {
  let lastHelloAt = 0;
  let lastHealthAt = 0;
  while (!stopped) {
    try {
      const now = Date.now();
      if (now - lastHelloAt > HELLO_INTERVAL_MS) {
        await hello();
        lastHelloAt = now;
      }
      if (now - lastHealthAt > HEALTH_INTERVAL_MS) {
        await reportHealth();
        lastHealthAt = now;
      }

      const claimRes = await apiPost<{ job: RunnerJobClaim | null; pollAfterMs?: number }>('/api/runner/jobs/claim', {
        runnerId: RUNNER_ID,
      });
      const job = claimRes.job || null;
      if (!job) {
        const delayMs = Math.max(300, Number(claimRes.pollAfterMs || 1200));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      await emitRunnerLog('info', `claimed job=${job.id} adapter=${job.adapterType} issue=${job.issueId || '-'}`);
      await executeJob(job);
    } catch (err) {
      const message = toErrorMessage(err);
      console.warn('[runner] loop error:', message);
      try {
        await emitRunnerLog('warn', `loop error: ${message}`);
      } catch {
        // ignore
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

async function shutdown(signal: string): Promise<void> {
  if (stopped) return;
  stopped = true;
  console.log(`[runner] received ${signal}, going offline...`);
  try {
    await apiPost('/api/runner/offline', { runnerId: RUNNER_ID });
  } catch {
    // ignore
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

console.log(`[runner] starting id=${RUNNER_ID} server=${SERVER} platform=${detectPlatform()}`);
void emitRunnerLog('info', `runner started id=${RUNNER_ID} server=${SERVER} platform=${detectPlatform()}`).catch(() => {});
void runLoop();
