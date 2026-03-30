#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';

const args = process.argv.slice(2);

function parseArgs(argv) {
  const parsed = {
    action: 'list',
    slot: '',
    json: false,
    root: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    const normalized = token.toLowerCase();

    if (normalized === '--action' || normalized === '-action') {
      parsed.action = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (normalized.startsWith('--action=')) {
      parsed.action = token.slice(token.indexOf('=') + 1).trim();
      continue;
    }
    if (normalized === '--slot' || normalized === '-slot') {
      parsed.slot = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (normalized.startsWith('--slot=')) {
      parsed.slot = token.slice(token.indexOf('=') + 1).trim();
      continue;
    }
    if (normalized === '--root' || normalized === '-root') {
      parsed.root = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (normalized.startsWith('--root=')) {
      parsed.root = token.slice(token.indexOf('=') + 1).trim();
      continue;
    }
    if (normalized === '--json' || normalized === '-json') {
      parsed.json = true;
      continue;
    }
    if (!token.startsWith('-') && !parsed.action) {
      parsed.action = token;
      continue;
    }
    if (!token.startsWith('-') && parsed.action === 'list' && ['save', 'activate', 'delete', 'show-active'].includes(token.toLowerCase())) {
      parsed.action = token;
    }
  }

  return parsed;
}

const parsed = parseArgs(args);
const action = normalizeAction(parsed.action);
const homeDir = os.homedir();
const appData = process.env.APPDATA || '';
const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
const slotsRoot = parsed.root ? path.resolve(parsed.root) : path.join(homeDir, '.agentlab', 'account-slots', process.platform || 'unknown');
const activeSlotFile = path.join(slotsRoot, '.active-slot');

const knownTargets = [
  { tool: 'codex', key: 'codex_auth', filePath: path.join(homeDir, '.codex', 'auth.json') },
  { tool: 'codex', key: 'codex_config', filePath: path.join(homeDir, '.codex', 'config.json') },
  { tool: 'codex', key: 'codex_config_toml', filePath: path.join(homeDir, '.codex', 'config.toml') },
  { tool: 'codex', key: 'codex_cap_sid', filePath: path.join(homeDir, '.codex', 'cap_sid') },
  { tool: 'claude', key: 'claude_home_json', filePath: path.join(homeDir, '.claude.json') },
  { tool: 'claude', key: 'claude_config', filePath: path.join(homeDir, '.claude', 'config.json') },
  { tool: 'claude', key: 'claude_credentials', filePath: path.join(homeDir, '.claude', 'credentials.json') },
  { tool: 'claude', key: 'claude_dot_credentials', filePath: path.join(homeDir, '.claude', '.credentials.json') },
  { tool: 'claude', key: 'claude_xdg_credentials', filePath: path.join(xdgConfigHome, 'claude', 'credentials.json') },
];

if (appData) {
  knownTargets.push({ tool: 'claude', key: 'claude_appdata_credentials', filePath: path.join(appData, 'Claude', 'credentials.json') });
}

const uniqueKnownTargets = dedupeTargets(knownTargets);

function dedupeTargets(list) {
  const seen = new Set();
  const rows = [];
  for (const item of list) {
    const fp = path.resolve(item.filePath);
    const key = process.platform === 'win32' ? fp.toLowerCase() : fp;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ ...item, filePath: fp });
  }
  return rows;
}

function normalizeAction(value) {
  const v = String(value || 'list').trim().toLowerCase();
  if (!v) return 'list';
  if (v === 'list' || v === 'save' || v === 'activate' || v === 'delete' || v === 'show-active') return v;
  throw new Error(`Unsupported action: ${value} (allowed: list/save/activate/delete/show-active)`);
}

function normalizeSlotName(value) {
  const v = String(value || '').trim();
  if (!v) throw new Error('Slot name is required.');
  if (/[\\/:*?"<>|]/.test(v)) throw new Error('Slot name contains invalid characters: \\/:*?"<>|');
  return v;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath) {
  try {
    const st = fs.statSync(filePath);
    return st.isFile();
  } catch {
    return false;
  }
}

function dirExists(dirPath) {
  try {
    const st = fs.statSync(dirPath);
    return st.isDirectory();
  } catch {
    return false;
  }
}

function removeIfExists(targetPath) {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function normalizeForCompare(p) {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isSubPath(targetPath, parentPath) {
  const target = normalizeForCompare(targetPath);
  const parent = normalizeForCompare(parentPath);
  return target === parent || target.startsWith(`${parent}${path.sep}`);
}

function toRelativeStorePath(absPath) {
  const resolved = path.resolve(absPath);
  if (isSubPath(resolved, homeDir)) {
    const rel = path.relative(homeDir, resolved);
    return path.join('user_home', rel);
  }
  if (appData && isSubPath(resolved, appData)) {
    const rel = path.relative(appData, resolved);
    return path.join('appdata', rel);
  }
  if (xdgConfigHome && isSubPath(resolved, xdgConfigHome)) {
    const rel = path.relative(xdgConfigHome, resolved);
    return path.join('xdg_config', rel);
  }
  const safeName = resolved.replace(/[:/\\\s]/g, '_');
  return path.join('other', safeName);
}

function toAbsoluteTargetPath(storedPath) {
  const raw = String(storedPath || '').trim();
  if (!raw) throw new Error('Invalid stored path');
  const parts = raw.split(/[\\/]+/).filter(Boolean);
  if (parts.length < 2) throw new Error(`Invalid stored path: ${raw}`);
  const scope = parts.shift();
  const rest = parts.join(path.sep);
  if (scope === 'user_home') return path.join(homeDir, rest);
  if (scope === 'appdata') {
    if (!appData) throw new Error('APPDATA is empty.');
    return path.join(appData, rest);
  }
  if (scope === 'xdg_config') return path.join(xdgConfigHome, rest);
  throw new Error(`Unsupported stored scope: ${scope}`);
}

function writeActiveSlot(slot) {
  ensureDir(slotsRoot);
  fs.writeFileSync(activeSlotFile, `${slot}\n`, 'utf8');
}

function clearActiveSlot() {
  removeIfExists(activeSlotFile);
}

function readActiveSlot() {
  if (!fileExists(activeSlotFile)) return '';
  try {
    return fs.readFileSync(activeSlotFile, 'utf8').trim();
  } catch {
    return '';
  }
}

function listSlots() {
  if (!dirExists(slotsRoot)) {
    return {
      ok: true,
      action: 'list',
      slotsRoot,
      activeSlot: '',
      slots: [],
    };
  }

  const activeSlot = readActiveSlot();
  const names = fs.readdirSync(slotsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'));

  const slots = names.map((name) => {
    const slotDir = path.join(slotsRoot, name);
    const metaPath = path.join(slotDir, 'meta.json');
    let updatedAt = '';
    let savedCount = 0;
    if (fileExists(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        updatedAt = typeof meta.updatedAt === 'string' ? meta.updatedAt : '';
        savedCount = Number(meta.savedCount || 0);
      } catch {
        // ignore
      }
    }
    return {
      name,
      isActive: name === activeSlot,
      updatedAt,
      savedCount: Number.isFinite(savedCount) ? savedCount : 0,
    };
  }).sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    if (ta !== tb) return tb - ta;
    return a.name.localeCompare(b.name);
  });

  return {
    ok: true,
    action: 'list',
    slotsRoot,
    activeSlot,
    slots,
  };
}

function collectStoredFiles(rootDir) {
  const rows = [];
  if (!dirExists(rootDir)) return rows;

  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        rows.push(abs);
      }
    }
  }
  return rows;
}

function saveSlot(slotName) {
  const slot = normalizeSlotName(slotName);
  const slotDir = path.join(slotsRoot, slot);
  const filesDir = path.join(slotDir, 'files');
  ensureDir(slotsRoot);
  removeIfExists(filesDir);
  ensureDir(filesDir);

  const savedFiles = [];
  for (const target of uniqueKnownTargets) {
    if (!fileExists(target.filePath)) continue;
    const relPath = toRelativeStorePath(target.filePath);
    const storePath = path.join(filesDir, relPath);
    ensureDir(path.dirname(storePath));
    fs.copyFileSync(target.filePath, storePath);
    let bytes = 0;
    try {
      bytes = fs.statSync(target.filePath).size;
    } catch {
      // ignore
    }
    savedFiles.push({
      tool: target.tool,
      key: target.key,
      source: target.filePath,
      storedAs: relPath,
      bytes,
    });
  }

  const meta = {
    slot,
    updatedAt: new Date().toISOString(),
    savedCount: savedFiles.length,
    files: savedFiles,
  };
  ensureDir(slotDir);
  fs.writeFileSync(path.join(slotDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  return {
    ok: true,
    action: 'save',
    slot,
    savedCount: savedFiles.length,
    slotDir,
    warning: savedFiles.length === 0 ? 'No known credential files found. Please login first.' : '',
    message: savedFiles.length === 0
      ? `槽位已保存：${slot}（未发现可保存的凭证文件，请先登录）`
      : `槽位已保存：${slot}`,
  };
}

function activateSlot(slotName) {
  const slot = normalizeSlotName(slotName);
  const slotDir = path.join(slotsRoot, slot);
  const filesDir = path.join(slotDir, 'files');
  if (!dirExists(slotDir)) throw new Error(`Slot not found: ${slot}`);
  if (!dirExists(filesDir)) throw new Error(`Slot has no saved files: ${slot}`);

  const storedFiles = collectStoredFiles(filesDir);
  const restorePlan = [];
  for (const abs of storedFiles) {
    const rel = path.relative(filesDir, abs);
    try {
      const targetPath = toAbsoluteTargetPath(rel);
      restorePlan.push({ source: abs, target: targetPath });
    } catch {
      // skip unsupported stored scope
    }
  }
  if (restorePlan.length === 0) {
    throw new Error(`Slot has no restorable credential files: ${slot}`);
  }

  for (const target of uniqueKnownTargets) {
    removeIfExists(target.filePath);
  }

  const restored = [];
  for (const item of restorePlan) {
    ensureDir(path.dirname(item.target));
    fs.copyFileSync(item.source, item.target);
    restored.push(item.target);
  }

  writeActiveSlot(slot);
  return {
    ok: true,
    action: 'activate',
    slot,
    restoredCount: restored.length,
    restored,
    message: `已切换到槽位：${slot}`,
  };
}

function deleteSlot(slotName) {
  const slot = normalizeSlotName(slotName);
  const slotDir = path.join(slotsRoot, slot);
  if (!dirExists(slotDir)) {
    return {
      ok: true,
      action: 'delete',
      slot,
      deleted: false,
      message: 'Slot not found.',
    };
  }
  removeIfExists(slotDir);
  if (readActiveSlot() === slot) clearActiveSlot();
  return {
    ok: true,
    action: 'delete',
    slot,
    deleted: true,
    message: `已删除槽位：${slot}`,
  };
}

function showActiveSlot() {
  return {
    ok: true,
    action: 'show-active',
    activeSlot: readActiveSlot(),
  };
}

function writeResult(payload, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

try {
  let result;
  if (action === 'list') {
    result = listSlots();
  } else if (action === 'save') {
    result = saveSlot(parsed.slot);
  } else if (action === 'activate') {
    result = activateSlot(parsed.slot);
  } else if (action === 'delete') {
    result = deleteSlot(parsed.slot);
  } else {
    result = showActiveSlot();
  }

  writeResult(result, parsed.json);
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const payload = {
    ok: false,
    action,
    error: message,
  };
  writeResult(payload, parsed.json);
  process.exit(1);
}
