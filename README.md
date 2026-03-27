# AgentLab Runner

`runner/` 是可独立发布的执行端，用于接收 AgentLab Server 下发的作业并在本机执行。

## 目标

- 可单独开源、单独发版（不依赖服务端源码）。
- 支持 Linux（Ubuntu）和 Windows。
- 支持快速一键配置 Codex / Claude Code（可二选一或都装）。

## 运维文档

- Windows 宿主机 SSH 开启 + Linux 虚拟机连接排障：
  - `runner/docs/windows-host-ssh-from-linux-vm.md`

## 快速开始

1. 安装依赖（任选其一）  
Linux/Ubuntu（在 runner 独立仓库执行）:

```bash
bash scripts/setup-ubuntu.sh --all
```

中国网络建议（加速 npm/Node 下载）:

```bash
bash scripts/setup-ubuntu.sh --all --use-cn-mirror
```

Windows (PowerShell，在 runner 独立仓库执行):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1 -InstallAll
```

中国网络建议（加速 npm/Node 下载）:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1 -InstallAll -UseChinaMirror
```

Windows（双击方式，不闪退，推荐给非命令行用户）:

```bat
scripts\setup-windows.cmd
```

Windows（图形化安装器，推荐给小白用户）:

```bat
scripts\setup-windows-gui.cmd
```

Web GUI（跨平台，浏览器界面）:

Linux / macOS:

```bash
bash scripts/start-web-gui.sh
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-web-gui.ps1
```

