import { apiPost } from './modules/api.js';
import { initLogger, addLog } from './modules/log.js';
import {
  checkEnvironment,
  closeAllToolMenus,
  getEnvironmentSnapshot,
  getToolState,
  toggleToolMenu as toggleToolMenuInternal
} from './modules/env.js';
import { refreshQuota } from './modules/quota.js';
import { bindSlotManager, closeSlotManager, openSlotManager, refreshSlots } from './modules/slots.js';

function minimizeWindow() {
  if (window.electronAPI) {
    window.electronAPI.minimizeToTray();
  }
}

function closeWindow() {
  if (window.electronAPI) {
    window.electronAPI.minimizeToTray();
  } else {
    window.close();
  }
}

function isWindowsPlatform() {
  const snapshot = getEnvironmentSnapshot();
  return snapshot?.platform === 'win32';
}

async function refreshAllStatus() {
  await checkEnvironment(addLog);
  await refreshQuota(addLog);
  await refreshSlots(addLog);
}

async function installCodex() {
  addLog('启动 Codex 安装...', 'info');
  try {
    const data = await apiPost('/install-codex');
    addLog(data?.message || 'Codex 安装任务已启动', data?.ok ? 'success' : 'error');
  } catch (error) {
    addLog(`启动安装失败: ${error.message}`, 'error');
  }
  setTimeout(() => {
    refreshAllStatus();
  }, 1200);
}

async function installClaude() {
  addLog('启动 Claude 安装...', 'info');
  try {
    const data = await apiPost('/install-claude');
    addLog(data?.message || 'Claude 安装任务已启动', data?.ok ? 'success' : 'error');
  } catch (error) {
    addLog(`启动安装失败: ${error.message}`, 'error');
  }
  setTimeout(() => {
    refreshAllStatus();
  }, 1200);
}

async function loginCodex() {
  addLog('启动 Codex 登录...', 'info');
  try {
    const data = await apiPost('/login-codex');
    addLog(data?.message || 'Codex 登录任务已启动', data?.ok ? 'success' : 'error');
  } catch (error) {
    addLog(`启动登录失败: ${error.message}`, 'error');
  }
  setTimeout(() => {
    refreshAllStatus();
  }, 1200);
}

async function loginClaude() {
  addLog('启动 Claude 登录...', 'info');
  try {
    const data = await apiPost('/login-claude');
    addLog(data?.message || 'Claude 登录任务已启动', data?.ok ? 'success' : 'error');
  } catch (error) {
    addLog(`启动登录失败: ${error.message}`, 'error');
  }
  setTimeout(() => {
    refreshAllStatus();
  }, 1200);
}

async function uninstallTool(tool) {
  const toolLabel = tool === 'codex' ? 'Codex' : 'Claude';
  const confirmed = window.confirm(`确认卸载 ${toolLabel} 吗？`);
  if (!confirmed) return;

  addLog(`正在卸载 ${toolLabel}...`, 'warning');
  try {
    const data = await apiPost('/uninstall', { tool });
    addLog(data?.message || `${toolLabel} 卸载任务已启动`, data?.ok ? 'success' : 'error');
  } catch (error) {
    addLog(`卸载失败: ${error.message}`, 'error');
  }

  setTimeout(() => {
    refreshAllStatus();
  }, 1500);
}

function switchAccountForTool(tool) {
  if (isWindowsPlatform()) {
    addLog('打开账号槽位管理，可执行一键切换账号。', 'info');
    openSlotManager(addLog, () => refreshAllStatus());
    return;
  }

  addLog('Linux 暂无账号槽位，已改为重新登录切换账号。', 'warning');
  if (tool === 'codex') {
    loginCodex();
    return;
  }
  loginClaude();
}

function toolPrimaryAction(tool) {
  const state = getToolState(tool);
  if (state.primaryAction === 'install') {
    if (tool === 'codex') installCodex();
    else installClaude();
    return;
  }
  if (state.primaryAction === 'login') {
    if (tool === 'codex') loginCodex();
    else loginClaude();
  }
}

function toolMenuAction(tool, action) {
  closeAllToolMenus();
  if (action === 'uninstall') {
    uninstallTool(tool);
    return;
  }
  if (action === 'switch') {
    switchAccountForTool(tool);
  }
}

async function startRunner() {
  addLog('启动 AgentLab Runner...', 'info');
  try {
    const data = await apiPost('/start-runner');
    addLog(data?.message || 'Runner 已启动', data?.ok ? 'success' : 'error');
  } catch (error) {
    addLog(`启动 Runner 失败: ${error.message}`, 'error');
  }
}

function toggleToolMenu(tool, event) {
  event?.stopPropagation();
  toggleToolMenuInternal(tool);
}

window.minimizeWindow = minimizeWindow;
window.closeWindow = closeWindow;
window.checkEnvironment = () => checkEnvironment(addLog);
window.refreshQuota = () => refreshQuota(addLog);
window.refreshSlots = () => refreshSlots(addLog);
window.manageSlots = () => openSlotManager(addLog, () => checkEnvironment(addLog));
window.closeSlotManager = closeSlotManager;
window.installCodex = installCodex;
window.installClaude = installClaude;
window.loginCodex = loginCodex;
window.loginClaude = loginClaude;
window.startRunner = startRunner;
window.toolPrimaryAction = toolPrimaryAction;
window.toolMenuAction = toolMenuAction;
window.toggleToolMenu = toggleToolMenu;

window.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    closeAllToolMenus();
    return;
  }
  if (!target.closest('.tool-menu-wrap')) {
    closeAllToolMenus();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  initLogger('logContainer');
  bindSlotManager(addLog, () => checkEnvironment(addLog));
  addLog('AgentLab Runner 控制面板已加载', 'success');

  setTimeout(() => {
    refreshAllStatus();
  }, 500);

  setInterval(() => {
    checkEnvironment(addLog);
  }, 30000);
});
