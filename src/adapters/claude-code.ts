import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import which from '../utils/which.js';
import type { AgentAdapter, AdapterRunResult } from './base.js';
import { emitHeartbeatOutput } from './output.js';
import { buildEffortSystemPrompt, normalizeReasoningEffort } from '../services/reasoning-effort.js';

const DEFAULT_TASK_TIMEOUT_MS = 3_599_000;
let cachedClaudeNoSessionPersistenceSupport: boolean | null = null;

function supportsClaudeNoSessionPersistence(claudePath: string): boolean {
  if (cachedClaudeNoSessionPersistenceSupport !== null) {
    return cachedClaudeNoSessionPersistenceSupport;
  }
  try {
    const claudeCommand = process.platform === 'win32' ? 'claude' : claudePath;
    const out = spawnSync(claudeCommand, ['--help'], {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 512 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    const help = `${out.stdout || ''}\n${out.stderr || ''}`;
    cachedClaudeNoSessionPersistenceSupport = help.includes('--no-session-persistence');
  } catch {
    cachedClaudeNoSessionPersistenceSupport = false;
  }
  return cachedClaudeNoSessionPersistenceSupport;
}

function parsePersistSession(config: Record<string, unknown>): boolean {
  const raw = config.persistSession ?? config.sessionPersistence;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  // Default to ephemeral sessions to avoid polluting local plugin history.
  return false;
}

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';

  async isAvailable(): Promise<boolean> {
    return (await which('claude')) !== null;
  }

  async run(prompt: string, config: Record<string, unknown>): Promise<AdapterRunResult> {
    let workDir = (config.workDir as string) || process.cwd();
    if (!fs.existsSync(workDir)) {
      console.warn(`[claude-code] 工作目录不存在: ${workDir}，使用临时目录`);
      workDir = os.tmpdir();
    }
    const model = (config.model as string) || '';
    const agentId = config._agentId as string;
    const heartbeatId = config._heartbeatId as string;
    const issueId = (config._issueId as string | null) || null;
    const abortSignal = config._abortSignal as AbortSignal | undefined;
    const envOverrides = (config._envOverrides as Record<string, string> | undefined) || {};
    const reasoningEffort = normalizeReasoningEffort(config.reasoningEffort);
    const persistSession = parsePersistSession(config);

    const claudePath = await which('claude');
    if (!claudePath) throw new Error('claude 命令未找到');
    const supportsNoSessionPersistence = supportsClaudeNoSessionPersistence(claudePath);

    // Use stream-json + verbose for realtime structured output
    const args = ['--print', '--verbose', '--output-format', 'stream-json'];
    if (model) args.push('--model', model);
    if (!persistSession && supportsNoSessionPersistence) {
      args.push('--no-session-persistence');
    }
    if (reasoningEffort) {
      // Claude CLI currently has no native --reasoning-effort flag.
      // Use a shared system-prompt mapping so effort semantics stay aligned across adapters.
      args.push('--append-system-prompt', buildEffortSystemPrompt(reasoningEffort));
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(claudePath, [...args, '-'], {
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

      proc.stdin.write(prompt);
      proc.stdin.end();

      let fullOutput = '';
      let textResult = '';
      let buffer = '';
      let totalCostUsd = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      proc.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            const steps = parseClaudeEvent(event);
            for (const step of steps) {
              fullOutput += step.display + '\n';
              emitHeartbeatOutput(config, {
                heartbeatId,
                issueId,
                agentId,
                chunk: step.display + '\n',
                structured: step,
              });
            }

            // Extract result text
            if (event.type === 'result' && event.result) {
              textResult = event.result as string;
              totalCostUsd = (event.total_cost_usd as number) || 0;
              if (event.usage) {
                totalInputTokens = (event.usage.input_tokens as number) || 0;
                totalOutputTokens = (event.usage.output_tokens as number) || 0;
              }
            }

            // Extract usage from assistant messages
            if (event.type === 'assistant' && event.message?.usage) {
              totalInputTokens += event.message.usage.input_tokens || 0;
              totalOutputTokens += event.message.usage.output_tokens || 0;
            }
          } catch {
            // Non-JSON line
            fullOutput += line + '\n';
            emitHeartbeatOutput(config, {
              heartbeatId,
              issueId,
              agentId,
              chunk: line + '\n',
              structured: { type: 'text', content: line, display: line },
            });
          }
        }
      });

      let stderr = '';
      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer);
            if (event.type === 'result' && event.result) {
              textResult = event.result as string;
              totalCostUsd = (event.total_cost_usd as number) || 0;
            }
          } catch { /* ignore */ }
        }

        const totalTokens = totalInputTokens + totalOutputTokens;

        if (code === 0) {
          resolve({
            outputLog: textResult || fullOutput,
            debugLog: fullOutput,
            tokenUsage: totalTokens || estimateTokens(fullOutput),
            costCents: totalCostUsd > 0 ? Math.ceil(totalCostUsd * 100) : estimateCostFallback(totalInputTokens, totalOutputTokens),
            success: true,
          });
        } else {
          reject(new Error(`Claude Code 退出，错误码 ${code}: ${stderr || fullOutput}`));
        }
      });

      proc.on('error', (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        reject(new Error(`无法启动 Claude Code: ${err.message}`));
      });

      const hardTimeout = typeof config.hardTimeoutMs === 'number'
        ? config.hardTimeoutMs
        : ((config.timeoutMs as number) || DEFAULT_TASK_TIMEOUT_MS);
      if (hardTimeout > 0) {
        timeoutHandle = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`Claude Code 超时 (${hardTimeout / 1000}秒)`));
        }, hardTimeout);
      }
    });
  }
}

