# 服务端改造说明：Runner 路径与额度

本文对应 runner 端已完成改造（`src/agentlab-runner.ts`）：

1. Runner `hello` 上报新增 `workspace`（本地/WSL 路径候选与默认工作目录）。
2. Runner `health` 上报新增 `quota`（Codex / Claude 剩余额度）。
3. Runner 执行任务前会自动把不匹配平台的 `workDir` 修正为 runner 本地目录（避免拿到服务端路径时跑偏）。

## 1) 可直接消费的数据结构

### 1.1 `/api/runner/hello` 写入的 `last_hello_payload.workspace`

字段位置：
- `runner_environments.last_hello_payload.workspace`

结构示例：

```json
{
  "checkedAt": "2026-03-28T03:40:12.000Z",
  "defaultWorkDir": "/home/admin/agentlab-runner",
  "primaryCandidateId": "native",
  "inWsl": true,
  "candidates": [
    {
      "id": "native",
      "label": "Linux (WSL runtime)",
      "runtime": "wsl",
      "platform": "linux",
      "pathStyle": "posix",
      "cwd": "/home/admin/runner",
      "homeDir": "/home/admin",
      "tempDir": "/tmp",
      "suggestedWorkDir": "/home/admin/agentlab-runner"
    }
  ]
}
```

### 1.2 `/api/runner/health` 写入的 `last_hello_payload.health.quota`

字段位置：
- `runner_environments.last_hello_payload.health.quota`

结构示例：

```json
{
  "checkedAt": "2026-03-28T03:41:00.000Z",
  "codex": {
    "installed": true,
    "loggedIn": true,
    "version": "codex-cli 0.117.0",
    "quota5h": 82,
    "quota7d": 76,
    "quotaSupported": true,
    "error": null
  },
  "claude": {
    "installed": true,
    "loggedIn": true,
    "version": "2.1.86 (Claude Code)",
    "quota5h": 65,
    "quota7d": 53,
    "quotaSupported": true,
    "error": null
  }
}
```

## 2) 服务端建议修改点

## 2.1 Agent 创建/编辑页（Runner 模式）默认工作目录

当前问题：前端默认值是固定常量（如 `/tmp/tmp-agent`），不是 runner 实际环境。

建议：
- 在 `executionMode === 'runner'` 且已选择 `runnerEnvironmentId` 时：
  - 从 `runnerEnvironments[].lastHelloPayload.workspace.defaultWorkDir` 读取默认目录。
  - 若当前 `form.workDir` 为空，或明显跨平台（例如 windows runner + posix 路径），自动替换为该目录。

优先级：
1. `workspace.defaultWorkDir`
2. `workspace.candidates[0].suggestedWorkDir`
3. 保留现有兜底常量

## 2.2 “选择路径”行为（Runner 模式）

当前目录浏览器调用的是 `/api/system/fs/dirs`，这是服务端本机文件系统。

建议快速版（低改动）：
- Runner 模式下，不走服务端目录浏览 API。
- 改为展示 `workspace.candidates`（下拉选择）+ 可编辑输入框：
  - 点击“选择”直接填入 `suggestedWorkDir`。
  - 仍允许手动输入。

建议完整版（后续）：
- 增加 runner 远程文件浏览协议（通过 runner 作业/控制通道），再做真实远端目录树浏览。

## 2.3 Runner 额度展示

建议在设置页 Runner 卡片（`web/src/pages/Settings.tsx`）读取：
- `env.lastHelloPayload.health.quota.codex`
- `env.lastHelloPayload.health.quota.claude`

显示：
- `quota5h` / `quota7d` 百分比
- `checkedAt`
- `error`（当 `quotaSupported=false` 时）

## 2.4 可选：新增后端聚合字段（便于前端）

可在 `GET /api/runners/environments` 返回时附加：
- `workspaceSummary`: 从 `lastHelloPayload.workspace` 提炼
- `quotaSummary`: 从 `lastHelloPayload.health.quota` 提炼

这样前端无需到处解析深层 JSON。

## 3) 兼容性说明

- Runner 端已兼容 win/linux/macos，上报字段为增量字段，不影响旧服务端读取。
- 即使服务端暂未改 UI，runner 也会在执行任务前自动修正不匹配平台的 `workDir`，可减少“路径指向服务端环境”导致的实际执行偏差。
