import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import which from '../utils/which.js';
import type { AgentAdapter, AdapterRunResult } from './base.js';
import { emitHeartbeatOutput } from './output.js';
import { resolveCodexExecutionMode } from '../services/codex-runtime.js';
import { normalizeReasoningEffort } from '../services/reasoning-effort.js';

const DEFAULT_TASK_TIMEOUT_MS = 3_599_000;
let cachedCodexReasoningEffortSupport: boolean | null = null;

function supportsCodexReasoningEffort(codexPath: string): boolean {
  if (cachedCodexReasoningEffortSupport !== null) {
    return cachedCodexReasoningEffortSupport;
  }
  try {
    const help = execFileSync(codexPath, ['exec', '--help'], {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 512 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    cachedCodexReasoningEffortSupport = help.includes('--reasoning-effort');
  } catch {
    // Keep optimistic behavior and rely on runtime fallback branch below.
    cachedCodexReasoningEffortSupport = true;
  }
  return cachedCodexReasoningEffortSupport;
}

export class CodexAdapter implements AgentAdapter {
  name = 'codex';

  async isAvailable(): Promise<boolean> {
    return (await which('codex')) !== null;
  }

  async run(prompt: string, config: Record<string, unknown>): Promise<AdapterRunResult> {
    let workDir = (config.workDir as string) || process.cwd();
    if (!fs.existsSync(workDir)) {
      console.warn(`[codex] 工作目录不存在: ${workDir}，使用临时目录`);
      workDir = os.tmpdir();
    }
    const model = (config.model as string) || '';
    const agentId = config._agentId as string;
    const heartbeatId = config._heartbeatId as string;
    const issueId = (config._issueId as string | null) || null;
    const abortSignal = config._abortSignal as AbortSignal | undefined;
    const envOverrides = (config._envOverrides as Record<string, string> | undefined) || {};
    const hardTimeout = typeof config.hardTimeoutMs === 'number'
      ? config.hardTimeoutMs
      : ((config.timeoutMs as number) || DEFAULT_TASK_TIMEOUT_MS);
    const reasoningEffort = normalizeReasoningEffort(config.reasoningEffort);

    const codexPath = await which('codex');
    if (!codexPath) throw new Error('codex 命令未找到');
    const canUseReasoningEffort = supportsCodexReasoningEffort(codexPath);

    const runtimeMode = await resolveCodexExecutionMode();
    const taskAccessModeRaw = typeof config.environmentAccessMode === 'string' ? config.environmentAccessMode.trim().toLowerCase() : 'full';
    const taskAccessMode: 'default' | 'full' | 'custom' = (
      taskAccessModeRaw === 'default' || taskAccessModeRaw === 'full' || taskAccessModeRaw === 'custom'
    ) ? taskAccessModeRaw : 'full';
    const taskAccessCustom = typeof config.environmentAccessCustom === 'string' ? config.environmentAccessCustom.trim() : '';
    const allowAutoFallback = taskAccessMode === 'default'
      ? runtimeMode.configuredMode !== 'sandboxed'
      : true;

    const publishSystemStep = (display: string) => {
      emitHeartbeatOutput(config, {
        heartbeatId,
        issueId,
        agentId,
        chunk: `${display}\n`,
        structured: {
          type: 'system',
          content: display,
          display,
        },
      });
    };

    const runOnce = (unsafeMode: boolean, useReasoningEffort: boolean): Promise<AdapterRunResult> => new Promise((resolve, reject) => {
      const args = ['exec', '--skip-git-repo-check', '--json'];
      if (unsafeMode) {
        args.push('--dangerously-bypass-approvals-and-sandbox');
      }
      if (model) args.push('-m', model);
      if (useReasoningEffort && reasoningEffort) args.push('--reasoning-effort', reasoningEffort);
      args.push('-');

      const proc = spawn(codexPath, args, {
        cwd: workDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...envOverrides },
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
      let textOutput = '';
      let buffer = '';
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let lastPublishedKey = '';
      let lastTextSnapshot = '';

      const publishStep = (step: StepInfo) => {
        let nextStep = step;
        if (nextStep.type === 'text' || nextStep.type === 'message') {
          const current = nextStep.content || nextStep.display || '';
          if (lastTextSnapshot && current.startsWith(lastTextSnapshot)) {
            const delta = current.slice(lastTextSnapshot.length);
            if (!delta) {
              lastTextSnapshot = current;
              return;
            }
            nextStep = { ...nextStep, content: delta, display: delta };
          }
          lastTextSnapshot = current;
        }

        const key = `${nextStep.type}|${nextStep.display}|${nextStep.content}`;
        if (key === lastPublishedKey) return;
        lastPublishedKey = key;

        fullOutput += nextStep.display + '\n';
        if (nextStep.type === 'text' || nextStep.type === 'message') {
          textOutput += nextStep.content;
        }
        emitHeartbeatOutput(config, {
          heartbeatId,
          issueId,
          agentId,
          chunk: nextStep.display + '\n',
          structured: nextStep,
        });
      };

      proc.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            const steps = parseCodexEvent(event);
            for (const step of steps) {
              publishStep(step);
            }

            if (event.type === 'turn.completed' && event.usage) {
              totalInputTokens += (event.usage.input_tokens as number) || 0;
              totalOutputTokens += (event.usage.output_tokens as number) || 0;
            }
          } catch {
            publishStep({ type: 'text', content: line, display: line });
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
            const steps = parseCodexEvent(event);
            for (const step of steps) {
              publishStep(step);
            }
          } catch {
            publishStep({ type: 'text', content: buffer, display: buffer });
          }
        }

        const totalTokens = totalInputTokens + totalOutputTokens;

        if (code === 0) {
          resolve({
            outputLog: textOutput || fullOutput,
            debugLog: fullOutput,
            tokenUsage: totalTokens || estimateTokens(fullOutput),
            costCents: estimateCost(totalInputTokens, totalOutputTokens),
            success: true,
          });
        } else {
          reject(new Error(`Codex 退出，错误码 ${code}: ${stderr || fullOutput}`));
        }
      });

      proc.on('error', (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        reject(new Error(`无法启动 Codex: ${err.message}`));
      });

      if (hardTimeout > 0) {
        timeoutHandle = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`Codex 超时 (${hardTimeout / 1000}秒)`));
        }, hardTimeout);
      }
    });

    let useUnsafeMode = taskAccessMode === 'default'
      ? runtimeMode.effectiveMode === 'unsafe'
      : true;
    if (taskAccessMode === 'full') {
      publishSystemStep('🔓 任务环境访问权限: 完全访问（unsafe）');
    } else if (taskAccessMode === 'custom') {
      publishSystemStep('🧩 任务环境访问权限: 自定义（当前先按完全访问执行）');
      if (taskAccessCustom) {
        publishSystemStep(`🧩 自定义权限说明: ${taskAccessCustom}`);
      }
    }
    if (useUnsafeMode && taskAccessMode === 'default') {
      publishSystemStep(`⚠️ Codex 兼容模式已启用（configured=${runtimeMode.configuredMode}，effective=unsafe）`);
      if (runtimeMode.compatibility.reason) {
        publishSystemStep(`⚠️ ${runtimeMode.compatibility.reason}`);
      }
    }

    let useReasoningEffort = Boolean(reasoningEffort) && canUseReasoningEffort;
    if (reasoningEffort && !canUseReasoningEffort) {
      publishSystemStep('⚠️ 当前 Codex CLI 未提供 --reasoning-effort，已退化为统一提示词策略');
    }
    try {
      return await runOnce(useUnsafeMode, useReasoningEffort);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (useReasoningEffort && isReasoningEffortOptionError(message)) {
        useReasoningEffort = false;
        publishSystemStep('⚠️ 当前 Codex CLI 不支持 --reasoning-effort，已自动降级为默认推理强度重试');
        return runOnce(useUnsafeMode, useReasoningEffort);
      }
      if (!useUnsafeMode && allowAutoFallback && isBwrapArgv0Error(message)) {
        useUnsafeMode = true;
        publishSystemStep('⚠️ 检测到 bwrap 不兼容（--argv0），正在自动切换为兼容高权限模式重试');
        return runOnce(useUnsafeMode, useReasoningEffort);
      }
      throw err;
    }
  }
}

