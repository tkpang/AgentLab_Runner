// Electron Preload Script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
