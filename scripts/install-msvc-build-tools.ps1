#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Installs Visual Studio 2022 Build Tools with the C++ desktop workload.

.DESCRIPTION
  winget is not available on every Windows installation. This script downloads
  the official Visual Studio Build Tools bootstrapper and installs the
  "Desktop development with C++" workload, which provides MSVC + Windows SDK for
  Rust's x86_64-pc-windows-msvc target and Tauri builds.

  Run this in an elevated PowerShell window from the repository root:
    powershell -ExecutionPolicy Bypass -File .\scripts\install-msvc-build-tools.ps1
#>

$ErrorActionPreference = 'Stop'

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw '请以管理员身份运行此脚本（右键 PowerShell -> 以管理员身份运行）。'
  }
}

Assert-Administrator

$installer = Join-Path $env:TEMP 'vs_BuildTools.exe'
$url = 'https://aka.ms/vs/17/release/vs_BuildTools.exe'

Write-Host '==> 检查 Visual Studio Build Tools ...'
$vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
if (Test-Path $vswhere) {
  $existing = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
  if ($existing) {
    Write-Host "已安装：$existing"
    Write-Host 'MSVC C++ 工具链已存在，无需重复安装。'
    exit 0
  }
}

Write-Host '==> 下载 Visual Studio Build Tools 引导程序 ...'
Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
Write-Host "下载完成：$installer"

$arguments = @(
  '--wait',
  '--quiet',
  '--norestart',
  '--nocache',
  '--add', 'Microsoft.VisualStudio.Workload.VCTools',
  '--includeRecommended'
)

Write-Host '==> 开始安装 MSVC + Windows SDK，这可能需要 10-30 分钟 ...'
$process = Start-Process -FilePath $installer -ArgumentList $arguments -Wait -PassThru
if ($process.ExitCode -notin @(0, 3010, 1641)) {
  throw "安装程序退出码：$($process.ExitCode)。请查看 %TEMP%\dd_setup_* 日志。"
}

if (Test-Path $vswhere) {
  $installed = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
  if ($installed) {
    Write-Host "==> 安装成功：$installed"
  } else {
    Write-Warning '安装程序已结束，但 vswhere 未找到 VC Tools。请打开 Visual Studio Installer 确认已勾选 C++ 桌面开发工作负载。'
  }
} else {
  Write-Warning '未找到 vswhere，请打开 Visual Studio Installer 确认安装结果。'
}

if ($process.ExitCode -in @(3010, 1641)) {
  Write-Warning '安装需要重启 Windows 才能完成。请重启后再运行 npm run desktop:dev。'
}

Write-Host ''
Write-Host '下一步：'
Write-Host '  1. 关闭并重新打开终端'
Write-Host '  2. cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml'
Write-Host '  3. npm run desktop:dev'
