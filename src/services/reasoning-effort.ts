export type NormalizedReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export function normalizeReasoningEffort(value: unknown): NormalizedReasoningEffort | '' {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'xhigh') {
    return normalized;
  }
  return '';
}

export function buildEffortSystemPrompt(effort: NormalizedReasoningEffort): string {
  if (effort === 'low') {
    return 'Reasoning effort is low. Prefer concise plans and fast execution, avoid over-analysis.';
  }
  if (effort === 'high') {
    return 'Reasoning effort is high. Perform deeper analysis, validate assumptions, and cover edge cases before final answer.';
  }
  if (effort === 'xhigh') {
    return 'Reasoning effort is xhigh. Think rigorously, test alternatives, and provide robust verification before final answer.';
  }
  return 'Reasoning effort is medium. Balance speed and rigor.';
}

export function describeEffortApplication(adapterType: string, effort: NormalizedReasoningEffort): string {
  if (adapterType === 'codex') {
    return `努力程度=${effort}（Codex 原生参数）`;
  }
  if (adapterType === 'claude-code') {
    return `努力程度=${effort}（Claude Code 通过系统提示映射）`;
  }
  return `努力程度=${effort}`;
}
