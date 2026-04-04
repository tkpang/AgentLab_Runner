import os from 'os';
import process from 'process';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
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

function parseEnvBool(raw: string | undefined, defaultValue: boolean): boolean {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return defaultValue;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return defaultValue;
}

const SERVER = (process.env.RUNNER_SERVER || 'http://127.0.0.1:3200').replace(/\/+$/, '');
const TOKEN = String(process.env.RUNNER_TOKEN || '').trim();
const RUNNER_ID = String(process.env.RUNNER_ID || `${os.hostname()}-${process.pid}`).trim();
const HELLO_INTERVAL_MS = Math.max(10_000, Number.parseInt(process.env.RUNNER_HELLO_INTERVAL_MS || '30000', 10) || 30000);
const CONTROL_POLL_MS = Math.max(500, Number.parseInt(process.env.RUNNER_CONTROL_POLL_MS || '1200', 10) || 1200);
const HEALTH_INTERVAL_MS = Math.max(20_000, Number.parseInt(process.env.RUNNER_HEALTH_INTERVAL_MS || '60000', 10) || 60000);
const WORKSPACE_REFRESH_MS = Math.max(30_000, Number.parseInt(process.env.RUNNER_WORKSPACE_REFRESH_MS || '300000', 10) || 300000);
const QUOTA_REFRESH_MS = Math.max(30_000, Number.parseInt(process.env.RUNNER_QUOTA_REFRESH_MS || '180000', 10) || 180000);
const EXTERNAL_TASK_REFRESH_MS = Math.max(30_000, Number.parseInt(process.env.RUNNER_EXTERNAL_TASK_REFRESH_MS || '90000', 10) || 90000);
const EXTERNAL_TASK_RECENT_RUNNING_MS = Math.max(60_000, Number.parseInt(process.env.RUNNER_EXTERNAL_TASK_RECENT_RUNNING_MS || '300000', 10) || 300000);
const EXTERNAL_TASK_STALE_COMPLETED_MS = Math.max(5 * 60_000, Number.parseInt(process.env.RUNNER_EXTERNAL_TASK_STALE_COMPLETED_MS || '1200000', 10) || 1200000);
const EXTERNAL_TASK_ACTIVE_CHANGE_WINDOW_MS = Math.max(EXTERNAL_TASK_REFRESH_MS * 3, 5 * 60_000);
const EXTERNAL_TASK_OBSERVATION_TTL_MS = Math.max(30 * 60_000, Number.parseInt(process.env.RUNNER_EXTERNAL_TASK_OBSERVATION_TTL_MS || '86400000', 10) || 86400000);
const EXTERNAL_TASK_SCAN_ENABLED = parseEnvBool(process.env.RUNNER_EXTERNAL_TASK_SCAN_ENABLED, true);
const EXTERNAL_TASK_SCAN_CODEX = parseEnvBool(process.env.RUNNER_EXTERNAL_TASK_SCAN_CODEX, true);
const EXTERNAL_TASK_SCAN_CLAUDE = parseEnvBool(process.env.RUNNER_EXTERNAL_TASK_SCAN_CLAUDE, false);
const EXTERNAL_TASK_FILTER_NOISE = parseEnvBool(process.env.RUNNER_EXTERNAL_TASK_FILTER_NOISE, true);

type RunnerQuotaWindow = {
  quota5h: number | null;
  quota7d: number | null;
  quotaSupported: boolean;
};

type RunnerToolQuota = RunnerQuotaWindow & {
  installed: boolean;
  loggedIn: boolean;
  version: string;
  error: string | null;
};

type RunnerQuotaSnapshot = {
  checkedAt: string;
  codex: RunnerToolQuota;
  claude: RunnerToolQuota;
};

type RunnerWorkspaceCandidate = {
  id: string;
  label: string;
  runtime: 'native' | 'wsl';
  platform: 'linux' | 'windows' | 'macos' | 'other';
  pathStyle: 'posix' | 'windows';
  cwd: string;
  homeDir: string;
  tempDir: string;
  suggestedWorkDir: string;
};

type RunnerWorkspaceSnapshot = {
  checkedAt: string;
  defaultWorkDir: string;
  primaryCandidateId: string;
  inWsl: boolean;
  candidates: RunnerWorkspaceCandidate[];
};

type RunnerExternalTask = {
  id: string;
  legacyId?: string;
  roundKey?: string;
  tool: 'codex' | 'claude';
  title: string;
  normalizedTitle?: string;
  firstPrompt?: string;
  summary: string;
  status: 'running' | 'completed' | 'unknown';
  statusReason?: string;
  updatedAt: string;
  sourcePath: string;
  sourceFileName: string;
  sourceFileSize: number;
};

type RunnerExternalTaskSnapshot = {
  checkedAt: string;
  scannedFiles: number;
  errors: string[];
  tasks: RunnerExternalTask[];
};

type ExternalTaskObservation = {
  mtimeMs: number;
  size: number;
  seenAt: number;
  previewFingerprint: string;
};

