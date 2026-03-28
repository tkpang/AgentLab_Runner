// AgentLab Runner Web GUI - cross-platform backend server
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync, exec } = require('child_process');

const DEFAULT_GUI_PORT = 18765;
const PORT = Number(process.env.AGENTLAB_GUI_PORT || DEFAULT_GUI_PORT);
const GUI_DIR = __dirname;
const ROOT_DIR = path.join(__dirname, '..');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');
const RUN_DIR = path.join(ROOT_DIR, '.run');
const RUNNER_CONFIG_PATH = path.join(RUN_DIR, 'runner-config.json');
const RUNNER_LOG_PATH = path.join(RUN_DIR, 'runner.log');
const RUNNER_ERR_LOG_PATH = path.join(RUN_DIR, 'runner.err.log');
const IS_WIN = process.platform === 'win32';
const RUNNER_BIN_PATHS = [
  path.join(ROOT_DIR, '.runtime', 'node', 'current'),
  path.join(ROOT_DIR, '.runtime', 'node', 'current', 'bin'),
  path.join(ROOT_DIR, '.tools', 'npm-global'),
  path.join(ROOT_DIR, '.tools', 'npm-global', 'bin'),
  path.join(ROOT_DIR, '.tools', 'npm-global', 'node_modules', '.bin')
];
let cachedGlobalRunnerBinPaths = null;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    // ignore
  }
}

function listVsCodeCodexBinDirs() {
  if (!IS_WIN) return [];
  const home = os.homedir();
  const extensionRoots = [
    path.join(home, '.vscode', 'extensions'),
    path.join(home, '.vscode-insiders', 'extensions'),
  ];
  const dirs = [];
  for (const root of extensionRoots) {
    if (!exists(root)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith('openai.chatgpt-')) continue;
      const binDir = path.join(root, entry.name, 'bin', 'windows-x86_64');
      const exePath = path.join(binDir, 'codex.exe');
      if (exists(exePath)) {
        dirs.push(binDir);
      }
    }
  }
  return dirs;
}

function globalRunnerBinPaths() {
  if (cachedGlobalRunnerBinPaths) return cachedGlobalRunnerBinPaths;
  if (!IS_WIN) {
    cachedGlobalRunnerBinPaths = [];
    return cachedGlobalRunnerBinPaths;
  }

  const candidates = [
    path.join(process.env.APPDATA || '', 'npm'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs'),
    path.join(process.env.ProgramFiles || '', 'nodejs'),
    ...listVsCodeCodexBinDirs(),
  ];
  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!exists(candidate)) continue;
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  cachedGlobalRunnerBinPaths = unique;
  return cachedGlobalRunnerBinPaths;
}

function defaultRunnerConfig() {
  return {
    server: String(process.env.RUNNER_SERVER || 'http://127.0.0.1:3200').trim(),
    token: String(process.env.RUNNER_TOKEN || '').trim(),
    runnerId: String(process.env.RUNNER_ID || '').trim(),
    autoStart: false,
  };
}

function readRunnerConfig() {
  const defaults = defaultRunnerConfig();
  const raw = readJsonSafe(RUNNER_CONFIG_PATH);
  if (!raw || typeof raw !== 'object') return defaults;
  return {
    server: typeof raw.server === 'string' && raw.server.trim() ? raw.server.trim() : defaults.server,
    token: typeof raw.token === 'string' ? raw.token.trim() : defaults.token,
    runnerId: typeof raw.runnerId === 'string' ? raw.runnerId.trim() : defaults.runnerId,
    autoStart: typeof raw.autoStart === 'boolean' ? raw.autoStart : defaults.autoStart,
  };
}

function saveRunnerConfig(input) {
  ensureDir(RUN_DIR);
  const server = typeof input?.server === 'string' ? input.server.trim() : '';
  const token = typeof input?.token === 'string' ? input.token.trim() : '';
  const runnerId = typeof input?.runnerId === 'string' ? input.runnerId.trim() : '';
  const autoStart = typeof input?.autoStart === 'boolean' ? input.autoStart : readRunnerConfig().autoStart;
  const next = {
    server: server || defaultRunnerConfig().server,
    token,
    runnerId,
    autoStart,
  };
  fs.writeFileSync(RUNNER_CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function buildRunnerEnv(extraEnv = {}) {
  const availableLocalPaths = RUNNER_BIN_PATHS.filter((p) => exists(p));
  const availableGlobalPaths = globalRunnerBinPaths();
  const currentPath = process.env.PATH || '';
  return {
    ...process.env,
    ...extraEnv,
    PATH: [...availableLocalPaths, ...availableGlobalPaths, currentPath].join(path.delimiter)
  };
}

function commandExists(cmd) {
  const checker = IS_WIN ? 'where' : 'which';
  const out = spawnSync(checker, [cmd], { stdio: 'ignore', env: buildRunnerEnv() });
  return out.status === 0;
}

function localNodeExecutable() {
  if (!IS_WIN) return '';
  const candidates = [
    path.join(ROOT_DIR, '.runtime', 'node', 'current', 'node.exe'),
    path.join(ROOT_DIR, '.runtime', 'node', 'current', 'bin', 'node.exe'),
  ];
  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  return '';
}

function localCodexEntry() {
  if (!IS_WIN) return '';
  const candidate = path.join(ROOT_DIR, '.tools', 'npm-global', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  return exists(candidate) ? candidate : '';
}

function localCliPath(name) {
  if (!IS_WIN) return '';
  const candidates = [
    path.join(ROOT_DIR, '.tools', 'npm-global', `${name}.cmd`),
    path.join(ROOT_DIR, '.tools', 'npm-global', 'bin', `${name}.cmd`),
  ];
  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  return '';
}

function commandVersion(cmd) {
  if (!cmd) return '';
  if (!commandExists(cmd)) return '';
  const out = spawnSync(cmd, ['--version'], { encoding: 'utf8', env: buildRunnerEnv(), shell: IS_WIN });
  const text = `${out.stdout || ''}\n${out.stderr || ''}`.trim();
  return text.split(/\r?\n/)[0] || '';
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: ROOT_DIR,
      windowsHide: true,
      shell: IS_WIN,
      ...options,
      env: buildRunnerEnv(options.env || {})
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });

    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      resolve({ code: Number.isInteger(code) ? code : -1, stdout, stderr });
    });
  });
}

