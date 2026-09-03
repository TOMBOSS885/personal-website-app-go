# 第三方登录增量升级说明

本次升级为 PHP 共享主机版本增加 GitHub、QQ、微信、Google、Microsoft 登录与绑定，并增加“需绑定至少一个第三方账号”的文章权限。为了避免在没有邮件验证时产生冒领或残缺账号，本版本采用以下精简规则：

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

五个平台必须在各自开发者后台登记完全一致的 HTTPS 回调地址：

```text
https://omblog.tombossking.xyz/api/auth/oauth/github/callback
https://omblog.tombossking.xyz/api/auth/oauth/qq/callback
https://omblog.tombossking.xyz/api/auth/oauth/wechat/callback
https://omblog.tombossking.xyz/api/auth/oauth/google/callback
https://omblog.tombossking.xyz/api/auth/oauth/microsoft/callback
```

GitHub 使用 OAuth App 的 Client ID/Client Secret。QQ 使用 QQ 互联网站应用，微信使用微信开放平台网站应用。Google 使用 Google Cloud 的 OAuth 2.0 Web application，授权范围需要 `openid`、`profile`、`email`。Microsoft 使用 Microsoft Entra ID（原 Azure AD）的 App registration，平台选择 Web，授权范围需要 `openid`、`profile`、`email`、`User.Read`；多租户登录使用本实现的 `common` 端点。未通过平台审核的平台保持 `enabled => false`。Secret 只能保存在服务器端 `config/config.php`，不能写入前端、提交到 Git 或粘贴到日志。

## Google 开通步骤

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)，创建或选择项目。
2. 在“API 和服务 -> OAuth consent screen”完成应用信息；个人测试应用可先将自己的 Google 账号加入测试用户。
3. 在“API 和服务 -> 凭据”创建“OAuth 客户端 ID”，应用类型选择“Web application”。
4. 在“Authorized redirect URIs”添加：`https://omblog.tombossking.xyz/api/auth/oauth/google/callback`。
5. 复制 Client ID 和 Client Secret 到服务器 `config/config.php` 的 `oauth.google`，确认回调地址逐字一致，再将 `enabled` 改为 `true`。

## Microsoft 开通步骤

1. 打开 [Microsoft Entra admin center](https://entra.microsoft.com/)，进入“应用注册 -> 新注册”。
2. 选择支持的帐户类型；需要 Microsoft 个人账号和组织账号时选择“任何组织目录中的帐户和个人 Microsoft 帐户”。
3. 在“身份验证 -> 添加平台 -> Web”中添加：`https://omblog.tombossking.xyz/api/auth/oauth/microsoft/callback`。
4. 在“API 权限”添加 Microsoft Graph 委托权限 `openid`、`profile`、`email`、`User.Read`，按租户要求授予管理员同意。
5. 在“证书和密码”创建客户端密码，复制其 **Value**（只显示一次）以及“应用程序(客户端) ID”。将二者填入 `oauth.microsoft`，再将 `enabled` 改为 `true`。

配置后访问 `/api/auth/oauth/providers`，对应平台应同时返回 `enabled: true` 和 `configured: true`。然后先用 QQ 邮箱密码登录，在 `/account` 中绑定平台；只有绑定过的平台账号才能从登录页快捷登录。

现有 Nginx 规则的通用 `/api/` 重写已覆盖 OAuth callback，因此不需要新增伪静态规则。仍应保留对 `/config/`、`/app/` 和 `/migrations/` 的拒绝访问规则。

## 生产配置片段

不要用示例文件覆盖整个生产配置，只把下面两个键合并到现有顶层 `oauth` 数组中；保留站点原有的 `app`、`database`、`security` 等配置：

```php
'google' => [
    'enabled' => true,
    'client_id' => '从 Google Cloud 复制的 Client ID',
    'client_secret' => '仅服务器保存的 Client Secret',
    'callback_url' => 'https://omblog.tombossking.xyz/api/auth/oauth/google/callback',
],
'microsoft' => [
    'enabled' => true,
    'client_id' => 'Microsoft 应用程序(客户端) ID',
    'client_secret' => 'Microsoft 客户端密码 Value',
    'callback_url' => 'https://omblog.tombossking.xyz/api/auth/oauth/microsoft/callback',
],
```

如果暂时只开通一个平台，另一个保持 `enabled => false` 和空凭据即可。修改后清理 PHP OPcache（如主机面板提供该按钮），再访问 `/api/auth/oauth/providers` 验收。

## 上线验收

- 密码登录、注册和管理员登录正常。
- 未绑定身份登录时提示先登录站内账号并绑定，数据库不新增用户。
- 用户绑定时必须输入当前密码；取消授权、重复 callback、错误 state 均不能产生绑定。
- 同一个第三方身份不能绑定到第二个用户。
- 绑定后可从登录页直接进入原账号，解绑后立即失去“需第三方绑定”文章的访问权。
- 未登录和已登录但未绑定的用户，直接请求文章详情、文章解锁接口或静态文章签名直链时都拿不到正文。
- 后台用户列表能搜索绑定身份，点击已绑定平台后可查看授权返回的账号详情；操作日志能区分登录、绑定、解绑的成功与失败。

生产凭据未包含在增量包中。没有真实平台应用凭据时，对应平台入口默认不显示，这是预期的安全行为。

本次改动的定向 OAuth 测试全部通过；完整前端测试仍有一个既有的 `live2dCsp` 测试因伪静态配置文本包含 `script-src 'unsafe-inline'` 失败，与本次第三方登录代码无关。
