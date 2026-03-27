import { API_BASE_URL, apiGet, apiPost } from './modules/api.js';
import { initLogger, addLog } from './modules/log.js';
import {
  checkEnvironment,
  closeAllToolMenus,
  getEnvironmentSnapshot,
  getToolState,
  toggleToolMenu as toggleToolMenuInternal
} from './modules/env.js';
import { refreshQuota } from './modules/quota.js';
import { bindSlotManager, closeSlotManager, getSlotSnapshot, openSlotManager, refreshSlots } from './modules/slots.js';

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
  const env = await checkEnvironment(addLog);
  await refreshQuota(addLog);
  if (env?.platform === 'win32') {
    await refreshSlots(addLog);
  }
  applyPlatformSpecificUI();
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
  openAccountSwitchModal(tool);
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

let runnerStartBusy = false;
let runnerLogOffset = 0;
let runnerErrOffset = 0;
let accountSwitchTool = 'codex';

function setRunnerRuntimeHint(text, tone = 'neutral') {
  const el = document.getElementById('runnerRuntimeHint');
  if (!el) return;
  el.textContent = text;
  el.className = `runner-runtime-hint ${tone}`;
}

function setRunnerStartButtonState({ busy = false, running = false } = {}) {
  const btn = document.getElementById('btnRunnerStart');
  const stopBtn = document.getElementById('btnRunnerStop');
  const stopBottomBtn = document.getElementById('btnRunnerStopBottom');
  if (!btn) return;
  if (busy) {
    btn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;
    if (stopBottomBtn) {
      stopBottomBtn.disabled = true;
      stopBottomBtn.textContent = '终止中...';
    }
    btn.textContent = '启动中...';
    setRunnerRuntimeHint('状态：正在启动...', 'warning');
    return;
  }
  btn.disabled = running;
  if (stopBtn) stopBtn.disabled = !running;
  if (stopBottomBtn) {
    stopBottomBtn.disabled = !running;
    stopBottomBtn.textContent = running ? '终止 Runner' : 'Runner 未运行';
  }
  btn.textContent = running ? '已启动' : '启动';
  setRunnerRuntimeHint(running ? '状态：运行中' : '状态：未运行', running ? 'success' : 'neutral');
}

async function refreshRunnerRuntimeStatus(logResult = false) {
  try {
    const data = await apiGet('/runner/runtime-status');
    if (!data?.ok) return null;
    const runnerRunning = Boolean(data?.runner?.running);
    setRunnerStartButtonState({ busy: false, running: runnerRunning });
    if (logResult) {
      if (runnerRunning) {
        addLog(`Runner 进程运行中 (pid=${data?.runner?.pid || '-'})`, 'success');
      } else {
        addLog('Runner 进程未运行', 'warning');
      }
    }
    return data;
  } catch {
    return null;
  }
}

async function startRunner() {
  const runtimeBefore = await refreshRunnerRuntimeStatus(false);
  if (runtimeBefore?.runner?.running) {
    addLog(`Runner 已在运行 (pid=${runtimeBefore?.runner?.pid || '-'})`, 'info');
    return;
  }
  if (runnerStartBusy) {
    addLog('Runner 正在启动，请稍候...', 'info');
    return;
  }
  const server = String(document.getElementById('runnerServerInput')?.value || '').trim();
  const token = String(document.getElementById('runnerTokenInput')?.value || '').trim();
  const runnerId = String(document.getElementById('runnerIdInput')?.value || '').trim();
  if (!token) {
    addLog('缺少 Runner Token，请先填写并保存。', 'warning');
    return;
  }
  runnerStartBusy = true;
  setRunnerStartButtonState({ busy: true, running: false });
  addLog('启动 AgentLab Runner...', 'info');
  try {
    const data = await apiPost('/start-runner', { server, token, runnerId });
    addLog(data?.message || 'Runner 已启动', data?.ok ? 'success' : 'error');
    let runnerDetected = false;
    for (let i = 0; i < 8; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const state = await refreshRunnerRuntimeStatus(false);
      if (state?.runner?.running) {
        runnerDetected = true;
        break;
      }
    }
    await refreshRunnerRuntimeStatus(true);
    if (!runnerDetected) {
      addLog('尚未检测到 Runner 进程。若反复出现，请检查 runner/.run/runner.log。', 'warning');
    }
  } catch (error) {
    addLog(`启动 Runner 失败: ${error.message}`, 'error');
    setRunnerStartButtonState({ busy: false, running: false });
  } finally {
    runnerStartBusy = false;
  }
}

