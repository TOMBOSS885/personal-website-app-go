# 第三方登录增量升级说明

本次升级为 PHP 共享主机版本增加 GitHub、QQ、微信登录与绑定，并增加“需绑定至少一个第三方账号”的文章权限。为了避免在没有邮件验证时产生冒领或残缺账号，本版本采用以下精简规则：

- 站内 `user_accounts` 仍是唯一用户主体，原 QQ 邮箱和密码注册保持不变。
- 用户必须先登录已有站内账号，再从“账号与登录方式”绑定第三方身份。
- 已绑定身份可以直接登录原站内账号；未绑定身份不会创建账号、自动合并账号或修改 QQ 邮箱。
- 每个用户每个平台最多绑定一个身份；同一第三方身份不能属于两个站内用户。
- 后台用户列表紧凑显示已绑定平台；点击平台标签可在详情弹窗中查看昵称、头像、平台唯一 ID、可用的 UnionID、绑定时间和最近登录时间，并支持按昵称或平台 ID 搜索。

QQ 和微信 OAuth 不会向网站返回真实 QQ 号、微信号或手机号，后台只展示平台实际授权返回的昵称、头像和 OpenID/UnionID，不会推测或伪造账号号码。

## 升级顺序

1. 备份数据库、网站文件和当前 `config/config.php`。
2. 在 phpMyAdmin 导入 `migrations/015_oauth_identities.sql`。
3. 将增量包上传到网站根目录并解压覆盖。不要删除现有 `config/config.php` 和 `uploads/`。
4. 把 `config/config.example.php` 中的 `oauth` 段合并到生产 `config/config.php`，填写真实凭据后再把对应 `enabled` 改为 `true`。
5. 确认 PHP 已启用 `curl`、`json`、`pdo_mysql`、`openssl` 和 Session。
6. 访问 `/api/health`，应返回 `schema: "015"`。

三个平台必须在各自开发者后台登记完全一致的 HTTPS 回调地址：

```text
https://omblog.tombossking.xyz/api/auth/oauth/github/callback
https://omblog.tombossking.xyz/api/auth/oauth/qq/callback
https://omblog.tombossking.xyz/api/auth/oauth/wechat/callback
```

GitHub 使用 OAuth App 的 Client ID/Client Secret。QQ 使用 QQ 互联网站应用，微信使用微信开放平台网站应用；未通过平台审核的平台保持 `enabled => false`。Secret 只能保存在服务器端 `config/config.php`，不能写入前端、提交到 Git 或粘贴到日志。

现有 Nginx 规则的通用 `/api/` 重写已覆盖 OAuth callback，因此不需要新增伪静态规则。仍应保留对 `/config/`、`/app/` 和 `/migrations/` 的拒绝访问规则。

## 上线验收

- 密码登录、注册和管理员登录正常。
- 未绑定身份登录时提示先登录站内账号并绑定，数据库不新增用户。
- 用户绑定时必须输入当前密码；取消授权、重复 callback、错误 state 均不能产生绑定。
- 同一个第三方身份不能绑定到第二个用户。
- 绑定后可从登录页直接进入原账号，解绑后立即失去“需第三方绑定”文章的访问权。
- 未登录和已登录但未绑定的用户，直接请求文章详情、文章解锁接口或静态文章签名直链时都拿不到正文。
- 后台用户列表能搜索绑定身份，点击已绑定平台后可查看授权返回的账号详情；操作日志能区分登录、绑定、解绑的成功与失败。

生产凭据未包含在增量包中。没有真实平台应用凭据时，三个入口默认不显示，这是预期的安全行为。
