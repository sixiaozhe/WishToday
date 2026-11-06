# Dayline Desktop (Tauri 2)

桌面壳加载 `apps/web` 的构建产物，并通过 Tauri 命令直接读写本机 SQLite 数据库，与 Web 版共用同一套 Repository 与 UI。

## 前置条件

- Node.js 22+
- Rust stable：`rustup default stable`
- Windows：Visual Studio Build Tools（“使用 C++ 的桌面开发”工作负载）。如果 `winget` 不可用，可在管理员 PowerShell 中运行：
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\install-msvc-build-tools.ps1
  ```
  脚本会从微软官方地址下载 Build Tools 引导程序并安装 MSVC + Windows SDK。
- WebView2 Runtime（Windows 10/11 一般已内置）

## 运行

```bash
# 仓库根目录
npm install
npm run desktop:dev
```

如果 Tauri 的 `beforeDevCommand` 路径在当前 CLI 版本下解析不正确，可手动先启动 Web：

```bash
npm run dev
# 另一个终端
npm run tauri dev --workspace @dayline/desktop
```

## 说明

- `frontendDist` 指向 `apps/web/dist`，桌面与 Web 共用同一套 UI。
- 数据层：桌面端通过 `db_open` / `db_all` / `db_run` / `db_batch` / `db_close` 命令访问 `rusqlite`，数据库位于 `%APPDATA%\com.dayline.desktop\`；Web 端使用 SQLite-WASM + OPFS。两端共用 `packages/db` 的 `SqliteRepository`。
- 桌面端不注册 PWA Service Worker，避免 `tauri.localhost` 缓存旧构建；旧版本遗留的缓存会在启动时自动清理。
- 应用图标位于 `src-tauri/icons/`（由 `scripts/generate-app-icons.ps1` 生成）；`tauri build` 会产出 MSI 与 NSIS 安装包。
- 当前安装包未签名，Windows SmartScreen 可能提示；正式分发前需补代码签名。