let workspaceCache: { expiresAt: number; value: RunnerWorkspaceSnapshot } | null = null;
let quotaCache: { expiresAt: number; value: RunnerQuotaSnapshot } | null = null;
let externalTaskCache: { expiresAt: number; value: RunnerExternalTaskSnapshot } | null = null;
const externalTaskObservationCache = new Map<string, ExternalTaskObservation>();

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

function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function walkFind(obj: unknown, predicate: (k: string, v: unknown) => boolean): unknown {
  if (obj == null) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = walkFind(item, predicate);
      if (found != null) return found;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (predicate(k, v)) return v;
      const found = walkFind(v, predicate);
      if (found != null) return found;
    }
  }
  return null;
}

function readCodexAuthToken(): string {
  const authPath = path.join(os.homedir(), '.codex', 'auth.json');
  const auth = safeReadJson(authPath);
  if (!auth) return '';
  const tokens = (auth.tokens && typeof auth.tokens === 'object')
    ? auth.tokens as Record<string, unknown>
    : null;
  if (tokens) {
    const direct = ['access_token', 'id_token', 'refresh_token']
      .map((key) => typeof tokens[key] === 'string' ? String(tokens[key]).trim() : '')
      .find(Boolean);
    if (direct) return direct;
  }
  const fallback = walkFind(auth, (k, v) => {
    if (typeof v !== 'string' || !v.trim()) return false;
    const key = k.toLowerCase();
    return key.includes('token') || key.includes('key');
  });
  return typeof fallback === 'string' ? fallback.trim() : '';
}

function readClaudeOauthToken(): string {
  const envToken = String(process.env.CLAUDE_CODE_OAUTH_TOKEN || '').trim();
  if (envToken) return envToken;
  const home = os.homedir();
  const candidatePaths = [
    path.join(home, '.claude', '.credentials.json'),
    path.join(home, '.claude', 'credentials.json'),
    path.join(home, '.claude', 'config.json'),
    path.join(home, '.claude.json'),
    path.join(home, '.config', 'claude', 'credentials.json'),
  ];
  for (const filePath of candidatePaths) {
    const credentials = safeReadJson(filePath);
    if (!credentials) continue;
    const nestedOauth = credentials.claudeAiOauth && typeof credentials.claudeAiOauth === 'object'
      ? credentials.claudeAiOauth as Record<string, unknown>
      : null;
    const nestedToken = nestedOauth && typeof nestedOauth.accessToken === 'string'
      ? String(nestedOauth.accessToken).trim()
      : '';
    if (nestedToken) return nestedToken;
    const flatToken = typeof credentials.accessToken === 'string' ? String(credentials.accessToken).trim() : '';
    if (flatToken) return flatToken;
    const fallbackToken = walkFind(credentials, (k, v) => {
      if (typeof v !== 'string' || !v.trim()) return false;
      const key = k.toLowerCase();
      return key === 'accesstoken' || key === 'oauth_token' || key === 'oauthtoken';
    });
    if (typeof fallbackToken === 'string' && fallbackToken.trim()) {
      return fallbackToken.trim();
    }
  }
  return '';
}

function normalizePercent(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function extractRemainingPercent(bucket: unknown): number | null {
  if (!bucket || typeof bucket !== 'object') return null;
  const target = bucket as Record<string, unknown>;
  const remainingDirect = normalizePercent(target.remainingPercent);
  if (remainingDirect != null) return remainingDirect;
  const used = normalizePercent(target.usedPercent);
  if (used == null) return null;
  return Math.max(0, 100 - used);
}

function parsePercentFromUtilization(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value <= 1 ? normalizePercent(value * 100) : normalizePercent(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return null;
    return parsed <= 1 ? normalizePercent(parsed * 100) : normalizePercent(parsed);
  }
  return null;
}

function parseClaudeUsageWindow(value: unknown): { usedPercent: number; remainingPercent: number } | null {
  if (!value || typeof value !== 'object') return null;
  const target = value as Record<string, unknown>;
  const utilization = target.utilization ?? target.used_percentage ?? target.percent_used ?? target.usage;
  const usedPercent = parsePercentFromUtilization(utilization);
  if (usedPercent == null) return null;
  return {
    usedPercent,
    remainingPercent: Math.max(0, 100 - usedPercent),
  };
}

function parseCodexRateLimits(rateLimits: unknown): RunnerQuotaWindow {
  if (!rateLimits || typeof rateLimits !== 'object') {
    return { quota5h: null, quota7d: null, quotaSupported: false };
  }
  const limits = rateLimits as Record<string, unknown>;
  const primary = limits.primary && typeof limits.primary === 'object' ? limits.primary as Record<string, unknown> : null;
  const secondary = limits.secondary && typeof limits.secondary === 'object' ? limits.secondary as Record<string, unknown> : null;
  const quota5h = extractRemainingPercent(primary);
  const quota7d = extractRemainingPercent(secondary);
  return {
    quota5h,
    quota7d,
    quotaSupported: quota5h != null || quota7d != null,
  };
}

function sanitizeReadableText(raw: string): string {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\0/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inferExternalTaskTitle(content: string, fallbackName: string): string {
  const cleaned = sanitizeReadableText(content);
  if (!cleaned) return fallbackName;
  const keyPatterns = [
    /"(?:title|taskTitle|summary|name)"\s*:\s*"([^"\n]{6,180})"/i,
    /"(?:prompt|instruction|input|query)"\s*:\s*"([^"\n]{6,180})"/i,
  ];
  for (const pattern of keyPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim().slice(0, 120);
    }
  }
  const firstLine = cleaned
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length >= 6);
  if (firstLine) return firstLine.slice(0, 120);
  return fallbackName;
}

