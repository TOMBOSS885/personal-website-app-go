# 前端性能增量更新

本更新针对 Linux 浏览器滚动和首页卡顿，包含前端视觉效果降载、首页请求合并和首页数据库查询优化。更新不改动数据库结构，也不会覆盖 `config/`、`uploads/`。

## 部署

1. 在虚拟主机面板备份当前网站文件和数据库。
2. 进入能看到现有 `index.html`、`assets`、`api`、`app`、`config`、`uploads` 的运行目录。
3. 上传本 ZIP 并解压到运行目录，允许覆盖 `index.html`、`api/index.php`、`app/bootstrap.php`，并合并 `assets/`。
4. 不要删除 `assets/` 中旧文件；旧页面或浏览器缓存可能仍会引用它们。新文件使用 `r20261010-performance-` 前缀。
5. 清理 PHP OPcache（如果主机面板提供），再用浏览器强制刷新。

## 本次变化

- 低内存/低核心数设备和省流量网络自动关闭高成本装饰效果。
- 粒子背景、鼠标特效降低画布分辨率和数量，切换到后台标签页时暂停。
- 导航滚动事件改为 passive + `requestAnimationFrame` 合并更新。
- 首页首屏后的区块启用 `content-visibility` 延迟绘制。
- 首页精选/热门/专题数据并入已有 `/api/public/home` 请求，兼容旧后端回退。
- 首页后端不再把全部项目记录加载到内存，只查询精选项目和统计值。

## 验证

- `npm test`：29 个测试文件、121 个测试通过。
- `npm run build`：生产构建通过；首屏入口约 351 KB（gzip 约 116 KB）。
- PHP CLI 当前环境不可用，部署后请访问既有 `/api/health` 检查 API 返回正常。