function runDetached(command, args = [], options = {}) {
  const proc = spawn(command, args, {
    cwd: ROOT_DIR,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
    ...options,
    env: buildRunnerEnv(options.env || {})
  });
  proc.unref();
}

function parseFirstJson(text) {
  const lines = String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith('{') && !line.startsWith('[')) continue;
    try {
      return JSON.parse(line);
    } catch {
      // ignore
    }
  }
  return null;
}

function readJsonSafe(filePath) {
  try {
    if (!exists(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function walkFind(obj, predicate) {
  if (obj == null) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = walkFind(item, predicate);
      if (found != null) return found;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (predicate(k, v)) return v;
      const found = walkFind(v, predicate);
      if (found != null) return found;
    }
    return null;
  }
  return null;
}

function hasToken(obj) {
  return Boolean(walkFind(obj, (k, v) => {
    if (typeof v !== 'string' || !v.trim()) return false;
    const key = String(k || '').toLowerCase();
    return key.includes('token') || key.includes('key');
  }));
}

function extractEmail(obj) {
  const value = walkFind(obj, (k, v) => String(k || '').toLowerCase() === 'email' && typeof v === 'string' && v.trim());
  return value ? String(value) : '';
}

function localAuthState() {
  const home = os.homedir();

  const codexAuth = readJsonSafe(path.join(home, '.codex', 'auth.json'));
  const codexCli = localCliPath('codex');
  const codexInstalled = Boolean(codexCli) || commandExists('codex') || commandExists('codex.cmd');
  const codexVersion = (() => {
    const nodeExe = localNodeExecutable();
    const codexEntry = localCodexEntry();
    if (nodeExe && codexEntry) {
      const out = spawnSync(nodeExe, [codexEntry, '--version'], { encoding: 'utf8', env: buildRunnerEnv() });
      const text = `${out.stdout || ''}\n${out.stderr || ''}`.trim();
      return text.split(/\r?\n/)[0] || '';
    }
    return commandVersion('codex');
  })();
  const codex = {
    installed: codexInstalled,
    version: codexVersion,
    loggedIn: Boolean((codexAuth && hasToken(codexAuth)) || process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN),
    email: codexAuth ? extractEmail(codexAuth) : '',
    authPath: path.join(home, '.codex', 'auth.json')
  };

  const claudePaths = [
    path.join(home, '.claude.json'),
    path.join(home, '.claude', '.credentials.json'),
    path.join(home, '.claude', 'credentials.json'),
    path.join(home, '.claude', 'config.json')
  ];
  let claudeAuth = null;
  let claudeAuthWithToken = null;
  for (const p of claudePaths) {
    const parsed = readJsonSafe(p);
    if (!parsed) continue;
    if (!claudeAuth) {
      claudeAuth = parsed;
    }
    if (hasToken(parsed)) {
      claudeAuthWithToken = parsed;
      break;
    }
  }
  const effectiveClaudeAuth = claudeAuthWithToken || claudeAuth;

  const claudeCli = localCliPath('claude');
  const claudeInstalled = Boolean(claudeCli) || commandExists('claude') || commandExists('claude.cmd');
  const claude = {
    installed: claudeInstalled,
    version: commandVersion('claude'),
    loggedIn: Boolean((effectiveClaudeAuth && hasToken(effectiveClaudeAuth)) || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    email: effectiveClaudeAuth ? extractEmail(effectiveClaudeAuth) : ''
  };

  return { codex, claude };
}

function mergeToolState(localTool, scriptTool) {
  if (!scriptTool || typeof scriptTool !== 'object') return localTool;
  const merged = { ...localTool, ...scriptTool };
  merged.installed = Boolean(localTool?.installed || scriptTool?.installed);
  merged.loggedIn = Boolean(localTool?.loggedIn || scriptTool?.loggedIn);
  merged.email = String(localTool?.email || scriptTool?.email || '');
  merged.version = String(localTool?.version || scriptTool?.version || '');
  return merged;
}

async function checkAuthHandler() {
  const local = localAuthState();

  // On Windows, merge script result if available for richer status.
  if (IS_WIN) {
    const scriptPath = path.join(SCRIPTS_DIR, 'check-auth-status-gui.ps1');
    if (exists(scriptPath)) {
      try {
        const result = await runCommand('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-File', scriptPath,
          '-Json'
        ]);
        const json = parseFirstJson(result.stdout);
        if (result.code === 0 && json && json.ok) {
          return {
            ok: true,
            platform: process.platform,
            codex: mergeToolState(local.codex, json.codex),
            claude: mergeToolState(local.claude, json.claude)
          };
        }
      } catch {
        // ignore and fallback to local
      }
    }
  }

  return {
    ok: true,
    platform: process.platform,
    codex: local.codex,
    claude: local.claude
  };
}

function normalizePercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function extractRemainingPercent(bucket) {
  if (!bucket || typeof bucket !== 'object') return null;
  const remainingDirect = normalizePercent(bucket.remainingPercent);
  if (remainingDirect != null) return remainingDirect;
  const used = normalizePercent(bucket.usedPercent);
  if (used == null) return null;
  return Math.max(0, 100 - used);
}

function parsePercentFromUtilization(value) {
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

function parseNonNegativeInt(value, fallback = 0) {
  const num = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function readClaudeOauthToken() {
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
    const credentials = readJsonSafe(filePath);
    if (!credentials) continue;
    const nestedOauth = credentials && typeof credentials.claudeAiOauth === 'object' ? credentials.claudeAiOauth : null;
    const nestedToken = nestedOauth && typeof nestedOauth.accessToken === 'string'
      ? nestedOauth.accessToken.trim()
      : '';
    if (nestedToken) return nestedToken;
    const flatToken = typeof credentials.accessToken === 'string' ? credentials.accessToken.trim() : '';
    if (flatToken) return flatToken;
    const fallbackToken = walkFind(credentials, (k, v) => {
      if (typeof v !== 'string' || !v.trim()) return false;
      const key = String(k || '').toLowerCase();
      return key === 'accesstoken' || key === 'oauth_token' || key === 'oauthtoken';
    });
    if (typeof fallbackToken === 'string' && fallbackToken.trim()) {
      return fallbackToken.trim();
    }
  }
  return '';
}

async function requestClaudeOauthUsage(timeoutMs = 10000) {
  const token = readClaudeOauthToken();
  if (!token) throw new Error('未检测到 Claude OAuth token（CLAUDE_CODE_OAUTH_TOKEN 或 ~/.claude/.credentials.json）');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    const bodyText = await response.text();
    let body = null;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      const detail = String(bodyText || '').slice(0, 240);
      throw new Error(`Claude usage 请求失败: HTTP ${response.status}${retryAfter ? `, Retry-After=${retryAfter}` : ''}${detail ? `, body=${detail}` : ''}`);
    }
    if (!body || typeof body !== 'object') {
      throw new Error('Claude usage 返回体不是 JSON 对象');
    }
    return body;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Claude usage 请求超时（>${timeoutMs}ms）`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function requestClaudeOauthUsageWithRetry() {
  try {
    return await requestClaudeOauthUsage();
  } catch (firstErr) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    if (msg.includes('HTTP ')) throw firstErr;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return requestClaudeOauthUsage();
  }
}

function parseClaudeUsageWindow(value) {
  if (!value || typeof value !== 'object') return null;
  const utilization = value.utilization ?? value.used_percentage ?? value.percent_used ?? value.usage;
  const usedPercent = parsePercentFromUtilization(utilization);
  if (usedPercent == null) return null;
  return {
    usedPercent,
    remainingPercent: Math.max(0, 100 - usedPercent)
  };
}

function parseCodexRateLimits(rateLimits) {
  if (!rateLimits || typeof rateLimits !== 'object') {
    return { quota5h: null, quota7d: null, quotaSupported: false };
  }
  const quota5h = extractRemainingPercent(rateLimits.primary);
  const quota7d = extractRemainingPercent(rateLimits.secondary);
  return {
    quota5h,
    quota7d,
    quotaSupported: quota5h != null || quota7d != null
  };
}

function fetchCodexRateLimitsViaAppServer() {
  return new Promise((resolve) => {
    const codexCli = localCliPath('codex');
    if (!codexCli && !commandExists('codex') && !commandExists('codex.cmd')) {
      resolve({ ok: false, error: 'codex not installed' });
      return;
    }
    const nodeExe = localNodeExecutable();
    const codexEntry = localCodexEntry();

    const initId = 'init-1';
    const rateId = 'rate-1';
    const proc = (IS_WIN && nodeExe && codexEntry)
      ? spawn(nodeExe, [codexEntry, 'app-server'], {
        cwd: ROOT_DIR,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: buildRunnerEnv()
      })
      : spawn('codex', ['app-server'], {
        cwd: ROOT_DIR,
        windowsHide: true,
        shell: IS_WIN,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: buildRunnerEnv()
      });

    let done = false;
    let stdoutBuffer = '';
    let stderrText = '';
    const timeout = setTimeout(() => {
      finish({ ok: false, error: 'timeout waiting codex rate limits' });
    }, 15000);

    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      try { proc.stdin.end(); } catch {}
      try { proc.kill(); } catch {}
      resolve(result);
    }

    function send(payload) {
      try {
        proc.stdin.write(`${JSON.stringify(payload)}\n`);
      } catch (error) {
        finish({ ok: false, error: error.message || String(error) });
      }
    }

    proc.on('error', (error) => {
      finish({ ok: false, error: error.message || String(error) });
    });

    proc.stderr.on('data', (chunk) => {
      stderrText += chunk.toString();
    });

    proc.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      while (true) {
        const breakPos = stdoutBuffer.indexOf('\n');
        if (breakPos < 0) break;
        const line = stdoutBuffer.slice(0, breakPos).trim();
        stdoutBuffer = stdoutBuffer.slice(breakPos + 1);
        if (!line) continue;

        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }

        if (msg?.id === initId && msg?.result) {
          send({ method: 'initialized' });
          send({ id: rateId, method: 'account/rateLimits/read' });
          continue;
        }

        if (msg?.id === rateId) {
          const rateLimits = msg?.result?.rateLimits || msg?.result || null;
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
          name: 'agentlab-runner-gui',
          title: 'AgentLab Runner GUI',
          version: '1.0.0'
        },
        capabilities: {
          experimentalApi: true
        }
      }
    });
  });
}

async function quotaHandler() {
  const authPayload = await checkAuthHandler();
  const auth = {
    codex: authPayload?.codex || localAuthState().codex,
    claude: authPayload?.claude || localAuthState().claude
  };

  const codexQuota = {
    installed: Boolean(auth.codex.installed),
    loggedIn: Boolean(auth.codex.loggedIn),
    quota5h: null,
    quota7d: null,
    quotaSupported: false,
    error: null,
  };

  const warnings = [];
  let timestamp = new Date().toLocaleString('zh-CN');

  if (codexQuota.installed && codexQuota.loggedIn) {
    let parsedFromScript = false;

    if (IS_WIN) {
      const scriptPath = path.join(SCRIPTS_DIR, 'quota-status-windows.ps1');
      if (exists(scriptPath)) {
        try {
          const result = await runCommand('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath,
            '-Json'
          ]);
          const json = parseFirstJson(result.stdout);
          if (result.code === 0 && json && json.ok) {
            const parsed = parseCodexRateLimits({
              primary: json.primary || null,
              secondary: json.secondary || null
            });
            codexQuota.quota5h = parsed.quota5h;
            codexQuota.quota7d = parsed.quota7d;
            codexQuota.quotaSupported = parsed.quotaSupported;
            parsedFromScript = true;
            if (json.refreshedAt) timestamp = json.refreshedAt;
          } else {
            warnings.push(json?.error || result.stderr || 'Windows quota script failed');
          }
        } catch (error) {
          warnings.push(error.message || String(error));
        }
      }
    }

    if (!parsedFromScript || !codexQuota.quotaSupported) {
      const probe = await fetchCodexRateLimitsViaAppServer();
      if (probe.ok) {
        const parsed = parseCodexRateLimits(probe.rateLimits);
        codexQuota.quota5h = parsed.quota5h;
        codexQuota.quota7d = parsed.quota7d;
        codexQuota.quotaSupported = parsed.quotaSupported;
      } else if (probe.error) {
        warnings.push(probe.error);
        codexQuota.error = probe.error;
      }
    }
  }
  if (!codexQuota.installed) {
    codexQuota.error = codexQuota.error || 'Codex 未安装';
  } else if (!codexQuota.loggedIn) {
    codexQuota.error = codexQuota.error || 'Codex 未登录';
  } else if (!codexQuota.quotaSupported) {
    codexQuota.error = codexQuota.error || 'Codex 当前无法读取额度';
  }

  const claudeOauthToken = readClaudeOauthToken();
  const claudeQuota = {
    installed: Boolean(auth.claude.installed),
    loggedIn: Boolean(auth.claude.loggedIn || claudeOauthToken),
    quota5h: null,
    quota7d: null,
    quotaSupported: false,
    error: null,
  };

  if (claudeQuota.installed && claudeQuota.loggedIn) {
    try {
      const usage = await requestClaudeOauthUsageWithRetry();
      const fiveHour = parseClaudeUsageWindow(usage?.five_hour);
      const sevenDay = parseClaudeUsageWindow(usage?.seven_day);
      claudeQuota.quota5h = fiveHour ? fiveHour.remainingPercent : null;
      claudeQuota.quota7d = sevenDay ? sevenDay.remainingPercent : null;
      claudeQuota.quotaSupported = claudeQuota.quota5h != null || claudeQuota.quota7d != null;
      if (!claudeQuota.quotaSupported) {
        warnings.push('Claude usage 返回成功，但未包含可识别窗口');
        claudeQuota.error = 'Claude usage 返回成功，但未包含可识别窗口';
      }
    } catch (error) {
      const message = error?.message || String(error);
      warnings.push(message);
      claudeQuota.error = message;
    }
  }
  if (!claudeQuota.installed) {
    claudeQuota.error = claudeQuota.error || 'Claude 未安装';
  } else if (!claudeQuota.loggedIn) {
    claudeQuota.error = claudeQuota.error || 'Claude 未登录（未检测到 OAuth token）';
  } else if (!claudeQuota.quotaSupported) {
    claudeQuota.error = claudeQuota.error || 'Claude 当前无法读取额度';
  }

  const payload = {
    ok: true,
    timestamp,
    codex: codexQuota,
    claude: claudeQuota
  };
  if (warnings.length) {
    payload.warning = warnings.join(' | ');
  }
  return payload;
}

function readLogChunk(filePath, fromOffset, maxBytes = 128 * 1024) {
  try {
    if (!exists(filePath)) {
      return { offset: 0, lines: [], truncated: false };
    }
    const stat = fs.statSync(filePath);
    const size = Number(stat.size || 0);
    if (size <= 0) {
      return { offset: 0, lines: [], truncated: false };
    }

    let start = parseNonNegativeInt(fromOffset, 0);
    if (start > size) start = size;

    let truncated = false;
    if (size - start > maxBytes) {
      start = Math.max(0, size - maxBytes);
      truncated = true;
    }
    if (start >= size) {
      return { offset: size, lines: [], truncated: false };
    }

    const readSize = size - start;
    const buffer = Buffer.allocUnsafe(readSize);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, buffer, 0, readSize, start);
    } finally {
      fs.closeSync(fd);
    }

    let text = buffer.toString('utf8');
    if (start > 0 && text && !text.startsWith('\n')) {
      const firstBreak = text.indexOf('\n');
      text = firstBreak >= 0 ? text.slice(firstBreak + 1) : '';
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);
    return { offset: size, lines, truncated };
  } catch {
    return { offset: parseNonNegativeInt(fromOffset, 0), lines: [], truncated: false };
  }
}

async function runnerLogTailHandler(_body, req) {
  const requestUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const logOffset = parseNonNegativeInt(requestUrl.searchParams.get('logOffset'), 0);
  const errOffset = parseNonNegativeInt(requestUrl.searchParams.get('errOffset'), 0);

  return {
    ok: true,
    log: readLogChunk(RUNNER_LOG_PATH, logOffset),
    err: readLogChunk(RUNNER_ERR_LOG_PATH, errOffset),
  };
}

async function installHandler() {
  return installByTools({ codex: true, claude: true });
}

function shQuote(input) {
  return `'${String(input).replace(/'/g, `'\\''`)}'`;
}

