# Personal Website Studio

个人网站的 Tauri 2 桌面管理端。桌面端通过 HTTPS 调用仓库中的 Go/Gin API，与 Web 站点共用 MySQL、Redis 和 `uploads` 数据。

## 已实现

- Tauri 2 + React 18 + TypeScript + Vite 桌面工程。
- 服务器连接验证、管理员登录、系统凭据库会话保存。
- 工作台统计与完整健康检查。
- 文章 CRUD、Markdown 安全预览、图片/静态站点上传、SQLite 自动草稿。
- 项目、技能、能力卡片和个人资料管理。
- 图片、主题、音乐和 Live2D 基础管理。
- 用户、评论、操作日志、安全事件和上传限制管理。
- 深浅色模式、最小窗口布局、路由懒加载和错误边界。
- 单实例、系统外链校验、最小 Tauri capability。

## 本地环境

- Node.js 20+，当前开发环境使用 Node.js 24。
- Rust stable。
- Windows Visual Studio Build Tools（Desktop development with C++）。
- WebView2 Runtime。
- 可运行的 Go API；默认开发地址为 `http://127.0.0.1:8080`。

## 启动

先启动后端：

```powershell
Set-Location ..\go_back
go run ./cmd/server
```

再启动桌面端：

```powershell
Set-Location ..\desktop
npm.cmd install
npm.cmd run tauri dev
```

只调试 Web UI：

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

浏览器访问 `http://127.0.0.1:1420`。浏览器模式不会持久化管理员 token，正式桌面运行时 token 保存在 Windows Credential Manager。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build

Set-Location src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test

Set-Location ..\..\go_back
go test ./...
```

## 服务器要求

- 正式连接必须使用 HTTPS 根地址，例如 `https://example.com`。
- Nginx 将 `/api` 和 `/uploads` 转发到现有 Go 服务。
- 只向公网开放 80/443，不开放 MySQL、Redis 或 8080。
- 不需要为 Tauri 原生 HTTP 将 CORS 改成 `*`。
- Live2D 和音乐上传需要适当的 `client_max_body_size` 与代理超时。

桌面端依赖以下新增接口：

- `GET /api/meta`
- `GET /api/admin/session`
- 全局 `X-Request-ID`

其余业务接口继续使用现有 `/api/admin/*`。

## 发布前检查

当前 `src-tauri/capabilities/main.json` 允许连接任意 HTTPS 地址，便于开发时配置站点。正式发布前必须将 `https://**` 收紧为实际生产 API 域名，并配置 Windows Authenticode、Tauri updater 签名和正式多尺寸图标。

完整架构说明见 [`../docs/desktop-app-development-spec.md`](../docs/desktop-app-development-spec.md)。