async function stopRunner() {
  if (runnerStartBusy) {
    addLog('Runner 正在启动中，请稍后再停止。', 'warning');
    return;
  }
  addLog('正在停止 Runner...', 'warning');
  const btn = document.getElementById('btnRunnerStop');
  const bottomBtn = document.getElementById('btnRunnerStopBottom');
  const prevText = btn?.textContent || '';
  const prevBottomText = bottomBtn?.textContent || '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '停止中...';
  }
  if (bottomBtn) {
    bottomBtn.disabled = true;
    bottomBtn.textContent = '终止中...';
  }
  try {
    const data = await apiPost('/stop-runner');
    addLog(data?.message || (data?.ok ? 'Runner 已停止' : '停止失败'), data?.ok ? 'success' : 'error');
    await refreshRunnerRuntimeStatus(true);
  } catch (error) {
    addLog(`停止 Runner 失败: ${error.message}`, 'error');
  } finally {
    if (btn) btn.textContent = prevText || '停止';
    if (bottomBtn) bottomBtn.textContent = prevBottomText || '终止 Runner';
  }
}

function classifyRunnerLog(line, isErr = false) {
  if (isErr) return 'error';
  const text = String(line || '').toLowerCase();
  if (text.includes('[error]') || text.includes(' failed') || text.includes('error:')) return 'error';
  if (text.includes('[warn]') || text.includes('warning')) return 'warning';
  if (text.includes(' claimed job=') || text.includes(' success ') || text.includes('runner started')) return 'success';
  return 'info';
}

function addRunnerLogLine(line, isErr = false) {
  const clean = String(line || '').trim();
  if (!clean) return;
  addLog(clean, classifyRunnerLog(clean, isErr));
}

async function pollRunnerLogs() {
  try {
    const params = new URLSearchParams({
      logOffset: String(runnerLogOffset),
      errOffset: String(runnerErrOffset)
    });
    const response = await fetch(`${API_BASE_URL}/runner/log-tail?${params.toString()}`);
    const data = await response.json();
    if (!data?.ok) return;

    const logLines = Array.isArray(data?.log?.lines) ? data.log.lines : [];
    const errLines = Array.isArray(data?.err?.lines) ? data.err.lines : [];
    for (const line of logLines) {
      addRunnerLogLine(line, false);
    }
    for (const line of errLines) {
      addRunnerLogLine(line, true);
    }

    if (typeof data?.log?.offset === 'number') runnerLogOffset = Math.max(0, data.log.offset);
    if (typeof data?.err?.offset === 'number') runnerErrOffset = Math.max(0, data.err.offset);

    if (data?.log?.truncated || data?.err?.truncated) {
      addLog('日志较长，已自动仅显示最新片段。', 'warning');
    }
  } catch {
    // keep silent for polling
  }
}

async function loadRunnerConfig() {
  try {
    const data = await apiGet('/runner-config');
    if (!data?.ok) {
      addLog(`加载 Runner 配置失败: ${data?.error || '未知错误'}`, 'warning');
      return null;
    }
    const serverInput = document.getElementById('runnerServerInput');
    const tokenInput = document.getElementById('runnerTokenInput');
    const runnerIdInput = document.getElementById('runnerIdInput');
    const autoStartToggle = document.getElementById('runnerAutoStartToggle');
    if (serverInput) serverInput.value = data.server || '';
    if (tokenInput) tokenInput.value = data.token || '';
    if (runnerIdInput) runnerIdInput.value = data.runnerId || '';
    if (autoStartToggle) autoStartToggle.checked = Boolean(data.autoStart);
    addLog('已加载 Runner 连接配置', 'info');
    return data;
  } catch (error) {
    addLog(`加载 Runner 配置失败: ${error.message}`, 'warning');
    return null;
  }
}

