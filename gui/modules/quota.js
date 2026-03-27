import { apiGet } from './api.js';

function updateQuotaBar(tool, period, remaining) {
  const bar = document.getElementById(`${tool}${period}Bar`);
  const text = document.getElementById(`${tool}${period}Text`);
  if (!bar || !text) return;

  const value = Number(remaining);
  const hasValue = Number.isFinite(value) && value >= 0 && value <= 100;

  if (hasValue) {
    const normalized = Math.max(0, Math.min(100, value));
    const used = 100 - normalized;
    bar.style.width = `${normalized}%`;
    text.textContent = `${normalized}% 剩余 · ${used}% 已用`;
    if (normalized < 20) {
      bar.className = 'progress-fill-compact low';
    } else if (normalized < 50) {
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

function updateQuotaTool(tool, data) {
  const card = document.getElementById(`${tool}QuotaCard`);
  if (!card) return;
  const show = Boolean(data && data.installed && data.loggedIn);
  if (!show) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  const badge = document.getElementById(`${tool}QuotaBadge`);
  if (badge) {
    if (data.quotaSupported) {
      badge.textContent = '可查询';
      badge.className = 'quota-badge available';
    } else if (data.error) {
      badge.textContent = '刷新失败';
      badge.className = 'quota-badge unavailable';
    } else {
      badge.textContent = '暂不支持';
      badge.className = 'quota-badge unavailable';
    }
  }

  updateQuotaBar(tool, '5h', data.quotaSupported ? data.quota5h : null);
  updateQuotaBar(tool, '7d', data.quotaSupported ? data.quota7d : null);
}

export async function refreshQuota(addLog) {
  addLog('正在刷新额度信息...', 'info');
  try {
    const data = await apiGet('/quota');
    if (!data?.ok) {
      addLog(`额度刷新失败: ${data?.error || '未知错误'}`, 'warning');
      return null;
    }

    updateQuotaTool('codex', data.codex);
    updateQuotaTool('claude', data.claude);
    if (data.warning) {
      addLog(`额度提示: ${data.warning}`, 'warning');
    }
    if (data?.codex?.error) {
      addLog(`Codex 额度: ${data.codex.error}`, 'warning');
    }
    if (data?.claude?.error) {
      addLog(`Claude 额度: ${data.claude.error}`, 'warning');
    }
    addLog('额度信息刷新成功', 'success');
    return data;
  } catch (error) {
    addLog(`额度刷新失败: ${error.message}`, 'error');
    return null;
  }
}
