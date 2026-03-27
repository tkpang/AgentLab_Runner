// AgentLab Runner Web GUI - 主逻辑

let apiBaseUrl = 'http://localhost:8765/api';

// 添加日志
function addLog(message, type = 'info') {
  const logContainer = document.getElementById('logContainer');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  entry.textContent = `[${timestamp}] ${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// 更新状态徽章
function updateStatusBadge(elementId, status) {
  const badge = document.getElementById(elementId);
  badge.textContent = status;
  
  if (status === '可连接' || status.includes('已登录')) {
    badge.className = 'status-badge available';
  } else if (status === '未安装' || status.includes('未登录')) {
    badge.className = 'status-badge unavailable';
  } else {
    badge.className = 'status-badge';
  }
}

// 刷新额度信息
async function refreshQuota() {
  addLog('正在刷新额度信息...', 'info');
  
  try {
    const response = await fetch(`${apiBaseUrl}/quota`);
    const data = await response.json();
    
    if (data.ok) {
      updateQuotaDisplay(data);
      addLog('额度信息刷新成功', 'success');
    } else {
      addLog(`额度刷新失败: ${data.error || '未知错误'}`, 'warning');
      // 显示友好提示
      if (data.error && data.error.includes('child_process')) {
        addLog('提示: Windows 环境下请在终端运行 "codex" 查看额度', 'warning');
      }
    }
  } catch (error) {
    addLog(`额度刷新失败: ${error.message}`, 'error');
  }
}

// 更新额度显示
function updateQuotaDisplay(data) {
  const updateTime = document.getElementById('quotaUpdateTime');
  updateTime.textContent = data.timestamp || new Date().toLocaleString('zh-CN');
  
  // 更新 Codex 额度
  if (data.codex) {
    updateQuotaBars('codex', data.codex);
    updateStatusBadge('codexStatusBadge', data.codex.loggedIn ? '可连接' : '未登录');
  }
  
  // 更新 Claude 额度
  if (data.claude) {
    updateQuotaBars('claude', data.claude);
    updateStatusBadge('claudeStatusBadge', data.claude.loggedIn ? '可连接' : '未登录');
  }
}

// 更新进度条
function updateQuotaBars(tool, quotaData) {
  // 5h 进度条
  const bar5h = document.getElementById(`${tool}5hBar`);
  const percent5h = document.getElementById(`${tool}5hPercent`);
  
  if (quotaData.quota5h !== undefined) {
    const remaining = quotaData.quota5h;
    const used = 100 - remaining;
    bar5h.style.width = `${remaining}%`;
    percent5h.textContent = `剩余: ${remaining}% · 已用: ${used}%`;
    
    // 根据剩余量设置颜色
    if (remaining < 20) {
      bar5h.className = 'progress-fill low';
    } else if (remaining < 50) {
      bar5h.className = 'progress-fill medium';
    } else {
      bar5h.className = 'progress-fill';
    }
  } else {
    bar5h.style.width = '0%';
    percent5h.textContent = '剩余: --% · 已用: --%';
  }
  
  // 7d 进度条
  const bar7d = document.getElementById(`${tool}7dBar`);
  const percent7d = document.getElementById(`${tool}7dPercent`);
  
  if (quotaData.quota7d !== undefined) {
    const remaining = quotaData.quota7d;
    const used = 100 - remaining;
    bar7d.style.width = `${remaining}%`;
    percent7d.textContent = `剩余: ${remaining}% · 已用: ${used}%`;
    
    if (remaining < 20) {
      bar7d.className = 'progress-fill low';
    } else if (remaining < 50) {
      bar7d.className = 'progress-fill medium';
    } else {
      bar7d.className = 'progress-fill';
    }
  } else {
    bar7d.style.width = '0%';
    percent7d.textContent = '剩余: --% · 已用: --%';
  }
}

// 检测环境
async function checkEnvironment() {
  addLog('正在检测环境...', 'info');
  
  try {
    const response = await fetch(`${apiBaseUrl}/check-auth`);
    const data = await response.json();
    
    if (data.ok) {
      updateEnvironmentDisplay(data);
      addLog('环境检测完成', 'success');
    } else {
      addLog(`环境检测失败: ${data.error || '未知错误'}`, 'error');
    }
  } catch (error) {
    addLog(`环境检测失败: ${error.message}`, 'error');
  }
}

// 更新环境显示
function updateEnvironmentDisplay(data) {
  const updateTime = document.getElementById('envUpdateTime');
  updateTime.textContent = data.timestamp || new Date().toLocaleString('zh-CN');
  
  // 更新 Codex 环境
  if (data.codex) {
    const codex = data.codex;
    document.getElementById('codexPath').textContent = codex.credentialFile || '--';
    document.getElementById('codexVersion').textContent = codex.installed ? 'codex-cli 0.116.0' : '未安装';
    document.getElementById('codexAuth').textContent = codex.loggedIn ? `已登录 (${codex.email || '可能已登录'})` : '未登录';
    updateStatusBadge('codexEnvBadge', codex.installed ? '可用' : '未安装');
  }
  
  // 更新 Claude 环境
  if (data.claude) {
    const claude = data.claude;
    document.getElementById('claudePath').textContent = claude.credentialFile || '--';
    document.getElementById('claudeVersion').textContent = claude.installed ? '2.1.29 (Claude Code)' : '未安装';
    document.getElementById('claudeAuth').textContent = claude.loggedIn ? `已登录 (${claude.email || '可能已登录'})` : '未登录';
    updateStatusBadge('claudeEnvBadge', claude.installed ? '可用' : '未安装');
  }
}

// 快捷操作函数
async function installEnvironment() {
  addLog('启动安装程序...', 'info');
  try {
    const response = await fetch(`${apiBaseUrl}/install`, { method: 'POST' });
    const data = await response.json();
    addLog(data.message || '安装任务已启动', 'success');
  } catch (error) {
    addLog(`启动安装失败: ${error.message}`, 'error');
  }
}

async function loginCodex() {
  addLog('启动 Codex 登录...', 'info');
  try {
    const response = await fetch(`${apiBaseUrl}/login-codex`, { method: 'POST' });
    const data = await response.json();
    addLog(data.message || 'Codex 登录任务已启动', 'success');
  } catch (error) {
    addLog(`启动登录失败: ${error.message}`, 'error');
  }
}

async function loginClaude() {
  addLog('启动 Claude 登录...', 'info');
  try {
    const response = await fetch(`${apiBaseUrl}/login-claude`, { method: 'POST' });
    const data = await response.json();
    addLog(data.message || 'Claude 登录任务已启动', 'success');
  } catch (error) {
    addLog(`启动登录失败: ${error.message}`, 'error');
  }
}

async function manageSlots() {
  addLog('打开账号槽位管理...', 'info');
  window.open('/slots.html', '_blank');
}

async function openShell() {
  addLog('启动 Runner Shell...', 'info');
  try {
    const response = await fetch(`${apiBaseUrl}/open-shell`, { method: 'POST' });
    const data = await response.json();
    addLog(data.message || 'Shell 已启动', 'success');
  } catch (error) {
    addLog(`启动 Shell 失败: ${error.message}`, 'error');
  }
}

async function startRunner() {
  addLog('启动 AgentLab Runner...', 'info');
  try {
    const response = await fetch(`${apiBaseUrl}/start-runner`, { method: 'POST' });
    const data = await response.json();
    addLog(data.message || 'Runner 已启动', 'success');
  } catch (error) {
    addLog(`启动 Runner 失败: ${error.message}`, 'error');
  }
}

// 页面加载时自动检测
window.addEventListener('DOMContentLoaded', () => {
  addLog('AgentLab Runner 控制面板已加载', 'success');
  
  // 自动检测环境和额度
  setTimeout(() => {
    checkEnvironment();
    refreshQuota();
  }, 500);
  
  // 每30秒自动刷新一次
  setInterval(() => {
    checkEnvironment();
  }, 30000);
});