async function saveRunnerConfig() {
  const server = String(document.getElementById('runnerServerInput')?.value || '').trim();
  const token = String(document.getElementById('runnerTokenInput')?.value || '').trim();
  const runnerId = String(document.getElementById('runnerIdInput')?.value || '').trim();
  const autoStart = Boolean(document.getElementById('runnerAutoStartToggle')?.checked);
  if (!server) {
    addLog('请填写 AgentLab Server 地址，例如 http://frp-aim.com:11068', 'warning');
    return;
  }
  if (!token) {
    addLog('Runner Token 为空：配置会保存，但启动时仍会要求填写 Token。', 'warning');
  }
  try {
    const data = await apiPost('/runner-config/save', { server, token, runnerId, autoStart });
    addLog(data?.ok ? 'Runner 配置已保存' : (data?.error || '保存失败'), data?.ok ? 'success' : 'error');
  } catch (error) {
    addLog(`保存 Runner 配置失败: ${error.message}`, 'error');
  }
}

async function testRunnerConnection() {
  const server = String(document.getElementById('runnerServerInput')?.value || '').trim();
  const token = String(document.getElementById('runnerTokenInput')?.value || '').trim();
  const runnerId = String(document.getElementById('runnerIdInput')?.value || '').trim();
  if (!server || !token) {
    addLog('测试连接前请填写 Server 与 Token。', 'warning');
    return;
  }
  addLog(`正在测试连接 ${server} ...`, 'info');
  try {
    const data = await apiPost('/runner/test-connection', { server, token, runnerId });
    addLog(data?.message || '连接测试完成', data?.ok ? 'success' : 'error');
  } catch (error) {
    addLog(`连接测试失败: ${error.message}`, 'error');
  }
}

function toggleToolMenu(tool, event) {
  event?.stopPropagation();
  toggleToolMenuInternal(tool);
}

function toolDisplayName(tool) {
  return tool === 'claude' ? 'Claude' : 'Codex';
}

function setAccountSwitchStatus(text, tone = 'info') {
  const el = document.getElementById('accountSwitchStatus');
  if (!el) return;
  el.className = `slot-modal-status ${tone}`;
  el.textContent = text;
}

function closeAccountSwitchModal() {
  const modal = document.getElementById('accountSwitchModal');
  if (!modal) return;
  modal.classList.remove('is-open');
}

async function openAccountSwitchModal(tool) {
  accountSwitchTool = tool === 'claude' ? 'claude' : 'codex';
  const modal = document.getElementById('accountSwitchModal');
  if (!modal) return;

  const titleEl = document.getElementById('accountSwitchTitle');
  const hintEl = document.getElementById('accountSwitchHint');
  const reloginBtn = document.getElementById('accountSwitchReloginBtn');
  const refreshBtn = document.getElementById('accountSwitchRefreshSlotsBtn');
  const openSlotsBtn = document.getElementById('accountSwitchOpenSlotsBtn');
  const currentSlotEl = document.getElementById('accountSwitchCurrentSlot');

  const name = toolDisplayName(accountSwitchTool);
  const isWin = isWindowsPlatform();
  if (titleEl) titleEl.textContent = `${name} 切换账号`;
  if (reloginBtn) reloginBtn.textContent = `重新登录 ${name}`;

  if (isWin) {
    if (refreshBtn) refreshBtn.style.display = '';
    if (openSlotsBtn) openSlotsBtn.style.display = '';
    setAccountSwitchStatus('正在读取账号槽位...', 'info');
    await refreshSlots(addLog);
    const snapshot = getSlotSnapshot();
    if (currentSlotEl) currentSlotEl.textContent = snapshot.activeSlot || '--';
    if (hintEl) hintEl.textContent = '建议流程：先登录 -> 保存槽位 -> 通过槽位一键切换账号。';
    if (snapshot.hint && snapshot.hint.includes('暂未接入')) {
      setAccountSwitchStatus(snapshot.hint, 'warning');
    } else {
      setAccountSwitchStatus(`当前槽位：${snapshot.activeSlot || '--'}`, 'info');
    }
  } else {
    if (refreshBtn) refreshBtn.style.display = 'none';
    if (openSlotsBtn) openSlotsBtn.style.display = 'none';
    if (currentSlotEl) currentSlotEl.textContent = 'Linux 无槽位';
    if (hintEl) hintEl.textContent = 'Linux 环境当前使用“重新登录”切换账号。点击下方按钮后按终端/浏览器指引完成登录。';
    setAccountSwitchStatus('Linux 暂未接入账号槽位管理。', 'warning');
  }

  modal.classList.add('is-open');
}

