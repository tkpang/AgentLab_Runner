# Windows 宿主机 SSH 开启与 Linux 虚拟机连接指南

本文用于记录以下场景的标准流程：
- Windows 宿主机开启 SSH 服务；
- Linux 虚拟机通过内网（如 VMware VMnet8）连接宿主机；
- 解决 `Permission denied (publickey)` 等常见问题。

适用环境：
- 宿主机：Windows（OpenSSH Server）
- 虚拟机：Linux（Ubuntu）

---

## 1. 先确认网络可达（在 Linux 虚拟机执行）

```bash
ip route
hostname -I
ping -c 2 192.168.207.1
nc -zv -w 1 192.168.207.1 22
```

预期：
- `ping` 成功；
- 22 端口可达（`succeeded`）。

---

## 2. 在 Windows 开启 OpenSSH Server

管理员 PowerShell 执行：

```powershell
Get-Service sshd
Set-Service -Name sshd -StartupType Automatic
Start-Service sshd
Get-Service sshd
```

预期：`Status` 为 `Running`。

---

## 3. 在 Windows 添加 SSH 公钥（关键）

> 注意：Bitvise 页面里的指纹（fingerprint）不是登录密码，也不是公钥内容。
>  
> 当前实际连入的是 Windows OpenSSH（banner 通常是 `OpenSSH_for_Windows`）。

管理员 PowerShell 执行（将 `<YOUR_PUBLIC_KEY>` 替换成要授权的整行公钥）：

```powershell
$pub = @"
<YOUR_PUBLIC_KEY>
"@.Trim()

# 管理员常用授权文件
$ak1 = "$env:ProgramData\ssh\administrators_authorized_keys"
New-Item -ItemType Directory -Force -Path (Split-Path $ak1) | Out-Null
New-Item -ItemType File -Force -Path $ak1 | Out-Null
Add-Content -Path $ak1 -Value $pub

# 当前用户授权文件（双保险）
$ak2 = "$HOME\.ssh\authorized_keys"
New-Item -ItemType Directory -Force -Path (Split-Path $ak2) | Out-Null
New-Item -ItemType File -Force -Path $ak2 | Out-Null
Add-Content -Path $ak2 -Value $pub

# 去重
(Get-Content $ak1 | Select-Object -Unique) | Set-Content $ak1
(Get-Content $ak2 | Select-Object -Unique) | Set-Content $ak2

# 权限（重点）
icacls $ak1 /inheritance:r
icacls $ak1 /grant "Administrators:F" "SYSTEM:F"
icacls $ak2 /inheritance:r
icacls $ak2 /grant "$env:USERNAME`:F"

Restart-Service sshd
```

验证 key 是否写入：

```powershell
Select-String -Path "$env:ProgramData\ssh\administrators_authorized_keys","$HOME\.ssh\authorized_keys" -Pattern "<公钥注释关键字>"
```

例如注释是 `pangtiankai@lepro.io`，则 `-Pattern "pangtiankai@lepro.io"`。

---

## 4. 在 Linux 虚拟机测试 SSH 登录

```bash
ssh -o BatchMode=yes -o StrictHostKeyChecking=no pangtiankai@192.168.207.1 "powershell -NoProfile -Command \"Write-Host SSH_OK; whoami; (Get-Location).Path\""
```

预期输出包含：
- `SSH_OK`
- `whoami`（例如 `le\pangtiankai`）
- Windows 路径（例如 `C:\Users\pangtiankai`）

---

## 5. 常见问题排查

### Q1: `Permission denied (publickey)`
- 公钥未真正写入授权文件；
- 写入后没 `Restart-Service sshd`；
- 授权文件权限不对（`icacls` 未设置）；
- 登录用户名不对（建议先试 `用户名@IP`）。

### Q2: `Select-String` 报参数错误
- 多数是命令被换行或引号打断；
- 建议直接复制整段脚本执行，不要拆行手敲。

### Q3: 为什么 Bitvise 配了还是无效？
- SSH 连接可能仍命中 Windows OpenSSH（非 Bitvise）；
- 以 SSH banner 为准：`OpenSSH_for_Windows` 就按本文处理。

---

## 6. 安全建议

- 只在受信网络开放 22 端口；
- 使用最小权限账号；
- 定期清理不用的公钥；
- 调试结束可改回手动启动：

```powershell
Set-Service -Name sshd -StartupType Manual
Stop-Service sshd
```