Windows（卸载本地工具，按需）:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/uninstall-windows.ps1 -RemoveCodex -RemoveClaude -RemoveNode
```

或：

```bat
scripts\uninstall-windows.cmd -RemoveCodex -RemoveClaude -RemoveNode
```

2. 启动 runner

Linux/Ubuntu:

```bash
RUNNER_SERVER="http://127.0.0.1:3200" RUNNER_TOKEN="xxxx" bash scripts/start-runner.sh
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-runner.ps1 -Server "http://127.0.0.1:3200" -Token "xxxx"
```

Windows（双击方式）:

```bat
scripts\start-runner.cmd
```

推荐（统一生命周期脚本，自动管理 Web GUI + Runner PID/日志）:

Linux / macOS:

```bash
RUNNER_SERVER="http://127.0.0.1:3200" RUNNER_TOKEN="xxxx" ./start.sh
./stop.sh
./restart.sh
```

Windows:

```powershell
.\start.ps1 -Server "http://127.0.0.1:3200" -Token "xxxx"
.\stop.ps1
.\restart.ps1 -Server "http://127.0.0.1:3200" -Token "xxxx"
```

默认 `start.ps1` 使用 `desktop` 模式（Electron 独立窗口 + 系统托盘，可再次唤出）。
若你要强制浏览器模式，可显式指定：

```powershell
.\start.ps1 -Server "http://127.0.0.1:3200" -Token "xxxx" -GuiMode web
```

说明：
- 脚本会写入 `.run/runner.pid`、`.run/gui.pid`。
- 日志在 `.run/runner.log`、`.run/gui.log`。
- 如果未提供 `RUNNER_TOKEN`，会只启动 GUI，不会启动 runner daemon。

GUI 安装器支持：
- 勾选安装 Codex / Claude
- 勾选中国镜像加速
- Codex 一键网页登录（自动打开浏览器 + 自动复制设备码）
- Claude 引导式登录（自动打开登录页 + 自动拉起 `claude login` 终端 + 提示弹窗）
- 一键检查登录状态（`Check Login Status`）
- 启动后自动检测 Node / Codex / Claude，顶部显示红绿状态灯（可悬浮看路径）
- 一键卸载所选工具（Codex / Claude / 可选 Node runtime）
- 多账号槽位：`Save Slot / Activate Slot / Delete Slot`
- 余量查询：刷新后展示当前账号 5h / 7d 剩余额度（进度条 + 百分比）
- 安装时显示“当前步骤 + 下载速率（KB/s/MB/s）”，避免误判卡死
- 填写 Server/Token 后一键启动 runner
- 默认中文界面，可一键切换英文；日志提示也会跟随语言切换

备注：Claude 登录是可选项。没有 Claude 账号也可以只使用 Codex 运行。

说明：当前“余量查询”基于 Codex app-server 的 `account/rateLimits/read` 接口实现。

## GUI 结构（v2）

当前 `gui/` 已按功能拆分，便于和 AgentLab 主站共用逻辑：

- `app-v2.js`: 页面编排与事件绑定
- `modules/api.js`: API 请求封装
- `modules/log.js`: 日志渲染
- `modules/env.js`: 环境检测与状态渲染
- `modules/quota.js`: 额度信息渲染
- `modules/slots.js`: 多账号槽位管理
- `styles-v2.css`: 统一主题变量（暗色 token）

账号槽位说明：
- 槽位数据保存在 `runner/.accounts/windows/<slot>/`
- 本地凭证切换是“文件级切换”，切换后再启动 CLI 即生效
- 仅适合你自己的机器使用（凭证文件不加密）
- `runner/.accounts/` 已加入 `.gitignore`，不要把本机凭证提交到仓库

说明：
- `setup-*` 脚本会自动安装 runner 依赖（`npm install`），不需要再手工执行。
- 默认把 `codex/claude` 安装到 runner 本地目录（`.tools/npm-global`），不污染系统全局环境。
- 若系统没有可用 Node.js，脚本会优先尝试系统安装；失败时回退到 runner 内的便携 Node（`.runtime`）。
- 可通过参数自定义下载源：
  - Windows: `-NpmRegistry <url> -NodeDistBaseUrl <url>`
  - Ubuntu: `--npm-registry=<url> --node-dist-base-url=<url>`

如果你在主仓库中运行（runner 作为子目录），命令前加 `runner/` 前缀即可，例如：

```bash
bash runner/scripts/setup-ubuntu.sh --all
RUNNER_SERVER="http://127.0.0.1:3200" RUNNER_TOKEN="xxxx" bash runner/scripts/start-runner.sh
```

## 最小必需环境

为了运行 runner，本质必需项只有：
- Node.js 20+（runner 进程与 CLI 依赖）
- 至少一个 Agent CLI（Codex 或 Claude Code）

脚本已尽量把“必需安装”收敛到以上两项，不再要求额外全局 npm 环境配置。

## 关于“右键运行闪退”

- Windows 的“右键 -> 使用 PowerShell 运行”本身会在脚本结束后自动关闭窗口，容易看不到错误信息。
- 建议优先使用 `scripts\setup-windows.cmd` / `scripts\start-runner.cmd`（已内置 `-NoExit`），或者在终端中手动执行 `.ps1`。

## 可选环境变量

- `RUNNER_SERVER`: 服务端地址（默认 `http://127.0.0.1:3200`）
- `RUNNER_TOKEN`: 必填，Runner Token
- `RUNNER_ID`: 可选，Runner 唯一标识
- `RUNNER_CODEX_EXECUTION_MODE`: `auto` / `sandboxed` / `unsafe`

## 认证说明

- Codex CLI 安装后请自行完成登录认证（例如运行 `codex login`）。
- Claude Code CLI 安装后请自行完成登录认证（例如运行 `claude login` 或配置对应 API 凭证）。

## 作为独立仓库维护（Git Submodule）

`runner/` 本身是独立 Git 仓库，主仓库只通过 submodule 挂载它。

在主仓库中常用命令：

```bash
# 初始化/更新 submodule
git submodule update --init --recursive

# 查看 runner 子模块状态
git submodule status runner
```

更新 runner 代码的推荐方式：

```bash
# 进入 runner 子仓库开发
cd runner
git checkout -b feat/xxx
# ...修改并提交...
git push origin HEAD

# 回到主仓库，提交 submodule 指针
cd ..
git add runner .gitmodules
git commit -m "chore: bump runner submodule"
```