async function uninstallHandler(body) {
  const tool = String(body?.tool || '').trim().toLowerCase();
  if (!['codex', 'claude'].includes(tool)) {
    return { ok: false, error: 'Invalid tool, expected codex or claude' };
  }

  if (IS_WIN) {
    const scriptPath = path.join(SCRIPTS_DIR, 'uninstall-windows.ps1');
    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ];
    if (tool === 'codex') args.push('-RemoveCodex');
    if (tool === 'claude') args.push('-RemoveClaude');
    runDetached('powershell.exe', args);
    return { ok: true, message: `Windows ${tool} 卸载任务已启动` };
  }

  const npmPrefix = path.join(ROOT_DIR, '.tools', 'npm-global');
  const packageName = tool === 'codex' ? '@openai/codex' : '@anthropic-ai/claude-code';
  const binPrefix = tool === 'codex' ? 'codex' : 'claude';
  const cmd = [
    `PREFIX=${shQuote(npmPrefix)}`,
    `if command -v npm >/dev/null 2>&1; then npm uninstall -g --prefix "$PREFIX" ${packageName} --no-audit --fund=false --progress=false || true; fi`,
    `rm -f "$PREFIX/bin/${binPrefix}"* || true`,
    `rm -f "$PREFIX/node_modules/.bin/${binPrefix}"* || true`
  ].join(' ; ');
  runDetached('bash', ['-lc', cmd]);
  return { ok: true, message: `Linux ${tool} 卸载任务已启动` };
}

