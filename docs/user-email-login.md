# 用户注册与邮箱验证码配置

用户注册不需要修改 MySQL 表或手工执行 SQL。部署时保持 `AUTO_MIGRATE=true`，应用会自动创建评论、用户活动表并扩展现有用户表。首次注册需要邮箱验证码、唯一用户名和密码；注册完成后使用用户名或邮箱加密码登录。旧版本已经自动创建的普通用户可通过“重设密码”使用邮箱验证码设置密码。

## 邮件服务是必需的

要实际发送验证码，需要在服务器 `.env` 配置一个支持 SMTP 的邮箱。通常需要在邮箱服务商后台开启 SMTP，并创建“授权码”或“应用专用密码”，不要填写邮箱网页登录密码。

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=no-reply@example.com
SMTP_PASSWORD=邮箱服务商生成的授权码
SMTP_FROM=no-reply@example.com
SMTP_FROM_NAME=Personal Website
SMTP_TLS_MODE=starttls
EMAIL_CODE_TTL_SECONDS=600
```

常见加密模式：端口 `587` 使用 `starttls`，端口 `465` 使用 `tls`。未配置 SMTP 时网站仍能正常部署和浏览，但获取验证码接口会明确提示邮件服务尚未配置。

QQ 邮箱应使用完整 QQ 邮箱地址作为 `SMTP_USERNAME` 和 `SMTP_FROM`，`SMTP_PASSWORD` 填写 QQ 邮箱生成的授权码：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USERNAME=你的QQ邮箱
SMTP_PASSWORD=QQ邮箱授权码
SMTP_FROM=你的QQ邮箱
SMTP_FROM_NAME=Personal Website
SMTP_TLS_MODE=tls
EMAIL_CODE_TTL_SECONDS=600
```

也可以使用 `SMTP_PORT=587` 和 `SMTP_TLS_MODE=starttls`。服务器必须允许访问 `smtp.qq.com` 对应的出站端口。

Redis 建议保持启用，用于验证码发送冷却、小时次数和账号限流。验证码哈希与错误次数保存在有 TTL 和容量上限的进程内存中，避免 Redis 故障切换时旧验证码覆盖新验证码；容器重启后未使用的验证码会失效，用户需要重新获取。

验证码发送成功后有 60 秒冷却；每个邮箱每小时最多发送 6 次，每个 IP 每小时最多发送 30 次。限流响应会返回 `Retry-After` 和剩余秒数，前端据此恢复倒计时。SMTP 发送失败不会消耗冷却或小时次数。

## 服务器部署检查

- 保持 `AUTO_MIGRATE=true`，并确保 MySQL 账号拥有目标数据库的 `CREATE`、`ALTER` 和 `INDEX` 权限。
- 项目默认数据库使用 `utf8mb4_unicode_ci`。代码对旧的大小写敏感排序规则提供兼容回退查询。
- 使用宿主机 Redis 时通常配置 `REDIS_ENABLED=true` 和 `REDIS_ADDR=127.0.0.1:6379`，不要把 Redis 端口开放到公网。
- 宝塔反向代理目标应为 `http://127.0.0.1:3718`，不要直接代理内部 API 端口 `8080`。
- `curl -i http://127.0.0.1:3718/api/health/full` 会检查 MySQL、上传目录和 Redis。
- API 与 SMTP 错误位于 `logs/api.log` 和 `logs/api_error.log`；Supervisor 使用文件日志时，`docker compose logs` 可能看不到这些错误。

头像保存在现有上传卷的 `uploads/user-avatars` 下。前端裁剪为 `512x512`，服务端会再次校验并压缩到 `500KB` 以内。
