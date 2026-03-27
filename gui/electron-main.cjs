// Electron Main Process - Desktop App Wrapper
const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let serverProcess = null;
const SERVER_PORT = 8765;

// Start backend server
function startBackendServer() {
  const serverScript = path.join(__dirname, 'server.cjs');
  serverProcess = spawn('node', [serverScript], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 800,
    minHeight: 650,
    title: 'AgentLab Runner',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    frame: false,
    transparent: false,
    resizable: true
  });

  // Wait for server to start, then load
  setTimeout(() => {
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
  }, 1500);

  // Prevent window from closing, minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show notification on first minimize
      if (tray && !mainWindow.wasMinimizedBefore) {
        tray.displayBalloon({
          title: 'AgentLab Runner',
          content: '应用已最小化到系统托盘，点击图标可重新打开'
        });
        mainWindow.wasMinimizedBefore = true;
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create system tray
function createTray() {
  // Use a simple icon (you can replace with a proper .ico file)
  const trayIcon = path.join(__dirname, 'tray-icon.png');
  
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '刷新',
      click: () => {
        if (mainWindow) {
          mainWindow.reload();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('AgentLab Runner');
  tray.setContextMenu(contextMenu);

  // Double click to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// App ready
app.whenReady().then(() => {
  startBackendServer();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up on quit
app.on('before-quit', () => {
  app.isQuitting = true;
  
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Handle IPC messages from renderer
ipcMain.handle('minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
