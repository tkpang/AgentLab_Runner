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

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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

function commandExists(cmd) {
  const checker = IS_WIN ? 'where' : 'which';
  const out = spawnSync(checker, [cmd], { stdio: 'ignore' });
  return out.status === 0;
}

function commandVersion(cmd) {
  if (!commandExists(cmd)) return '';
  const out = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
  const text = `${out.stdout || ''}\n${out.stderr || ''}`.trim();
  return text.split(/\r?\n/)[0] || '';
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: ROOT_DIR,
      windowsHide: true,
      ...options
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
    ...options
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
    loggedIn: Boolean(codexAuth && hasToken(codexAuth)),
    email: codexAuth ? extractEmail(codexAuth) : '',
    authPath: path.join(home, '.codex', 'auth.json')
  };

  const claudePaths = [
    path.join(home, '.claude.json'),
    path.join(home, '.claude', 'credentials.json'),
    path.join(home, '.claude', 'config.json')
  ];
  let claudeAuth = null;
  for (const p of claudePaths) {
    claudeAuth = readJsonSafe(p);
    if (claudeAuth) break;
  }

  const claudeInstalled = commandExists('claude');
  const claude = {
    installed: claudeInstalled,
    version: commandVersion('claude'),
    loggedIn: Boolean(claudeAuth && hasToken(claudeAuth)),
    email: claudeAuth ? extractEmail(claudeAuth) : ''
  };

  return { codex, claude };
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
            codex: { ...local.codex, ...(json.codex || {}) },
            claude: { ...local.claude, ...(json.claude || {}) }
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

async function quotaHandler() {
  const auth = localAuthState();

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
          return {
            ok: true,
            timestamp: json.refreshedAt || new Date().toLocaleString('zh-CN'),
            codex: {
              installed: auth.codex.installed,
              loggedIn: auth.codex.loggedIn,
              quota5h: json.primary ? json.primary.remainingPercent : 0,
              quota7d: json.secondary ? json.secondary.remainingPercent : 0
            },
            claude: {
              installed: auth.claude.installed,
              loggedIn: auth.claude.loggedIn,
              quota5h: 0,
              quota7d: 0
            }
          };
        }
      } catch {
        // ignore and fallback
      }
    }
  }

  return {
    ok: true,
    timestamp: new Date().toLocaleString('zh-CN'),
    codex: {
      installed: auth.codex.installed,
      loggedIn: auth.codex.loggedIn,
      quota5h: 0,
      quota7d: 0
    },
    claude: {
      installed: auth.claude.installed,
      loggedIn: auth.claude.loggedIn,
      quota5h: 0,
      quota7d: 0
    },
    warning: IS_WIN ? '未获取到额度详细数据' : 'Linux 暂未接入额度查询，先显示登录状态。'
  };
}

async function installHandler() {
  if (IS_WIN) {
    const scriptPath = path.join(SCRIPTS_DIR, 'setup-windows.ps1');
    runDetached('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-InstallCodex',
      '-InstallClaude'
    ]);
    return { ok: true, message: 'Windows 安装任务已启动' };
  }

  const scriptPath = path.join(SCRIPTS_DIR, 'setup-ubuntu.sh');
  runDetached('bash', [scriptPath]);
  return { ok: true, message: 'Linux 安装脚本已启动（可能需要 sudo）' };
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
  '/api/login-codex': loginCodexHandler,
  '/api/login-claude': loginClaudeHandler,
  '/api/open-shell': openShellHandler,
  '/api/start-runner': startRunnerHandler,
  '/api/slots': slotsListHandler,
  '/api/save-slot': saveSlotHandler,
  '/api/activate-slot': activateSlotHandler
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
