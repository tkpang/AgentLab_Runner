// AgentLab Runner V2 - Compact GUI Logic

let apiBaseUrl = 'http://localhost:8765/api';

// Window controls for Electron
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

// Add log
function addLog(message, type = 'info') {
  const logContainer = document.getElementById('logContainer');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  entry.textContent = `[${timestamp}] ${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
  
  // Keep only last 50 entries
  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.firstChild);
  }
}

// Check environment
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

// Update environment display
function updateEnvironmentDisplay(data) {
  // Update Codex
  if (data.codex) {
    const codex = data.codex;
    const installStatus = document.getElementById('codexInstallStatus');
    const authStatus = document.getElementById('codexAuthStatus');
    
    if (codex.installed) {
      installStatus.textContent = '✅ 已安装';
      installStatus.style.color = '#86efac';
      
      if (codex.loggedIn) {
        authStatus.textContent = '✅ 已登录';
        authStatus.style.color = '#86efac';
        if (codex.email) {
          authStatus.textContent = `✅ ${codex.email}`;
        }
      } else {
        authStatus.textContent = '❌ 未登录';
        authStatus.style.color = '#fca5a5';
      }
    } else {
      installStatus.textContent = '❌ 未安装';
      installStatus.style.color = '#fca5a5';
      authStatus.textContent = '--';
      authStatus.style.color = '#64748b';
    }
  }
  
  // Update Claude
  if (data.claude) {
    const claude = data.claude;
    const installStatus = document.getElementById('claudeInstallStatus');
    const authStatus = document.getElementById('claudeAuthStatus');
    
    if (claude.installed) {
      installStatus.textContent = '✅ 已安装';
      installStatus.style.color = '#86efac';
      
      if (claude.loggedIn) {
        authStatus.textContent = '✅ 已登录';
        authStatus.style.color = '#86efac';
        if (claude.email) {
          authStatus.textContent = `✅ ${claude.email}`;
        }
      } else {
        authStatus.textContent = '❌ 未登录';
        authStatus.style.color = '#fca5a5';
      }
    } else {
      installStatus.textContent = '❌ 未安装';
      installStatus.style.color = '#fca5a5';
      authStatus.textContent = '--';
      authStatus.style.color = '#64748b';
    }
  }
}

// Refresh quota
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
      if (data.error && data.error.includes('child_process')) {
        addLog('提示: Windows 环境下请在终端运行 "codex" 查看额度', 'warning');
      }
    }
  } catch (error) {
    addLog(`额度刷新失败: ${error.message}`, 'error');
  }
}

// Update quota display - only show if installed
function updateQuotaDisplay(data) {
  // Codex quota - only show if installed
  if (data.codex && data.codex.installed !== false) {
    const codexCard = document.getElementById('codexQuotaCard');
    codexCard.style.display = 'block';
    
    const badge = document.getElementById('codexQuotaBadge');
    if (data.codex.loggedIn) {
      badge.textContent = '可连接';
      badge.className = 'quota-badge available';
    } else {
      badge.textContent = '未登录';
      badge.className = 'quota-badge unavailable';
    }
    
    updateQuotaBar('codex', '5h', data.codex.quota5h || 0);
    updateQuotaBar('codex', '7d', data.codex.quota7d || 0);
  } else {
    document.getElementById('codexQuotaCard').style.display = 'none';
  }
  
  // Claude quota - only show if installed
  if (data.claude && data.claude.installed !== false) {
    const claudeCard = document.getElementById('claudeQuotaCard');
    claudeCard.style.display = 'block';
    
    const badge = document.getElementById('claudeQuotaBadge');
    if (data.claude.loggedIn) {
      badge.textContent = '可连接';
      badge.className = 'quota-badge available';
    } else {
      badge.textContent = '未登录';
      badge.className = 'quota-badge unavailable';
    }
    
    updateQuotaBar('claude', '5h', data.claude.quota5h || 0);
    updateQuotaBar('claude', '7d', data.claude.quota7d || 0);
  } else {
    document.getElementById('claudeQuotaCard').style.display = 'none';
  }
}

// Update quota bar
function updateQuotaBar(tool, period, remaining) {
  const bar = document.getElementById(`${tool}${period}Bar`);
  const text = document.getElementById(`${tool}${period}Text`);
  
  if (remaining > 0) {
    const used = 100 - remaining;
    bar.style.width = `${remaining}%`;
    text.textContent = `${remaining}% 剩余 · ${used}% 已用`;
    
    if (remaining < 20) {
      bar.className = 'progress-fill-compact low';
    } else if (remaining < 50) {
      bar.className = 'progress-fill-compact medium';
    } else {
      bar.className = 'progress-fill-compact';
    }
  } else {
    bar.style.width = '0%';
    text.textContent = '--% 剩余 · --% 已用';
    bar.className = 'progress-fill-compact';
  }
}

// Quick actions
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

async function refreshSlots() {
  addLog('刷新账号槽位...', 'info');
  try {
    const response = await fetch(`${apiBaseUrl}/slots`);
    const data = await response.json();
    if (!data.ok) {
      addLog(`槽位读取失败: ${data.error || '未知错误'}`, 'error');
      return;
    }
    const active = data.activeSlot || '--';
    document.getElementById('currentSlot').textContent = active;
    if (data.message) {
      addLog(data.message, 'warning');
    } else {
      addLog(`当前槽位: ${active}`, 'success');
    }
  } catch (error) {
    addLog(`刷新槽位失败: ${error.message}`, 'error');
  }
}

async function manageSlots() {
  addLog('读取槽位列表...', 'info');
  try {
    const response = await fetch(`${apiBaseUrl}/slots`);
    const data = await response.json();
    if (!data.ok) {
      addLog(`读取槽位失败: ${data.error || '未知错误'}`, 'error');
      return;
    }
    if (!data.slots || data.slots.length === 0) {
      addLog(data.message || '当前没有可切换槽位', 'warning');
      return;
    }
    const lines = data.slots.map((s, i) => `${i + 1}. ${s.name}${s.isActive ? ' (当前)' : ''}`);
    const raw = prompt(`输入要启用的槽位序号:\\n${lines.join('\\n')}`);
    if (!raw) return;
    const idx = Number(raw) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= data.slots.length) {
      addLog('槽位序号无效', 'warning');
      return;
    }
    const target = data.slots[idx].name;
    const actRes = await fetch(`${apiBaseUrl}/activate-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: target })
    });
    const actData = await actRes.json();
    if (actData.ok) {
      addLog(`已切换到槽位: ${target}`, 'success');
      refreshSlots();
      checkEnvironment();
    } else {
      addLog(`切换槽位失败: ${actData.error || '未知错误'}`, 'error');
    }
  } catch (error) {
    addLog(`切换槽位失败: ${error.message}`, 'error');
  }
}

async function saveSlot() {
  addLog('保存当前账号到槽位...', 'info');
  const slotName = prompt('请输入槽位名称:');
  if (slotName) {
    try {
      const response = await fetch(`${apiBaseUrl}/save-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: slotName })
      });
      const data = await response.json();
      addLog(data.message || '槽位保存成功', 'success');
      refreshSlots();
    } catch (error) {
      addLog(`保存槽位失败: ${error.message}`, 'error');
    }
  }
}

// Auto-load on page ready
window.addEventListener('DOMContentLoaded', () => {
  addLog('AgentLab Runner 控制面板已加载', 'success');
  
  // Auto check environment and quota
  setTimeout(() => {
    checkEnvironment();
    refreshQuota();
    refreshSlots();
  }, 500);
  
  // Auto refresh every 30 seconds
  setInterval(() => {
    checkEnvironment();
  }, 30000);
});
