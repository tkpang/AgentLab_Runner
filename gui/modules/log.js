let container = null;

export function initLogger(elementId = 'logContainer') {
  container = document.getElementById(elementId);
}

export function addLog(message, type = 'info') {
  if (!container) {
    initLogger();
  }
  if (!container) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  entry.textContent = `[${timestamp}] ${message}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  while (container.children.length > 50) {
    container.removeChild(container.firstChild);
  }
}