async function installCodexHandler() {
  return installByTools({ codex: true, claude: false });
}

async function installClaudeHandler() {
  return installByTools({ codex: false, claude: true });
}

async function installByTools({ codex, claude }) {
  const installCodex = Boolean(codex);
  const installClaude = Boolean(claude);
  if (!installCodex && !installClaude) {
    return { ok: false, error: 'No tool selected for install' };
  }

  if (IS_WIN) {
    const scriptPath = path.join(SCRIPTS_DIR, 'setup-windows.ps1');
    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ];
    if (installCodex) args.push('-InstallCodex');
    if (installClaude) args.push('-InstallClaude');
    runDetached('powershell.exe', [
      ...args
    ]);
    if (installCodex && installClaude) return { ok: true, message: 'Windows 安装任务已启动（Codex + Claude）' };
    if (installCodex) return { ok: true, message: 'Windows Codex 安装任务已启动' };
    return { ok: true, message: 'Windows Claude 安装任务已启动' };
  }

  const scriptPath = path.join(SCRIPTS_DIR, 'setup-ubuntu.sh');
  const args = [scriptPath];
  if (installCodex) args.push('--codex');
  if (installClaude) args.push('--claude');
  runDetached('bash', args);
  if (installCodex && installClaude) return { ok: true, message: 'Linux 安装脚本已启动（Codex + Claude）' };
  if (installCodex) return { ok: true, message: 'Linux Codex 安装脚本已启动' };
  return { ok: true, message: 'Linux Claude 安装脚本已启动' };
}