function inferExternalTaskFirstPrompt(content: string): string {
  const cleaned = sanitizeReadableText(content);
  if (!cleaned) return '';
  const patterns = [
    /"(?:firstPrompt|prompt|instruction|input|query|userPrompt|user_message|userMessage)"\s*:\s*"([^"\n]{6,260})"/i,
    /(?:^|\n)\s*(?:用户|user)\s*[:：]\s*([^\n]{6,260})/i,
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      return match[1].trim().slice(0, 220);
    }
  }
  return '';
}

function normalizeExternalTaskTitle(rawTitle: string, firstPrompt: string, fallbackName: string): string {
  const base = (rawTitle || '').trim() || firstPrompt.trim() || fallbackName.trim();
  const text = base
    .replace(/\s+/g, ' ')
    .replace(/^[\[\]#>*\s-]+/, '')
    .replace(/\b(queue[-_\s]?operation|heartbeat|reconnecting)\b/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return (text || fallbackName || 'External Task').slice(0, 120);
}

function inferExternalTaskSummary(content: string): string {
  const cleaned = sanitizeReadableText(content);
  if (!cleaned) return '';
  return cleaned.slice(0, 360);
}

function isQueueOperationNoiseTask(input: {
  preview: string;
  normalizedTitle: string;
  firstPrompt: string;
  summary: string;
}): boolean {
  if (!EXTERNAL_TASK_FILTER_NOISE) return false;
  if (input.firstPrompt.trim()) return false;

  const text = sanitizeReadableText(`${input.normalizedTitle}\n${input.summary}\n${input.preview}`).toLowerCase();
  if (!text) return true;
  const hasPromptSignals = /"(prompt|instruction|input|query|user(message|_message|prompt)?)"\s*:/.test(text)
    || /\b(final answer|assistant reply|result summary)\b/.test(text);
  if (hasPromptSignals) return false;

  const noiseMarkers = [
    'queue-operation',
    'queue operation',
    'queue_operation',
    'runner.jobs.claim',
    'runner.environment.updated',
    'heartbeat',
    'reconnecting',
    'pollafterms',
    'lastclaimat',
    '"touch"',
    '"claim"',
  ];
  let hitCount = 0;
  for (const marker of noiseMarkers) {
    if (text.includes(marker)) hitCount += 1;
  }
  if (hitCount >= 2) return true;
  if (/^queue[-_\s]?operation/.test(input.normalizedTitle.toLowerCase())) return true;
  return false;
}

function readTextPreviewFromFile(filePath: string, maxChunkBytes = 12 * 1024): string {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return '';
    const totalSize = stat.size;
    if (totalSize <= 0) return '';
    const fd = fs.openSync(filePath, 'r');
    try {
      const firstBytes = Math.min(maxChunkBytes, totalSize);
      const firstBuffer = Buffer.alloc(firstBytes);
      fs.readSync(fd, firstBuffer, 0, firstBytes, 0);

      if (totalSize <= maxChunkBytes) {
        return sanitizeReadableText(firstBuffer.toString('utf8'));
      }

      const tailBytes = Math.min(maxChunkBytes, totalSize - firstBytes);
      const tailBuffer = Buffer.alloc(tailBytes);
      fs.readSync(fd, tailBuffer, 0, tailBytes, totalSize - tailBytes);
      return sanitizeReadableText(`${firstBuffer.toString('utf8')}\n${tailBuffer.toString('utf8')}`);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function listRecentSessionFiles(rootDirs: string[], maxDepth = 4, hardLimit = 180): Array<{ filePath: string; mtimeMs: number; size: number }> {
  const allowedExtensions = new Set(['.json', '.jsonl', '.md', '.txt', '.log']);
  const skipDirNames = new Set(['node_modules', '.git', '.cache', 'Cache']);
  const stack: Array<{ dir: string; depth: number }> = [];
  const collected: Array<{ filePath: string; mtimeMs: number; size: number }> = [];
  const seenDirs = new Set<string>();

  for (const root of rootDirs) {
    if (!root || !fs.existsSync(root)) continue;
    stack.push({ dir: root, depth: 0 });
  }

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;
    if (item.depth > maxDepth) continue;
    const resolvedDir = path.resolve(item.dir);
    if (seenDirs.has(resolvedDir)) continue;
    seenDirs.add(resolvedDir);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(resolvedDir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirNames.has(entry.name)) continue;
        stack.push({ dir: fullPath, depth: item.depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExtensions.has(ext)) continue;
      try {
        const stat = fs.statSync(fullPath);
        collected.push({
          filePath: fullPath,
          mtimeMs: stat.mtimeMs || 0,
          size: stat.size || 0,
        });
      } catch {
        // ignore per-file stat errors
      }
    }

    if (collected.length > hardLimit * 2) {
      collected.sort((a, b) => b.mtimeMs - a.mtimeMs);
      collected.splice(hardLimit);
    }
  }

  collected.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return collected.slice(0, hardLimit);
}

function normalizeExternalTaskPathForKey(sourcePath: string): string {
  const resolved = path.resolve(sourcePath || '');
  if (process.platform === 'win32') return resolved.toLowerCase();
  return resolved;
}

function buildExternalTaskLegacyId(tool: 'codex' | 'claude', sourcePath: string): string {
  const hash = createHash('sha1').update(`${tool}:${sourcePath}`).digest('hex').slice(0, 16);
  return `${tool}:${hash}`;
}

function buildExternalTaskContentFingerprint(preview: string): string {
  const content = sanitizeReadableText(preview).slice(0, 2400);
  if (!content) return 'empty';
  return createHash('sha1').update(content).digest('hex').slice(0, 10);
}

function buildExternalTaskId(
  tool: 'codex' | 'claude',
  sourcePath: string,
  mtimeMs: number,
  size: number,
  preview: string,
): string {
  const legacyId = buildExternalTaskLegacyId(tool, sourcePath);
  const normalizedMtime = Number.isFinite(mtimeMs) && mtimeMs > 0 ? Math.trunc(mtimeMs) : 0;
  const normalizedSize = Number.isFinite(size) && size > 0 ? Math.trunc(size) : 0;
  const contentFingerprint = buildExternalTaskContentFingerprint(preview);
  const roundSeed = `${legacyId}|${normalizedMtime}|${normalizedSize}|${contentFingerprint}`;
  const roundHash = createHash('sha1').update(roundSeed).digest('hex').slice(0, 18);
  return `${tool}:${roundHash}`;
}

function getExternalTaskObservationKey(tool: 'codex' | 'claude', sourcePath: string): string {
  return `${tool}:${normalizeExternalTaskPathForKey(sourcePath)}`;
}

function inferStatusSignalsFromPreview(preview: string): { hasRunningMarker: boolean; hasCompletedMarker: boolean } {
  const content = sanitizeReadableText(preview).toLowerCase();
  if (!content) return { hasRunningMarker: false, hasCompletedMarker: false };

  const runningPatterns = [
    /\b(reconnecting|retrying|thinking|streaming)\b/i,
    /\b(running|in[_\s-]?progress|pending)\b/i,
    /"status"\s*:\s*"(running|in_progress|pending)"/i,
    /"state"\s*:\s*"(running|pending|working)"/i,
  ];
  const completedPatterns = [
    /\b(completed|finished|succeeded|success|done)\b/i,
    /"status"\s*:\s*"(completed|finished|success|succeeded|done)"/i,
    /"state"\s*:\s*"(completed|finished|done|success)"/i,
    /\b(final answer|task finished|execution complete)\b/i,
  ];

  const hasRunningMarker = runningPatterns.some((pattern) => pattern.test(content));
  const hasCompletedMarker = completedPatterns.some((pattern) => pattern.test(content));
  return { hasRunningMarker, hasCompletedMarker };
}

function inferExternalTaskStatus(input: {
  tool: 'codex' | 'claude';
  sourcePath: string;
  mtimeMs: number;
  size: number;
  preview: string;
}): { status: 'running' | 'completed' | 'unknown'; reason: string } {
  const now = Date.now();
  const safeMtime = Number.isFinite(input.mtimeMs) && input.mtimeMs > 0 ? input.mtimeMs : 0;
  const ageMs = safeMtime > 0 ? Math.max(0, now - safeMtime) : Number.POSITIVE_INFINITY;
  const observationKey = getExternalTaskObservationKey(input.tool, input.sourcePath);
  const previous = externalTaskObservationCache.get(observationKey) || null;
  const previewFingerprint = buildExternalTaskContentFingerprint(input.preview);
  const { hasRunningMarker, hasCompletedMarker } = inferStatusSignalsFromPreview(input.preview);

  const activeChanging = Boolean(
    previous
      && (safeMtime > previous.mtimeMs + 1 || input.size !== previous.size || previewFingerprint !== previous.previewFingerprint)
      && (now - previous.seenAt <= EXTERNAL_TASK_ACTIVE_CHANGE_WINDOW_MS),
  );
  const recentlyUpdated = ageMs <= EXTERNAL_TASK_RECENT_RUNNING_MS;
  const staleEnough = ageMs >= EXTERNAL_TASK_STALE_COMPLETED_MS;

  let status: 'running' | 'completed' | 'unknown' = 'unknown';
  let reason = 'insufficient-signals';
  if (activeChanging) {
    status = 'running';
    reason = 'active-change';
  } else if (hasRunningMarker && !hasCompletedMarker) {
    status = 'running';
    reason = 'running-marker';
  } else if (hasCompletedMarker && !hasRunningMarker) {
    status = 'completed';
    reason = 'completed-marker';
  } else if (staleEnough && !hasRunningMarker) {
    status = 'completed';
    reason = 'stale-file';
  } else if (recentlyUpdated && !hasCompletedMarker) {
    status = 'unknown';
    reason = 'recent-unconfirmed';
  } else if (hasCompletedMarker) {
    status = 'completed';
    reason = 'completed-marker-mixed';
  }

  externalTaskObservationCache.set(observationKey, {
    mtimeMs: safeMtime,
    size: Number.isFinite(input.size) && input.size >= 0 ? input.size : 0,
    seenAt: now,
    previewFingerprint,
  });

  return { status, reason };
}

function pruneExternalTaskObservations(activeKeys: Set<string>): void {
  const now = Date.now();
  for (const [key, value] of externalTaskObservationCache.entries()) {
    const expired = (now - value.seenAt) > EXTERNAL_TASK_OBSERVATION_TTL_MS;
    const inactiveTooLong = !activeKeys.has(key) && (now - value.seenAt) > EXTERNAL_TASK_ACTIVE_CHANGE_WINDOW_MS;
    if (expired || inactiveTooLong) {
      externalTaskObservationCache.delete(key);
    }
  }
}

function collectToolExternalTasks(tool: 'codex' | 'claude'): {
  tasks: RunnerExternalTask[];
  scannedFiles: number;
  errors: string[];
  observedKeys: string[];
} {
  const homeDir = os.homedir();
  const appData = String(process.env.APPDATA || '').trim();
  const roots = tool === 'codex'
    ? [
      path.join(homeDir, '.codex', 'sessions'),
      path.join(homeDir, '.codex', 'history'),
      path.join(homeDir, '.vscode', 'User', 'globalStorage', 'openai.chatgpt'),
      appData ? path.join(appData, 'Code', 'User', 'globalStorage', 'openai.chatgpt') : '',
    ].filter(Boolean)
    : [
      path.join(homeDir, '.claude', 'projects'),
      path.join(homeDir, '.claude', 'sessions'),
      path.join(homeDir, '.claude', 'history'),
      path.join(homeDir, '.vscode', 'User', 'globalStorage', 'anthropic.claude-code'),
      appData ? path.join(appData, 'Code', 'User', 'globalStorage', 'anthropic.claude-code') : '',
    ].filter(Boolean);

  const errors: string[] = [];
  const files = listRecentSessionFiles(roots, 4, 120);
  const tasks: RunnerExternalTask[] = [];
  const observedKeys = new Set<string>();
  for (const file of files.slice(0, 24)) {
    try {
      const sourceFileName = path.basename(file.filePath);
      const preview = readTextPreviewFromFile(file.filePath);
      const fallbackTitle = sourceFileName.replace(/\.[^.]+$/, '') || sourceFileName || `${tool}-task`;
      const rawTitle = inferExternalTaskTitle(preview, fallbackTitle);
      const firstPrompt = inferExternalTaskFirstPrompt(preview);
      const normalizedTitle = normalizeExternalTaskTitle(rawTitle, firstPrompt, fallbackTitle);
      const summary = inferExternalTaskSummary(preview);
      if (isQueueOperationNoiseTask({
        preview,
        normalizedTitle,
        firstPrompt,
        summary,
      })) {
        continue;
      }
      const legacyId = buildExternalTaskLegacyId(tool, file.filePath);
      const roundFingerprint = buildExternalTaskContentFingerprint(preview);
      const statusResult = inferExternalTaskStatus({
        tool,
        sourcePath: file.filePath,
        mtimeMs: file.mtimeMs,
        size: file.size,
        preview,
      });
      observedKeys.add(getExternalTaskObservationKey(tool, file.filePath));
      tasks.push({
        id: buildExternalTaskId(tool, file.filePath, file.mtimeMs, file.size, preview),
        legacyId,
        roundKey: `${Math.trunc(file.mtimeMs || 0)}:${Math.trunc(file.size || 0)}:${roundFingerprint}`,
        tool,
        title: normalizedTitle,
        normalizedTitle,
        firstPrompt,
        summary,
        status: statusResult.status,
        statusReason: statusResult.reason,
        updatedAt: new Date(file.mtimeMs || Date.now()).toISOString(),
        sourcePath: file.filePath,
        sourceFileName,
        sourceFileSize: file.size,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${tool}:${message}`);
    }
  }

  return {
    tasks,
    scannedFiles: files.length,
    errors,
    observedKeys: Array.from(observedKeys),
  };
}

function collectExternalTaskSnapshot(): RunnerExternalTaskSnapshot {
  const empty: ReturnType<typeof collectToolExternalTasks> = {
    tasks: [],
    scannedFiles: 0,
    errors: [],
    observedKeys: [],
  };
  if (!EXTERNAL_TASK_SCAN_ENABLED) {
    pruneExternalTaskObservations(new Set());
    return {
      checkedAt: new Date().toISOString(),
      scannedFiles: 0,
      errors: [],
      tasks: [],
    };
  }

  const codex = EXTERNAL_TASK_SCAN_CODEX ? collectToolExternalTasks('codex') : empty;
  const claude = EXTERNAL_TASK_SCAN_CLAUDE ? collectToolExternalTasks('claude') : empty;
  pruneExternalTaskObservations(new Set([...codex.observedKeys, ...claude.observedKeys]));
  const tasks = [...codex.tasks, ...claude.tasks]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 30);
  return {
    checkedAt: new Date().toISOString(),
    scannedFiles: codex.scannedFiles + claude.scannedFiles,
    errors: [...codex.errors, ...claude.errors].slice(0, 8),
    tasks,
  };
}

function getExternalTaskSnapshotCached(): RunnerExternalTaskSnapshot {
  const now = Date.now();
  if (externalTaskCache && externalTaskCache.expiresAt > now) {
    return externalTaskCache.value;
  }
  const value = collectExternalTaskSnapshot();
  externalTaskCache = { value, expiresAt: now + EXTERNAL_TASK_REFRESH_MS };
  return value;
}

function isWslRuntime(): boolean {
  if (process.platform !== 'linux') return false;
  if (String(process.env.WSL_DISTRO_NAME || '').trim()) return true;
  try {
    const versionText = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return versionText.includes('microsoft');
  } catch {
    return false;
  }
}

function normalizeWorkDirByPlatform(raw: string, platform: ReturnType<typeof detectPlatform>): string {
  if (!raw) return raw;
  if (platform === 'windows') {
    const replaced = raw.replace(/\//g, '\\');
    return path.win32.normalize(replaced);
  }
  return path.posix.normalize(raw.replace(/\\/g, '/'));
}

function defaultWorkDirForPlatform(platform: ReturnType<typeof detectPlatform>): string {
  const fromEnv = String(process.env.RUNNER_DEFAULT_WORKDIR || '').trim();
  if (fromEnv) return normalizeWorkDirByPlatform(fromEnv, platform);
  if (platform === 'windows') {
    return path.win32.join(os.homedir(), 'agentlab-runner');
  }
  return path.posix.join(os.homedir(), 'agentlab-runner');
}

async function listWslCandidates(): Promise<RunnerWorkspaceCandidate[]> {
  if (process.platform !== 'win32') return [];
  const listResult = await runCommand('wsl.exe', ['-l', '-q'], 6000);
  if (!listResult.ok || !listResult.output.trim()) return [];
  const distros = listResult.output
    .split(/\r?\n/)
    .map((x) => x.replace(/\0/g, '').trim())
    .filter(Boolean)
    .filter((name) => !/^windows subsystem for linux distributions/i.test(name))
    .slice(0, 8);

  const candidates: RunnerWorkspaceCandidate[] = [];
  for (const distro of distros) {
    const homeResult = await runCommand('wsl.exe', ['-d', distro, 'sh', '-lc', 'printf "%s" "$HOME"'], 7000);
    const cwdResult = await runCommand('wsl.exe', ['-d', distro, 'sh', '-lc', 'pwd'], 7000);
    const homeDir = homeResult.ok && homeResult.output.trim() ? homeResult.output.trim() : '/home';
    const cwd = cwdResult.ok && cwdResult.output.trim() ? cwdResult.output.trim() : homeDir;
    const suggested = path.posix.join(homeDir, 'agentlab-runner');
    candidates.push({
      id: `wsl:${distro}`,
      label: `WSL (${distro})`,
      runtime: 'wsl',
      platform: 'linux',
      pathStyle: 'posix',
      cwd,
      homeDir,
      tempDir: '/tmp',
      suggestedWorkDir: suggested,
    });
  }
  return candidates;
}

async function collectWorkspaceSnapshot(): Promise<RunnerWorkspaceSnapshot> {
  const platform = detectPlatform();
  const native: RunnerWorkspaceCandidate = {
    id: 'native',
    label: platform === 'windows' ? 'Windows (native)' : (isWslRuntime() ? 'Linux (WSL runtime)' : `${platform} (native)`),
    runtime: isWslRuntime() ? 'wsl' : 'native',
    platform,
    pathStyle: platform === 'windows' ? 'windows' : 'posix',
    cwd: process.cwd(),
    homeDir: os.homedir(),
    tempDir: os.tmpdir(),
    suggestedWorkDir: defaultWorkDirForPlatform(platform),
  };
  const candidates: RunnerWorkspaceCandidate[] = [native];
  if (platform === 'windows') {
    const wslCandidates = await listWslCandidates();
    if (wslCandidates.length > 0) {
      candidates.push(...wslCandidates);
    }
  }
  return {
    checkedAt: new Date().toISOString(),
    defaultWorkDir: native.suggestedWorkDir,
    primaryCandidateId: native.id,
    inWsl: isWslRuntime(),
    candidates,
  };
}

function shouldFallbackToRunnerDefaultWorkDir(workDir: string, platform: ReturnType<typeof detectPlatform>): boolean {
  const normalized = workDir.trim();
  if (!normalized) return true;
  if (platform === 'windows') {
    if (normalized.startsWith('/')) return true;
    if (/^~\//.test(normalized)) return true;
  } else {
    if (/^[A-Za-z]:[\\/]/.test(normalized)) return true;
  }
  return false;
}

function ensureDirectory(pathValue: string): boolean {
  try {
    if (!pathValue) return false;
    fs.mkdirSync(pathValue, { recursive: true });
    return fs.existsSync(pathValue) && fs.statSync(pathValue).isDirectory();
  } catch {
    return false;
  }
}

function resolveRunnerWorkDir(configuredWorkDir: string): string {
  const platform = detectPlatform();
  const runnerDefault = defaultWorkDirForPlatform(platform);
  let candidate = configuredWorkDir.trim();
  if (shouldFallbackToRunnerDefaultWorkDir(candidate, platform)) {
    candidate = runnerDefault;
  } else {
    candidate = normalizeWorkDirByPlatform(candidate, platform);
  }

  if (!ensureDirectory(candidate)) {
    if (ensureDirectory(runnerDefault)) return runnerDefault;
    return os.tmpdir();
  }
  return candidate;
}

async function getWorkspaceSnapshotCached(): Promise<RunnerWorkspaceSnapshot> {
  const now = Date.now();
  if (workspaceCache && workspaceCache.expiresAt > now) {
    return workspaceCache.value;
  }
  const value = await collectWorkspaceSnapshot();
  workspaceCache = { value, expiresAt: now + WORKSPACE_REFRESH_MS };
  return value;
}

async function requestClaudeOauthUsage(timeoutMs = 10000): Promise<Record<string, unknown>> {
  const token = readClaudeOauthToken();
  if (!token) throw new Error('Claude OAuth token missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    const bodyText = await response.text();
    let body: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed && typeof parsed === 'object') {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = null;
    }
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      const detail = String(bodyText || '').slice(0, 240);
      throw new Error(`Claude usage HTTP ${response.status}${retryAfter ? `, Retry-After=${retryAfter}` : ''}${detail ? `, body=${detail}` : ''}`);
    }
    if (!body) {
      throw new Error('Claude usage response is not JSON object');
    }
    return body;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Claude usage timeout (${timeoutMs}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function requestClaudeOauthUsageWithRetry(): Promise<Record<string, unknown>> {
  try {
    return await requestClaudeOauthUsage();
  } catch (firstErr) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    if (msg.includes('HTTP ')) throw firstErr;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return requestClaudeOauthUsage();
  }
}

async function fetchCodexRateLimitsViaAppServer(): Promise<{ ok: boolean; rateLimits?: unknown; error?: string }> {
  const initId = 'init-1';
  const rateId = 'rate-1';

  return new Promise((resolve) => {
    const proc = spawn('codex', ['app-server'], {
      cwd: process.cwd(),
      windowsHide: true,
      shell: process.platform === 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let done = false;
    let stdoutBuffer = '';
    let stderrText = '';
    const timeout = setTimeout(() => {
      finish({ ok: false, error: 'timeout waiting codex rate limits' });
    }, 15000);

    function finish(result: { ok: boolean; rateLimits?: unknown; error?: string }) {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      try { proc.stdin.end(); } catch {}
      try { proc.kill(); } catch {}
      resolve(result);
    }

    function send(payload: Record<string, unknown>) {
      try {
        proc.stdin.write(`${JSON.stringify(payload)}\n`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        finish({ ok: false, error: msg });
      }
    }

    proc.on('error', (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      finish({ ok: false, error: msg });
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrText += chunk.toString();
    });

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      while (true) {
        const breakPos = stdoutBuffer.indexOf('\n');
        if (breakPos < 0) break;
        const line = stdoutBuffer.slice(0, breakPos).trim();
        stdoutBuffer = stdoutBuffer.slice(breakPos + 1);
        if (!line) continue;

        let msg: Record<string, unknown> | null = null;
        try {
          const parsed = JSON.parse(line);
          if (parsed && typeof parsed === 'object') {
            msg = parsed as Record<string, unknown>;
          }
        } catch {
          msg = null;
        }
        if (!msg) continue;

        if (msg.id === initId && msg.result) {
          send({ method: 'initialized' });
          send({ id: rateId, method: 'account/rateLimits/read' });
          continue;
        }

        if (msg.id === rateId) {
          const resultObj = (msg.result && typeof msg.result === 'object')
            ? msg.result as Record<string, unknown>
            : null;
          const rateLimits = resultObj?.rateLimits || resultObj || null;
          finish({ ok: true, rateLimits });
          return;
        }
      }
    });

    proc.on('close', (code) => {
      if (done) return;
      const codePart = Number.isInteger(code) ? ` (${code})` : '';
      finish({ ok: false, error: (stderrText || `codex app-server exited${codePart}`).trim() });
    });

    send({
      id: initId,
      method: 'initialize',
      params: {
        clientInfo: {
          name: 'agentlab-runner-daemon',
          title: 'AgentLab Runner',
          version: '1.0.0',
        },
        capabilities: {
          experimentalApi: true,
        },
      },
    });
  });
}

async function collectQuotaSnapshot(): Promise<RunnerQuotaSnapshot> {
  const codexVersion = await runCommand('codex', ['--version'], 6000);
  const claudeVersion = await runCommand('claude', ['--version'], 6000);
  const codexLoggedIn = Boolean(readCodexAuthToken() || process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN);
  const claudeLoggedIn = Boolean(readClaudeOauthToken() || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

  const codex: RunnerToolQuota = {
    installed: codexVersion.ok,
    loggedIn: codexLoggedIn,
    version: codexVersion.output || '',
    quota5h: null,
    quota7d: null,
    quotaSupported: false,
    error: null,
  };

  if (codex.installed && codex.loggedIn) {
    const probe = await fetchCodexRateLimitsViaAppServer();
    if (probe.ok) {
      const parsed = parseCodexRateLimits(probe.rateLimits || null);
      codex.quota5h = parsed.quota5h;
      codex.quota7d = parsed.quota7d;
      codex.quotaSupported = parsed.quotaSupported;
      if (!codex.quotaSupported) {
        codex.error = 'Codex quota response has no recognized windows';
      }
    } else {
      codex.error = probe.error || 'Codex quota probe failed';
    }
  } else if (!codex.installed) {
    codex.error = 'Codex not installed';
  } else {
    codex.error = 'Codex not logged in';
  }

  const claude: RunnerToolQuota = {
    installed: claudeVersion.ok,
    loggedIn: claudeLoggedIn,
    version: claudeVersion.output || '',
    quota5h: null,
    quota7d: null,
    quotaSupported: false,
    error: null,
  };

  if (claude.installed && claude.loggedIn) {
    try {
      const usage = await requestClaudeOauthUsageWithRetry();
      const usageObj = usage as Record<string, unknown>;
      const fiveHour = parseClaudeUsageWindow(usageObj.five_hour);
      const sevenDay = parseClaudeUsageWindow(usageObj.seven_day);
      claude.quota5h = fiveHour ? fiveHour.remainingPercent : null;
      claude.quota7d = sevenDay ? sevenDay.remainingPercent : null;
      claude.quotaSupported = claude.quota5h != null || claude.quota7d != null;
      if (!claude.quotaSupported) {
        claude.error = 'Claude usage returned no recognized windows';
      }
    } catch (err) {
      claude.error = err instanceof Error ? err.message : String(err);
    }
  } else if (!claude.installed) {
    claude.error = 'Claude not installed';
  } else {
    claude.error = 'Claude not logged in';
  }

  return {
    checkedAt: new Date().toISOString(),
    codex,
    claude,
  };
}

async function getQuotaSnapshotCached(): Promise<RunnerQuotaSnapshot> {
  const now = Date.now();
  if (quotaCache && quotaCache.expiresAt > now) {
    return quotaCache.value;
  }
  const value = await collectQuotaSnapshot();
  quotaCache = { value, expiresAt: now + QUOTA_REFRESH_MS };
  return value;
}

async function hello(): Promise<void> {
  const workspace = await getWorkspaceSnapshotCached();
  const externalTasks = getExternalTaskSnapshotCached();
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
      workspace,
      recommendedWorkDir: workspace.defaultWorkDir,
      externalTasks,
    },
  });
}

async function runCommand(command: string, args: string[], timeoutMs = 8000): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
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
  const workspace = await getWorkspaceSnapshotCached();
  const externalTasks = getExternalTaskSnapshotCached();

  return {
    checkedAt: new Date().toISOString(),
    platform: detectPlatform(),
    host: os.hostname(),
    node: process.version,
    adapters: {
      codex: {
        installed: codexVersion.ok,
        version: codexVersion.output || '',
      },
      claudeCode: {
        installed: claudeVersion.ok,
        version: claudeVersion.output || '',
      },
    },
    workspace,
    externalTasks,
  };
}

async function reportHealth(): Promise<void> {
  const health = await collectHealthSnapshot();
  await apiPost('/api/runner/health', { health });
}

async function emitRunnerLog(level: 'info' | 'warn' | 'error', message: string): Promise<void> {
  const stamp = new Date().toISOString();
  const localLine = `[${stamp}] [runner] [${level}] ${message}`;
  if (level === 'error') {
    console.error(localLine);
  } else if (level === 'warn') {
    console.warn(localLine);
  } else {
    console.log(localLine);
  }
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

    const nextAdapterConfig = { ...job.adapterConfig };
    const originalWorkDir = typeof nextAdapterConfig.workDir === 'string' ? String(nextAdapterConfig.workDir).trim() : '';
    const resolvedWorkDir = resolveRunnerWorkDir(originalWorkDir);
    nextAdapterConfig.workDir = resolvedWorkDir;
    if (originalWorkDir !== resolvedWorkDir) {
      await emitRunnerLog('info', `job=${job.id} remap workDir "${originalWorkDir || '(empty)'}" -> "${resolvedWorkDir}"`);
    }

    const result: AdapterRunResult = await adapter.run(job.prompt, {
      ...nextAdapterConfig,
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

console.log(
  `[runner] starting id=${RUNNER_ID} server=${SERVER} platform=${detectPlatform()} `
  + `externalScan=${EXTERNAL_TASK_SCAN_ENABLED ? 'on' : 'off'} `
  + `codex=${EXTERNAL_TASK_SCAN_CODEX ? 'on' : 'off'} `
  + `claude=${EXTERNAL_TASK_SCAN_CLAUDE ? 'on' : 'off'} `
  + `noiseFilter=${EXTERNAL_TASK_FILTER_NOISE ? 'on' : 'off'}`,
);
void emitRunnerLog('info', `runner started id=${RUNNER_ID} server=${SERVER} platform=${detectPlatform()}`).catch(() => {});
void runLoop();
