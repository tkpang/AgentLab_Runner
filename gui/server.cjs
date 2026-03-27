// AgentLab Runner Web GUI - Backend API Server
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8765;
const GUI_DIR = __dirname;
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json'
};

// Execute PowerShell script
function execPowerShell(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      ...args
    ]);

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    ps.on('error', (err) => {
      reject(err);
    });
  });
}

// API handlers
const apiHandlers = {
  '/api/check-auth': async () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'check-auth-status-gui.ps1');
    const result = await execPowerShell(scriptPath, ['-Json']);
    
    if (result.code === 0) {
      const lines = result.stdout.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{')) {
          return JSON.parse(trimmed);
        }
      }
    }
    
    return { ok: false, error: result.stderr || 'Failed to check auth status' };
  },

  '/api/quota': async () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'quota-status-windows.ps1');
    const result = await execPowerShell(scriptPath, ['-Json']);
    
    if (result.code === 0) {
      try {
        const data = JSON.parse(result.stdout.trim());
        return {
          ok: data.ok,
          timestamp: data.refreshedAt || new Date().toLocaleString('zh-CN'),
          codex: {
            loggedIn: true,
            quota5h: data.primary ? data.primary.remainingPercent : 0,
            quota7d: data.secondary ? data.secondary.remainingPercent : 0
          },
          claude: {
            loggedIn: false,
            quota5h: 0,
            quota7d: 0
          }
        };
      } catch (e) {
        const authScript = path.join(SCRIPTS_DIR, 'check-auth-status-gui.ps1');
        const authResult = await execPowerShell(authScript, ['-Json']);
        
        if (authResult.code === 0) {
          const lines = authResult.stdout.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('{')) {
              const authData = JSON.parse(trimmed);
              return {
                ok: true,
                timestamp: new Date().toLocaleString('zh-CN'),
                codex: {
                  loggedIn: authData.codex.loggedIn,
                  quota5h: 0,
                  quota7d: 0
                },
                claude: {
                  loggedIn: authData.claude.loggedIn,
                  quota5h: 0,
                  quota7d: 0
                },
                error: 'Windows environment limitation. Run "codex" in terminal to view quota.'
              };
            }
          }
        }
      }
    }
    
    return { 
      ok: false, 
      error: result.stderr || 'Failed to fetch quota',
      timestamp: new Date().toLocaleString('zh-CN')
    };
  },

  '/api/install': async () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'setup-windows.ps1');
    spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-InstallCodex',
      '-InstallClaude'
    ], { detached: true, stdio: 'ignore' }).unref();
    
    return { ok: true, message: 'Installation started in background' };
  },

  '/api/login-codex': async () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'login-codex-device.ps1');
    spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ], { detached: true, stdio: 'ignore' }).unref();
    
    return { ok: true, message: 'Codex login started' };
  },

  '/api/login-claude': async () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'login-claude-guide.ps1');
    spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ], { detached: true, stdio: 'ignore' }).unref();
    
    return { ok: true, message: 'Claude login started' };
  },

  '/api/open-shell': async () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'runner-shell.ps1');
    spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ], { detached: true, stdio: 'ignore' }).unref();
    
    return { ok: true, message: 'Runner shell opened' };
  },

  '/api/start-runner': async () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'start-runner.ps1');
    spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ], { detached: true, stdio: 'ignore' }).unref();
    
    return { ok: true, message: 'Runner started' };
  }
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url.startsWith('/api/')) {
    const handler = apiHandlers[req.url];
    if (handler) {
      try {
        const result = await handler();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: error.message }));
      }
      return;
    }
  }

  let filePath = path.join(GUI_DIR, req.url === '/' ? 'index-v2.html' : req.url);
  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`AgentLab Runner Web GUI running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server');
  
  const start = process.platform === 'win32' ? 'start' : 'open';
  require('child_process').exec(`${start} http://localhost:${PORT}`);
});
