# Personal Blog Desktop

面向读者的 Windows 博客客户端。它与 `frontend/` 共用同一个 Go API、MySQL、公开文章、项目、主题、评论和音乐数据，不包含管理员后台。

## 已实现

- 首页资料、统计、能力卡片、最新文章、精选项目、技能和 CTA
- 文章分类、标签、搜索、分页、Markdown 阅读、目录、密码文章和静态文章
- 项目筛选、全站搜索和服务端主题
- 普通用户登录、注册、重设密码、会话恢复和用户名修改
- 评论发布、回复、15 分钟内编辑、删除和加载更多
- 登录后音乐播放栏和播放列表
- Windows Credential Manager 安全保存用户令牌
- 鼠标滚轮、PageUp/PageDown、空格、Home/End 和路由滚动复位

## 服务器要求

公开阅读可以使用旧服务器。桌面登录、评论写入和音乐播放要求服务器部署本仓库最新的 `go_back/`，其中新增：

```text
POST /api/user-auth/desktop/login
```

完整契约见 `go_back/DESKTOP_AUTH.md`。生产服务器必须使用 HTTPS。

## 本地开发

先启动 Go API：

```powershell
Set-Location ..\go_back
go run ./cmd/server
```

再启动桌面应用：

```powershell
Set-Location ..\desktop
npm install
$env:PATH = "C:\Users\$env:USERNAME\.cargo\bin;$env:PATH"
npm run tauri dev
```

默认服务器是 `http://127.0.0.1:8080`，也可以在应用“设置”中改为生产域名。

## 验证

```powershell
npm run typecheck
npm run test
npm run build

Set-Location src-tauri
cargo fmt --check
cargo test --locked --offline
cargo clippy --locked --offline --all-targets -- -D warnings
```

## 构建

```powershell
npm run tauri -- build --debug --bundles msi
```

可执行文件和 MSI 位于 `src-tauri/target/debug/`。正式发布前还需要配置 Windows 代码签名。

## 登录排查

- 登录返回 404：服务器尚未部署最新 `go_back/`。
- 登录后立即失效：检查服务器 `JWT_SECRET` 和 `JWT_EXPIRATION`，并确认账号状态为 `active`。
- 公开内容正常但音乐不显示：音乐只对普通用户登录后开放，并且至少需要一首 `isPublic=true` 的音乐。
