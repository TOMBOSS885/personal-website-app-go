# 邮箱验证码用户系统配置

用户登录不需要修改 MySQL 表或手工执行 SQL。部署时保持 `AUTO_MIGRATE=true`，应用会自动创建评论、用户活动表并扩展现有用户表。

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

Redis 建议保持启用，用于验证码、错误次数、冷却时间和账号限流。Redis 不可用时应用会自动使用有容量限制的内存降级；容器重启后未使用的验证码会失效。

头像保存在现有上传卷的 `uploads/user-avatars` 下。前端裁剪为 `512x512`，服务端会再次校验并压缩到 `500KB` 以内。