async function loginCodexHandler() {
  if (IS_WIN) {
    const scriptPath = path.join(SCRIPTS_DIR, 'login-codex-device.ps1');
    runDetached('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ]);
    return { ok: true, message: 'Codex 登录任务已启动' };
  }

  runDetached('bash', ['-lc', `cd "${ROOT_DIR}" && codex login --device-auth`]);
  return { ok: true, message: 'Codex 登录已在后台启动，请按终端提示完成授权。' };
}

async function loginClaudeHandler() {
  if (IS_WIN) {
    const scriptPath = path.join(SCRIPTS_DIR, 'login-claude-guide.ps1');
    runDetached('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ]);
    return { ok: true, message: 'Claude 登录引导已启动' };
  }

  runDetached('bash', ['-lc', `cd "${ROOT_DIR}" && claude login`]);
  return { ok: true, message: 'Claude 登录已在后台启动。' };
}

async function openShellHandler() {
  if (IS_WIN) {
    const scriptPath = path.join(SCRIPTS_DIR, 'runner-shell.ps1');
    runDetached('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ]);
    return { ok: true, message: 'Runner 终端已打开' };
  }

  const shellCmd = `cd "${ROOT_DIR}"; exec bash`;
  if (commandExists('x-terminal-emulator')) {
    runDetached('x-terminal-emulator', ['-e', 'bash', '-lc', shellCmd]);
    return { ok: true, message: 'Runner 终端已打开' };
  }
  if (commandExists('gnome-terminal')) {
    runDetached('gnome-terminal', ['--', 'bash', '-lc', shellCmd]);
    return { ok: true, message: 'Runner 终端已打开' };
  }
  return { ok: false, error: '未检测到图形终端程序，请手动在终端执行: bash scripts/start-runner.sh' };
}

async function startRunnerHandler(body) {
  const saved = readRunnerConfig();
  const serverUrlRaw = typeof body?.server === 'string' ? body.server.trim() : '';
  const tokenRaw = typeof body?.token === 'string' ? body.token.trim() : '';
  const runnerIdRaw = typeof body?.runnerId === 'string' ? body.runnerId.trim() : '';

  const serverUrl = (serverUrlRaw || saved.server || defaultRunnerConfig().server).replace(/\/+$/, '');
  const token = tokenRaw || saved.token;
  const runnerId = runnerIdRaw || saved.runnerId;

  if (!token) {
    return { ok: false, error: '缺少 Runner Token：请先在 AgentLab 复制环境 Token 并保存。' };
  }

  saveRunnerConfig({ server: serverUrl, token, runnerId });

  if (IS_WIN) {
    const scriptPath = path.join(ROOT_DIR, 'start.ps1');
    runDetached('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-Server', serverUrl,
      '-Token', token
    ], {
      env: runnerId ? { RUNNER_ID: runnerId } : {}
    });
    return { ok: true, message: `Runner 已启动（Windows） -> ${serverUrl}，日志见 .run/runner.log` };
  }

  const scriptPath = path.join(ROOT_DIR, 'start.sh');
  runDetached('bash', [scriptPath], {
    env: {
      RUNNER_SERVER: serverUrl,
      RUNNER_TOKEN: token,
      ...(runnerId ? { RUNNER_ID: runnerId } : {})
    }
  });
  return { ok: true, message: `Runner 已启动（Linux） -> ${serverUrl}，日志见 .run/runner.log` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopRunnerHandler() {
  const pidFile = path.join(RUN_DIR, 'runner.pid');
  const pid = readPidFromFile(pidFile);
  let hadRunningProcess = false;
  let stoppedByPid = false;

  if (isPidRunning(pid)) {
    hadRunningProcess = true;
    try {
      process.kill(pid);
      await sleep(500);
      if (isPidRunning(pid)) {
        process.kill(pid, 'SIGKILL');
      }
      stoppedByPid = true;
    } catch {
      // ignore and fallback below
    }
  }

  if (!stoppedByPid) {
    const fallbackStopped = killRunnerDaemonFallback();
    if (fallbackStopped) {
      hadRunningProcess = true;
      stoppedByPid = true;
    }
  }

  try {
    fs.unlinkSync(pidFile);
  } catch {
    // ignore
  }

  const runningAfter = isPidRunning(readPidFromFile(pidFile));
  if (runningAfter) {
    return { ok: false, error: 'Runner 停止失败，请手动检查进程。' };
  }

  if (hadRunningProcess || stoppedByPid) {
    return { ok: true, message: 'Runner 已停止。' };
  }
  return { ok: true, message: 'Runner 当前未运行。' };
}

function readPidFromFile(pidPath) {
  try {
    if (!exists(pidPath)) return 0;
    const raw = fs.readFileSync(pidPath, 'utf8').trim();
    if (!raw) return 0;
    const pid = Number.parseInt(raw, 10);
    if (!Number.isFinite(pid) || pid <= 0) return 0;
    return pid;
  } catch {
    return 0;
  }
}

function isPidRunning(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function writePidFile(pidPath, pid) {
  try {
    if (!Number.isFinite(pid) || pid <= 0) return;
    ensureDir(path.dirname(pidPath));
    fs.writeFileSync(pidPath, `${pid}\n`, 'utf8');
  } catch {
    // ignore
  }
}

function detectPidByPatterns(patterns = []) {
  const safePatterns = patterns
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  if (!safePatterns.length) return 0;

  if (IS_WIN) {
    const rootEscaped = ROOT_DIR.replace(/'/g, "''");
    const quotedPatterns = safePatterns.map((x) => `'${x.replace(/'/g, "''")}'`).join(',');
    const script = [
      `$root='${rootEscaped}'.ToLower()`,
      `$patterns=@(${quotedPatterns})`,
      "$proc = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {",
      "  $cmd = [string]$_.CommandLine",
      "  if ([string]::IsNullOrWhiteSpace($cmd)) { return $false }",
      "  $cmdLower = $cmd.ToLower()",
      "  if ($cmdLower -notlike ('*' + $root + '*')) { return $false }",
      "  foreach ($p in $patterns) { if ($cmdLower.Contains($p.ToLower())) { return $true } }",
      "  return $false",
      "} | Select-Object -First 1 -ExpandProperty ProcessId",
      "if ($proc) { Write-Output $proc }"
    ].join('; ');
    const out = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      env: buildRunnerEnv(),
    });
    const pid = Number.parseInt(String(out.stdout || '').trim(), 10);
    return Number.isFinite(pid) && pid > 0 ? pid : 0;
  }

  const patternExpr = safePatterns.join('|');
  const out = spawnSync('bash', ['-lc', `pgrep -f ${JSON.stringify(patternExpr)} | head -n 1`], {
    encoding: 'utf8',
    env: buildRunnerEnv(),
  });
  const pid = Number.parseInt(String(out.stdout || '').trim(), 10);
  return Number.isFinite(pid) && pid > 0 ? pid : 0;
}

function killRunnerDaemonFallback() {
  if (IS_WIN) {
    const rootEscaped = ROOT_DIR.replace(/'/g, "''");
    const script = [
      `$root='${rootEscaped}'.ToLower()`,
      "$patterns=@('agentlab-runner.ts','start-runner.ps1')",
      "$targets = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {",
      "  $cmd = [string]$_.CommandLine",
      "  if ([string]::IsNullOrWhiteSpace($cmd)) { return $false }",
      "  $cmdLower = $cmd.ToLower()",
      "  if ($cmdLower -notlike ('*' + $root + '*')) { return $false }",
      "  foreach ($p in $patterns) { if ($cmdLower.Contains($p)) { return $true } }",
      "  return $false",
      "}",
      "$count = 0",
      "foreach ($t in $targets) {",
      "  try { Stop-Process -Id ([int]$t.ProcessId) -Force -ErrorAction SilentlyContinue; $count++ } catch {}",
      "}",
      "Write-Output $count"
    ].join('; ');
    const out = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      env: buildRunnerEnv(),
    });
    const count = Number.parseInt(String(out.stdout || '').trim(), 10);
    return Number.isFinite(count) && count > 0;
  }

  try {
    spawnSync('bash', ['-lc', 'pkill -f "tsx .*agentlab-runner.ts|agentlab-runner.ts" >/dev/null 2>&1 || true'], {
      env: buildRunnerEnv(),
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function getRunnerRuntimeStatus() {
  const runnerPidPath = path.join(RUN_DIR, 'runner.pid');
  const guiPidPath = path.join(RUN_DIR, 'gui.pid');

  let runnerPid = readPidFromFile(runnerPidPath);
  let guiPid = readPidFromFile(guiPidPath);

  let runnerRunning = isPidRunning(runnerPid);
  let guiRunning = isPidRunning(guiPid);

  if (!runnerRunning) {
    const detectedRunnerPid = detectPidByPatterns(['agentlab-runner.ts', 'start-runner.ps1']);
    if (detectedRunnerPid > 0) {
      runnerPid = detectedRunnerPid;
      runnerRunning = true;
      writePidFile(runnerPidPath, detectedRunnerPid);
    }
  }

  if (!guiRunning) {
    const detectedGuiPid = detectPidByPatterns([
      'gui\\server.cjs',
      'gui/server.cjs',
      'electron-main.cjs',
      'electron\\dist\\electron.exe',
      'npx-cli.js" electron .',
      'node_modules\\.bin\\..\\electron\\cli.js',
      'start-web-gui.ps1',
      'start-desktop-gui.ps1'
    ]);
    if (detectedGuiPid > 0) {
      guiPid = detectedGuiPid;
      guiRunning = true;
      writePidFile(guiPidPath, detectedGuiPid);
    }
  }

  // This endpoint is served by the GUI backend itself; at minimum, GUI backend is alive.
  if (!guiRunning) {
    guiPid = process.pid;
    guiRunning = true;
    writePidFile(guiPidPath, process.pid);
  }

  return {
    ok: true,
    runner: {
      pid: runnerPid || null,
      running: runnerRunning
    },
    gui: {
      pid: guiPid || null,
      running: guiRunning
    }
  };
}

async function runnerRuntimeStatusHandler() {
  return getRunnerRuntimeStatus();
}

async function getRunnerConfigHandler() {
  const config = readRunnerConfig();
  return {
    ok: true,
    ...config,
    tokenMasked: config.token ? `${'*'.repeat(Math.max(4, Math.min(16, config.token.length - 4)))}${config.token.slice(-4)}` : ''
  };
}

async function saveRunnerConfigHandler(body) {
  const next = saveRunnerConfig(body || {});
  return { ok: true, ...next };
}

async function testRunnerConnectionHandler(body) {
  const serverRaw = typeof body?.server === 'string' ? body.server.trim() : '';
  const tokenRaw = typeof body?.token === 'string' ? body.token.trim() : '';
  const runnerIdRaw = typeof body?.runnerId === 'string' ? body.runnerId.trim() : '';
  const serverUrl = (serverRaw || readRunnerConfig().server || '').replace(/\/+$/, '');
  const token = tokenRaw || readRunnerConfig().token;
  const runnerId = runnerIdRaw || readRunnerConfig().runnerId || `${os.hostname()}-probe`;

  if (!serverUrl) return { ok: false, error: '缺少 Server 地址' };
  if (!token) return { ok: false, error: '缺少 Runner Token' };

  try {
    const res = await fetch(`${serverUrl}/api/runner/hello`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-runner-token': token
      },
      body: JSON.stringify({
        token,
        hello: {
          runnerId,
          host: os.hostname(),
          platform: process.platform,
          node: process.version,
          ts: new Date().toISOString(),
          source: 'agentlab-runner-gui'
        }
      })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: payload?.error || `连接失败 (HTTP ${res.status})` };
    }
    return {
      ok: true,
      message: '连接成功：Runner Token 与服务端匹配，可开始接任务。',
      environment: payload?.environment || null,
      queue: payload?.queue || null
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function slotsListHandler() {
  if (!IS_WIN) {
    return { ok: true, activeSlot: '', slots: [], message: 'Linux 暂未接入账号槽位管理。' };
  }
  const scriptPath = path.join(SCRIPTS_DIR, 'account-slots-windows.ps1');
  const result = await runCommand('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-Action', 'list',
    '-Json'
  ]);
  const json = parseFirstJson(result.stdout);
  if (!json) {
    return { ok: false, error: result.stderr || 'Failed to list slots' };
  }
  return json;
}

async function saveSlotHandler(body) {
  const slotName = String((body && body.name) || '').trim();
  if (!slotName) return { ok: false, error: 'Slot name required' };

  if (!IS_WIN) {
    return { ok: false, error: 'Linux 暂未接入账号槽位保存。' };
  }

  const scriptPath = path.join(SCRIPTS_DIR, 'account-slots-windows.ps1');
  const result = await runCommand('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-Action', 'save',
    '-Slot', slotName,
    '-Json'
  ]);
  const json = parseFirstJson(result.stdout);
  if (!json) {
    return { ok: false, error: result.stderr || 'Failed to save slot' };
  }
  return json;
}

async function activateSlotHandler(body) {
  const slotName = String((body && body.name) || '').trim();
  if (!slotName) return { ok: false, error: 'Slot name required' };

  if (!IS_WIN) {
    return { ok: false, error: 'Linux 暂未接入账号槽位启用。' };
  }

  const scriptPath = path.join(SCRIPTS_DIR, 'account-slots-windows.ps1');
  const result = await runCommand('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-Action', 'activate',
    '-Slot', slotName,
    '-Json'
  ]);
  const json = parseFirstJson(result.stdout);
  if (!json) {
    return { ok: false, error: result.stderr || 'Failed to activate slot' };
  }
  return json;
}

async function deleteSlotHandler(body) {
  const slotName = String((body && body.name) || '').trim();
  if (!slotName) return { ok: false, error: 'Slot name required' };

  if (!IS_WIN) {
    return { ok: false, error: 'Linux 暂未接入账号槽位删除。' };
  }

  const scriptPath = path.join(SCRIPTS_DIR, 'account-slots-windows.ps1');
  const result = await runCommand('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-Action', 'delete',
    '-Slot', slotName,
    '-Json'
  ]);
  const json = parseFirstJson(result.stdout);
  if (!json) {
    return { ok: false, error: result.stderr || 'Failed to delete slot' };
  }
  return json;
}

function openBrowser(url) {
  if (IS_WIN) {
    exec(`start "" "${url}"`);
    return;
  }
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${opener} "${url}" >/dev/null 2>&1 || true`);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
      if (data.length > 1024 * 1024) {
        data = data.slice(0, 1024 * 1024);
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

const apiHandlers = {
  '/api/check-auth': checkAuthHandler,
  '/api/quota': quotaHandler,
  '/api/install': installHandler,
  '/api/install-codex': installCodexHandler,
  '/api/install-claude': installClaudeHandler,
  '/api/uninstall': uninstallHandler,
  '/api/login-codex': loginCodexHandler,
  '/api/login-claude': loginClaudeHandler,
  '/api/open-shell': openShellHandler,
  '/api/start-runner': startRunnerHandler,
  '/api/stop-runner': stopRunnerHandler,
  '/api/runner/runtime-status': runnerRuntimeStatusHandler,
  '/api/runner/log-tail': runnerLogTailHandler,
  '/api/runner-config': getRunnerConfigHandler,
  '/api/runner-config/save': saveRunnerConfigHandler,
  '/api/runner/test-connection': testRunnerConnectionHandler,
  '/api/slots': slotsListHandler,
  '/api/save-slot': saveSlotHandler,
  '/api/activate-slot': activateSlotHandler,
  '/api/delete-slot': deleteSlotHandler
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const pathname = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
  if (pathname.startsWith('/api/')) {
    const handler = apiHandlers[pathname];
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'API not found' }));
      return;
    }

    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const result = await handler(body, req);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result || { ok: true }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: error.message || String(error) }));
    }
    return;
  }

  const fileName = pathname === '/' ? 'index-v2.html' : pathname.slice(1);
  const filePath = path.normalize(path.join(GUI_DIR, fileName));
  if (!filePath.startsWith(path.normalize(GUI_DIR))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(err.code === 'ENOENT' ? '404 Not Found' : '500 Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`AgentLab Runner Web GUI running at http://localhost:${PORT}`);
  console.log(`Platform: ${process.platform}`);
  console.log('Press Ctrl+C to stop the server');
  const noOpenBrowser = String(process.env.AGENTLAB_RUNNER_NO_BROWSER || '').trim() === '1';
  if (!noOpenBrowser) {
    openBrowser(`http://localhost:${PORT}`);
  }
});
