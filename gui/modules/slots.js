import { apiGet, apiPost } from './api.js';

let cachedSlots = [];
let cachedActiveSlot = '--';
let cachedTool = 'all';
let slotHintMessage = '槽位用于保存“本机 CLI 登录态快照”，可在多账号之间快速切换。';
let lastHintLogMessage = '';

function slotModalElements() {
  return {
    modal: document.getElementById('slotManagerModal'),
    list: document.getElementById('slotList'),
    status: document.getElementById('slotModalStatus'),
    input: document.getElementById('slotNameInput'),
  };
}

function updateSlotHint() {
  const el = document.getElementById('slotHint');
  if (!el) return;
  el.textContent = slotHintMessage;
}

function setSlotModalVisible(visible) {
  const { modal } = slotModalElements();
  if (!modal) return;
  modal.classList.toggle('is-open', visible);
}

function setSlotModalStatus(text, type = 'info') {
  const { status } = slotModalElements();
  if (!status) return;
  status.className = `slot-modal-status ${type}`;
  status.textContent = text;
}

function renderSlotList(onActivate, onDelete) {
  const { list } = slotModalElements();
  if (!list) return;
  list.innerHTML = '';

  if (!cachedSlots.length) {
    const empty = document.createElement('div');
    empty.className = 'slot-item-empty';
    empty.textContent = '暂无可用槽位';
    list.appendChild(empty);
    return;
  }

  cachedSlots.forEach((slot) => {
    const row = document.createElement('div');
    row.className = `slot-item ${slot.isActive ? 'active' : ''}`;

    const info = document.createElement('div');
    info.className = 'slot-item-info';
    const name = document.createElement('div');
    name.className = 'slot-item-name';
    name.textContent = slot.name;
    const meta = document.createElement('div');
    meta.className = 'slot-item-meta';
    meta.textContent = slot.isActive ? '当前激活' : '可切换';
    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'slot-item-actions';

    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'btn-slot';
    useBtn.textContent = slot.isActive ? '使用中' : '启用';
    useBtn.disabled = Boolean(slot.isActive);
    useBtn.addEventListener('click', () => onActivate(slot.name));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-slot danger';
    delBtn.textContent = '删除';
    delBtn.disabled = Boolean(slot.isActive);
    delBtn.addEventListener('click', () => onDelete(slot.name));

    actions.appendChild(useBtn);
    actions.appendChild(delBtn);
    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  });
}

export async function refreshSlots(addLog, tool = 'all') {
  const scope = tool === 'codex' ? 'Codex' : (tool === 'claude' ? 'Claude' : '共享');
  cachedTool = tool;
  addLog(`刷新账号槽位 (${scope})...`, 'info');
  try {
    const data = await apiGet(`/slots?tool=${encodeURIComponent(tool)}`);
    if (!data?.ok) {
      addLog(`槽位读取失败: ${data?.error || '未知错误'}`, 'error');
      return null;
    }

    cachedSlots = Array.isArray(data.slots) ? data.slots : [];
    cachedActiveSlot = data.activeSlot || '--';
    const current = document.getElementById('currentSlot');
    if (current) current.textContent = cachedActiveSlot;

    if (data.message) {
      slotHintMessage = data.message;
      if (lastHintLogMessage !== data.message) {
        addLog(data.message, 'warning');
        lastHintLogMessage = data.message;
      }
    } else {
      slotHintMessage = '槽位用于保存“本机 CLI 登录态快照”，可在多账号之间快速切换。';
      lastHintLogMessage = '';
    }
    updateSlotHint();

    if (!data.message) {
      addLog(`当前槽位: ${cachedActiveSlot}`, 'success');
    }
    return data;
  } catch (error) {
    addLog(`刷新槽位失败: ${error.message}`, 'error');
    return null;
  }
}

export function getSlotSnapshot() {
  return {
    slots: cachedSlots.slice(),
    activeSlot: cachedActiveSlot,
    hint: slotHintMessage,
    tool: cachedTool,
  };
}

export async function activateSlot(slotName, addLog, onAfterSwitch = null, tool = cachedTool) {
  const target = String(slotName || '').trim();
  if (!target) return;
  try {
    const data = await apiPost('/activate-slot', { name: target, tool });
    if (!data?.ok) {
      addLog(`切换槽位失败: ${data?.error || '未知错误'}`, 'error');
      setSlotModalStatus(`切换失败: ${data?.error || '未知错误'}`, 'error');
      return;
    }
    addLog(`已切换到槽位: ${target}`, 'success');
    setSlotModalStatus(`已切换到槽位: ${target}`, 'success');
    await refreshSlots(addLog, tool);
    renderSlotList(
      (name) => activateSlot(name, addLog, onAfterSwitch, tool),
      (name) => deleteSlot(name, addLog, tool),
    );
    if (typeof onAfterSwitch === 'function') {
      await onAfterSwitch();
    }
  } catch (error) {
    addLog(`切换槽位失败: ${error.message}`, 'error');
    setSlotModalStatus(`切换失败: ${error.message}`, 'error');
  }
}