function applyPlatformSpecificUI() {
  const snapshot = getEnvironmentSnapshot();
  const isWin = snapshot?.platform === 'win32';
  const danger = document.getElementById('runnerDangerSection');
  if (danger) {
    danger.style.display = isWin ? 'none' : 'block';
  }
}

window.minimizeWindow = minimizeWindow;
window.closeWindow = closeWindow;
window.checkEnvironment = () => checkEnvironment(addLog);
window.refreshQuota = () => refreshQuota(addLog);
window.refreshSlots = () => refreshSlots(addLog);
window.manageSlots = () => openSlotManager(addLog, () => checkEnvironment(addLog));
window.closeSlotManager = closeSlotManager;
window.closeAccountSwitchModal = closeAccountSwitchModal;
window.installCodex = installCodex;
window.installClaude = installClaude;
window.loginCodex = loginCodex;
window.loginClaude = loginClaude;
window.saveRunnerConfig = saveRunnerConfig;
window.testRunnerConnection = testRunnerConnection;
window.startRunner = startRunner;
window.stopRunner = stopRunner;
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

  const accountCloseBtn = document.getElementById('accountSwitchCloseBtn');
  accountCloseBtn?.addEventListener('click', () => closeAccountSwitchModal());
  const accountModal = document.getElementById('accountSwitchModal');
  accountModal?.addEventListener('click', (event) => {
    if (event.target === accountModal) closeAccountSwitchModal();
  });
  const accountReloginBtn = document.getElementById('accountSwitchReloginBtn');
  accountReloginBtn?.addEventListener('click', () => {
    if (accountSwitchTool === 'codex') {
      loginCodex();
    } else {
      loginClaude();
    }
    closeAccountSwitchModal();
  });
  const accountRefreshBtn = document.getElementById('accountSwitchRefreshSlotsBtn');
  accountRefreshBtn?.addEventListener('click', async () => {
    if (!isWindowsPlatform()) return;
    setAccountSwitchStatus('正在刷新槽位...', 'info');
    await refreshSlots(addLog);
    const snapshot = getSlotSnapshot();
    const currentSlotEl = document.getElementById('accountSwitchCurrentSlot');
    if (currentSlotEl) currentSlotEl.textContent = snapshot.activeSlot || '--';
    setAccountSwitchStatus(`当前槽位：${snapshot.activeSlot || '--'}`, 'info');
  });
  const accountOpenSlotsBtn = document.getElementById('accountSwitchOpenSlotsBtn');
  accountOpenSlotsBtn?.addEventListener('click', () => {
    openSlotManager(addLog, async () => {
      await refreshAllStatus();
      await openAccountSwitchModal(accountSwitchTool);
    });
  });

  setTimeout(() => {
    loadRunnerConfig().then((cfg) => {
      if (cfg?.autoStart) {
        addLog('自动启动已开启，正在尝试拉起 Runner...', 'info');
        startRunner();
      }
    });
    refreshAllStatus();
    refreshRunnerRuntimeStatus(false);
    pollRunnerLogs();
  }, 500);

  setInterval(() => {
    checkEnvironment(addLog).then(() => applyPlatformSpecificUI());
  }, 30000);

  setInterval(() => {
    refreshRunnerRuntimeStatus(false);
  }, 4000);

  setInterval(() => {
    pollRunnerLogs();
  }, 1500);
});
