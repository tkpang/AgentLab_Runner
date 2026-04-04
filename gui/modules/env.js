import { apiGet } from './api.js';

let latestEnvSnapshot = null;

const toolState = {
  codex: { installed: false, loggedIn: false, primaryAction: 'install' },
  claude: { installed: false, loggedIn: false, primaryAction: 'install' }
};

function setStatus(elementId, text, tone = 'neutral') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = text;
  el.className = `status-pill ${tone}`;
}

function setVisible(el, visible, displayMode = 'block') {
  if (!el) return;
  el.style.display = visible ? displayMode : 'none';
}

function setMenuItemVisible(el, visible) {
  if (!el) return;
  if (visible) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

function setPrimaryButtonState(prefix, label, action, tone = 'primary') {
  const btn = document.getElementById(prefix === 'codex' ? 'btnCodexPrimary' : 'btnClaudePrimary');
  const row = document.getElementById(prefix === 'codex' ? 'codexActionRow' : 'claudeActionRow');
  if (!btn || !row) return;
  btn.textContent = label;
  btn.dataset.action = action;
  btn.classList.remove('btn-cell-primary', 'btn-cell-secondary', 'btn-cell-success');
  btn.classList.add(tone === 'secondary' ? 'btn-cell-secondary' : 'btn-cell-primary');
  setVisible(row, true, 'grid');
}

function hidePrimaryButton(prefix) {
  const row = document.getElementById(prefix === 'codex' ? 'codexActionRow' : 'claudeActionRow');
  setVisible(row, false, 'grid');
}

function closeToolMenu(prefix) {
  const menu = document.getElementById(prefix === 'codex' ? 'codexMenu' : 'claudeMenu');
  if (!menu) return;
  menu.classList.remove('open');
}

function renderTool(prefix, data) {
  if (!data) return;

  const installed = Boolean(data.installed);
  const loggedIn = Boolean(data.loggedIn);
  toolState[prefix] = {
    installed,
    loggedIn,
    primaryAction: installed ? (loggedIn ? 'none' : 'login') : 'install'
  };

  const menuWrap = document.getElementById(prefix === 'codex' ? 'codexMenuWrap' : 'claudeMenuWrap');
  const menuSwitch = document.getElementById(prefix === 'codex' ? 'codexMenuSwitch' : 'claudeMenuSwitch');
  const menuUninstall = document.getElementById(prefix === 'codex' ? 'codexMenuUninstall' : 'claudeMenuUninstall');

  closeToolMenu(prefix);

  if (!installed) {
    setStatus(`${prefix}InstallStatus`, '未安装', 'danger');
    setStatus(`${prefix}AuthStatus`, '不可用', 'neutral');
    setPrimaryButtonState(prefix, '安装', 'install', 'secondary');
    setVisible(menuWrap, false);
    return;
  }

  setStatus(`${prefix}InstallStatus`, '已安装', 'success');
  setVisible(menuWrap, true);
  setMenuItemVisible(menuUninstall, true);

  if (!loggedIn) {
    setStatus(`${prefix}AuthStatus`, '未登录', 'warning');
    setPrimaryButtonState(prefix, '登录', 'login', 'primary');
    setMenuItemVisible(menuSwitch, true);
    return;
  }

  const label = data.email ? String(data.email) : '已登录';
  setStatus(`${prefix}AuthStatus`, label, 'success');
  hidePrimaryButton(prefix);
  setMenuItemVisible(menuSwitch, true);
}

export function getToolState(prefix) {
  return toolState[prefix] || { installed: false, loggedIn: false, primaryAction: 'install' };
}

export function getEnvironmentSnapshot() {
  return latestEnvSnapshot;
}

export function closeAllToolMenus() {
  closeToolMenu('codex');
  closeToolMenu('claude');
}

export function toggleToolMenu(prefix) {
  const menu = document.getElementById(prefix === 'codex' ? 'codexMenu' : 'claudeMenu');
  if (!menu) return;
  const wasOpen = menu.classList.contains('open');
  closeAllToolMenus();
  if (!wasOpen) {
    menu.classList.add('open');
  }
}

export async function checkEnvironment(addLog) {
  addLog('正在检测环境...', 'info');
  try {
    const data = await apiGet('/check-auth');
    if (!data?.ok) {
      addLog(`环境检测失败: ${data?.error || '未知错误'}`, 'error');
      return null;
    }
    latestEnvSnapshot = data;
    renderTool('codex', data.codex);
    renderTool('claude', data.claude);
    addLog('环境检测完成', 'success');
    return data;
  } catch (error) {
    addLog(`环境检测失败: ${error.message}`, 'error');
    return null;
  }
}