interface StepInfo {
  type: string;
  content: string;
  display: string;
  toolName?: string;
}

/**
 * Parse codex JSONL events. Real format from codex exec --json:
 * - {"type":"thread.started","thread_id":"..."}
 * - {"type":"turn.started"}
 * - {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
 * - {"type":"item.started","item":{"type":"command_execution","command":"...","status":"in_progress"}}
 * - {"type":"item.completed","item":{"type":"command_execution","command":"...","aggregated_output":"...","exit_code":0}}
 * - {"type":"item.completed","item":{"type":"web_search",...}}
 * - {"type":"turn.completed","usage":{...}}
 */
function parseCodexEvent(event: Record<string, unknown>): StepInfo[] {
  const type = event.type as string;
  const steps: StepInfo[] = [];

  if (type === 'thread.started') {
    steps.push({ type: 'system', content: '会话开始', display: `⚙️ 会话已启动` });
    return steps;
  }

  // item.started — show command being executed
  if (type === 'item.started') {
    const item = event.item as Record<string, unknown>;
    if (!item) return steps;

    if (item.type === 'command_execution') {
      const cmd = (item.command as string) || '';
      steps.push({ type: 'tool_use', content: cmd, display: `💻 执行命令: ${cmd}`, toolName: 'shell' });
    }
    return steps;
  }

  // item.completed — the main events
  if (type === 'item.completed') {
    const item = event.item as Record<string, unknown>;
    if (!item) return steps;

    if (item.type === 'agent_message') {
      const text = (item.text as string) || '';
      if (text) {
        steps.push({ type: 'message', content: text + '\n', display: text });
      }
    } else if (item.type === 'command_execution') {
      const cmd = (item.command as string) || '';
      const output = (item.aggregated_output as string) || '';
      const exitCode = item.exit_code as number;
      const status = exitCode === 0 ? '✅' : '❌';

      if (output) {
        const preview = output.length > 500 ? output.slice(0, 500) + '\n...(已截断)' : output;
        steps.push({
          type: 'tool_result',
          content: output,
          display: `${status} [exit ${exitCode}] ${cmd}\n${preview}`,
        });
      } else {
        steps.push({
          type: 'tool_result',
          content: `exit ${exitCode}`,
          display: `${status} [exit ${exitCode}] ${cmd}`,
        });
      }
    } else if (item.type === 'web_search') {
      const query = (item.query as string) || '';
      steps.push({ type: 'tool_use', content: query, display: `🔍 网络搜索: ${query}`, toolName: 'web_search' });
    } else if (item.type === 'file_read' || item.type === 'file_write') {
      const path = (item.path as string) || (item.file as string) || '';
      steps.push({ type: 'tool_use', content: path, display: `📄 ${item.type === 'file_read' ? '读取' : '写入'}: ${path}`, toolName: item.type as string });
    }
    return steps;
  }

  // turn.completed — usage summary
  if (type === 'turn.completed') {
    const usage = event.usage as Record<string, number> | undefined;
    if (usage) {
      const inputT = usage.input_tokens || 0;
      const outputT = usage.output_tokens || 0;
      steps.push({
        type: 'system',
        content: `输入: ${inputT} tokens, 输出: ${outputT} tokens`,
        display: `✅ 轮次完成 | 输入: ${inputT} tokens, 输出: ${outputT} tokens`,
      });
    }
    return steps;
  }

  return steps;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  if (inputTokens === 0 && outputTokens === 0) return 0;
  // Rough: $2/M input, $8/M output for GPT models
  return Math.ceil((inputTokens * 2 + outputTokens * 8) / 1_000_000 * 100);
}

function isBwrapArgv0Error(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes('bwrap: unknown option --argv0') || (msg.includes('bwrap') && msg.includes('--argv0'));
}

function isReasoningEffortOptionError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes('reasoning-effort') && (
    msg.includes('unknown option') || msg.includes('unrecognized option') || msg.includes('unexpected argument')
  );
}
