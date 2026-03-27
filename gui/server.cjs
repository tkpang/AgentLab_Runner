// AgentLab Runner Web GUI - cross-platform backend server
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync, exec } = require('child_process');

const PORT = Number(process.env.AGENTLAB_GUI_PORT || 8765);
const GUI_DIR = __dirname;
const ROOT_DIR = path.join(__dirname, '..');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');
const IS_WIN = process.platform === 'win32';
const RUNNER_BIN_PATHS = [
  path.join(ROOT_DIR, '.runtime', 'node', 'current'),
  path.join(ROOT_DIR, '.runtime', 'node', 'current', 'bin'),
  path.join(ROOT_DIR, '.tools', 'npm-global'),
  path.join(ROOT_DIR, '.tools', 'npm-global', 'bin'),
  path.join(ROOT_DIR, '.tools', 'npm-global', 'node_modules', '.bin')
];

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

function buildRunnerEnv(extraEnv = {}) {
  const availableLocalPaths = RUNNER_BIN_PATHS.filter((p) => exists(p));
  const currentPath = process.env.PATH || '';
  return {
    ...process.env,
    ...extraEnv,
    PATH: [...availableLocalPaths, currentPath].join(path.delimiter)
  };
}

function commandExists(cmd) {
  const checker = IS_WIN ? 'where' : 'which';
  const out = spawnSync(checker, [cmd], { stdio: 'ignore', env: buildRunnerEnv() });
  return out.status === 0;
}

function commandVersion(cmd) {
  if (!commandExists(cmd)) return '';
  const out = spawnSync(cmd, ['--version'], { encoding: 'utf8', env: buildRunnerEnv() });
  const text = `${out.stdout || ''}\n${out.stderr || ''}`.trim();
  return text.split(/\r?\n/)[0] || '';
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: ROOT_DIR,
      windowsHide: true,
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
  const codexInstalled = commandExists('codex');
  const codex = {
    installed: codexInstalled,
    version: commandVersion('codex'),
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

  const claudeInstalled = commandExists('claude');
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
    if (!commandExists('codex')) {
      resolve({ ok: false, error: 'codex not installed' });
      return;
    }

    const initId = 'init-1';
    const rateId = 'rate-1';
    const proc = spawn('codex', ['app-server'], {
      cwd: ROOT_DIR,
      windowsHide: true,
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
    quotaSupported: false
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
      }
    }
  }

  const claudeQuota = {
    installed: Boolean(auth.claude.installed),
    loggedIn: Boolean(auth.claude.loggedIn),
    quota5h: null,
    quota7d: null,
    quotaSupported: false
  };

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

async function startRunnerHandler() {
  if (IS_WIN) {
    const scriptPath = path.join(SCRIPTS_DIR, 'start-runner.ps1');
    runDetached('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ]);
    return { ok: true, message: 'Runner 已启动（Windows）' };
  }

  const scriptPath = path.join(SCRIPTS_DIR, 'start-runner.sh');
  runDetached('bash', [scriptPath]);
  return { ok: true, message: 'Runner 已启动（Linux）' };
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
  openBrowser(`http://localhost:${PORT}`);
});