interface StepInfo {
  type: string;
  content: string;
  display: string;
  toolName?: string;
}

function parseClaudeEvent(event: Record<string, unknown>): StepInfo[] {
  const type = event.type as string;
  const steps: StepInfo[] = [];

  // system init event
  if (type === 'system') {
    const subtype = event.subtype as string || '';
    const model = event.model as string || '';
    if (subtype === 'init' && model) {
      steps.push({ type: 'system', content: `模型: ${model}`, display: `⚙️ 初始化 | 模型: ${model}` });
    }
    return steps;
  }

  // assistant message — the main content
  if (type === 'assistant') {
    const msg = event.message as Record<string, unknown>;
    if (!msg) return steps;
    const content = msg.content as Array<Record<string, unknown>>;
    if (!Array.isArray(content)) return steps;

    for (const block of content) {
      if (block.type === 'thinking') {
        const text = (block.thinking as string) || '';
        if (text) {
          const preview = text.length > 300 ? text.slice(0, 300) + '...' : text;
          steps.push({ type: 'thinking', content: text, display: preview });
        }
      } else if (block.type === 'text') {
        const text = (block.text as string) || '';
        if (text) {
          steps.push({ type: 'text', content: text, display: text });
        }
      } else if (block.type === 'tool_use') {
        const name = (block.name as string) || 'tool';
        const input = JSON.stringify(block.input || {});
        const preview = input.length > 200 ? input.slice(0, 200) + '...' : input;
        steps.push({ type: 'tool_use', content: `${name}(${preview})`, display: `${name}(${preview})`, toolName: name });
      }
    }
    return steps;
  }

  // result event — only show metadata, text already shown in assistant event
  if (type === 'result') {
    const costUsd = event.total_cost_usd as number;
    const durationMs = event.duration_ms as number;
    const meta: string[] = [];
    if (durationMs) meta.push(`耗时: ${(durationMs / 1000).toFixed(1)}s`);
    if (costUsd) meta.push(`费用: $${costUsd.toFixed(4)}`);
    if (meta.length > 0) {
      steps.push({ type: 'system', content: meta.join(' | '), display: `✅ 完成 | ${meta.join(' | ')}` });
    }
    return steps;
  }

  return steps;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateCostFallback(inputTokens: number, outputTokens: number): number {
  if (inputTokens === 0 && outputTokens === 0) return 0;
  return Math.ceil((inputTokens * 3 + outputTokens * 15) / 1_000_000 * 100);
}
