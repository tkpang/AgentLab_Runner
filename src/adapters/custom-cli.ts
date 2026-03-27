import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import which from '../utils/which.js';
import type { AgentAdapter, AdapterRunResult } from './base.js';
import { emitHeartbeatOutput } from './output.js';

const DEFAULT_TASK_TIMEOUT_MS = 3_599_000;

/**
 * 自定义 CLI 适配器 - 支持任意命令行工具
 * 配置示例: { command: "aider", args: ["--yes-always"], workDir: "/path/to/project" }
 */
export class CustomCliAdapter implements AgentAdapter {
  name = 'custom-cli';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async run(prompt: string, config: Record<string, unknown>): Promise<AdapterRunResult> {
    const command = (config.command as string) || 'echo';
    const baseArgs = (config.args as string[]) || [];
    let workDir = (config.workDir as string) || process.cwd();
    if (!fs.existsSync(workDir)) {
      console.warn(`[custom-cli] 工作目录不存在: ${workDir}，使用临时目录`);
      workDir = os.tmpdir();
    }
    const agentId = config._agentId as string;
    const heartbeatId = config._heartbeatId as string;
    const issueId = (config._issueId as string | null) || null;
    const abortSignal = config._abortSignal as AbortSignal | undefined;
    const envOverrides = (config._envOverrides as Record<string, string> | undefined) || {};

    const cmdPath = await which(command) || command;

    return new Promise((resolve, reject) => {
      const proc = spawn(cmdPath, [...baseArgs, prompt], {
        cwd: workDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...envOverrides },
        shell: process.platform === 'win32',
      });
      let timeoutHandle: NodeJS.Timeout | null = null;

      const onAbort = () => {
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 1500);
      };
      if (abortSignal) {
        if (abortSignal.aborted) onAbort();
        else abortSignal.addEventListener('abort', onAbort, { once: true });
      }

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        emitHeartbeatOutput(config, { heartbeatId, issueId, agentId, chunk });
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        const outputLog = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
        if (code === 0) {
          resolve({
            outputLog,
            debugLog: outputLog,
            tokenUsage: 0,
            costCents: 0,
            success: true,
          });
          return;
        }
        reject(new Error(`${command} 退出，错误码 ${code}: ${outputLog || '(无输出)'}`));
      });

      proc.on('error', (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        reject(new Error(`无法启动 ${command}: ${err.message}`));
      });

      const hardTimeout = typeof config.hardTimeoutMs === 'number'
        ? config.hardTimeoutMs
        : ((config.timeoutMs as number) || DEFAULT_TASK_TIMEOUT_MS);
      if (hardTimeout > 0) {
        timeoutHandle = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`${command} 超时`));
        }, hardTimeout);
      }
    });
  }
}