export async function saveSlot(addLog, tool = cachedTool) {
  const { input } = slotModalElements();
  const slotName = String(input?.value || '').trim();
  if (!slotName) {
    setSlotModalStatus('请输入槽位名称', 'warning');
    input?.focus();
    return;
  }
  addLog('保存当前账号到槽位...', 'info');
  try {
    const data = await apiPost('/save-slot', { name: slotName, tool });
    if (!data?.ok) {
      addLog(`保存槽位失败: ${data?.error || '未知错误'}`, 'error');
      setSlotModalStatus(`保存失败: ${data?.error || '未知错误'}`, 'error');
      return;
    }
    addLog(data.message || '槽位保存成功', 'success');
    setSlotModalStatus(data.message || '槽位保存成功', 'success');
    if (input) input.value = '';
    await refreshSlots(addLog, tool);
    renderSlotList(
      (name) => activateSlot(name, addLog, null, tool),
      (name) => deleteSlot(name, addLog, tool),
    );
  } catch (error) {
    addLog(`保存槽位失败: ${error.message}`, 'error');
    setSlotModalStatus(`保存失败: ${error.message}`, 'error');
  }
}

export async function deleteSlot(slotName, addLog, tool = cachedTool) {
  const target = String(slotName || '').trim();
  if (!target) return;
  addLog(`删除槽位: ${target}`, 'info');
  try {
    const data = await apiPost('/delete-slot', { name: target, tool });
    if (!data?.ok) {
      addLog(`删除槽位失败: ${data?.error || '未知错误'}`, 'error');
      setSlotModalStatus(`删除失败: ${data?.error || '未知错误'}`, 'error');
      return;
    }
    addLog(data.message || `已删除槽位: ${target}`, 'success');
    setSlotModalStatus(data.message || `已删除槽位: ${target}`, 'success');
    await refreshSlots(addLog, tool);
    renderSlotList(
      (name) => activateSlot(name, addLog, null, tool),
      (name) => deleteSlot(name, addLog, tool),
    );
  } catch (error) {
    addLog(`删除槽位失败: ${error.message}`, 'error');
    setSlotModalStatus(`删除失败: ${error.message}`, 'error');
  }
}

export async function openSlotManager(addLog, onAfterSwitch = null, tool = cachedTool) {
  setSlotModalVisible(true);
  setSlotModalStatus('正在读取槽位列表...', 'info');
  const data = await refreshSlots(addLog, tool);
  cachedSlots = Array.isArray(data?.slots) ? data.slots : cachedSlots;
  cachedActiveSlot = data?.activeSlot || cachedActiveSlot;
  renderSlotList(
    (name) => activateSlot(name, addLog, onAfterSwitch, tool),
    (name) => deleteSlot(name, addLog, tool),
  );
  if (!cachedSlots.length) {
    setSlotModalStatus(data?.message || '当前没有可用槽位', 'warning');
  } else {
    setSlotModalStatus(`当前槽位: ${cachedActiveSlot}`, 'info');
  }
}

export function closeSlotManager() {
  setSlotModalVisible(false);
}

export function bindSlotManager(addLog, onAfterSwitch = null) {
  const { modal, input } = slotModalElements();
  if (!modal) return;

  const closeBtn = document.getElementById('slotModalClose');
  closeBtn?.addEventListener('click', () => closeSlotManager());

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeSlotManager();
  });

  const refreshBtn = document.getElementById('slotRefreshBtn');
  refreshBtn?.addEventListener('click', async () => {
    setSlotModalStatus('正在刷新槽位...', 'info');
    await refreshSlots(addLog, cachedTool);
    renderSlotList(
      (name) => activateSlot(name, addLog, onAfterSwitch, cachedTool),
      (name) => deleteSlot(name, addLog, cachedTool),
    );
    setSlotModalStatus(`当前槽位: ${cachedActiveSlot}`, 'info');
  });

  const saveBtn = document.getElementById('slotSaveBtn');
  saveBtn?.addEventListener('click', async () => {
    await saveSlot(addLog, cachedTool);
  });

  input?.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await saveSlot(addLog, cachedTool);
    }
  });
}
