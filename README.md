# 私人工作台

一个 Mobile First 的本地优先 PWA。默认无需账号或云端：记录、图片、音频和附件保存在当前设备，并可导出为一个完整备份文件。

现役空间：书籍 / 英语 / 电影 / 穿搭 / 找工作 / Prompt & Skills / 生活 / 旅行。「随笔」和「经期」已从产品、路由、表单及同步模型移除；升级时旧数据会先存入可恢复的本地归档。

## 架构

- `index.html`：页面外壳、设计令牌、响应式布局、iOS Safe Area 和 PWA meta。
- `app.js`：Hash 路由、界面组件、表单交互、图片预览、拖拽排序、封面和本地备份界面。
- `store.js`：记录模型、表单定义、迁移、`localStorage` 记录、IndexedDB 二进制资产、持久存储和完整备份。
- `backup-codec.js`：`.pwb` 版本化二进制容器、逐附件 CRC32 校验和损坏检测。
- `server.js`：零依赖静态服务器；账号同步 API 作为可选能力保留，但本地模式不会调用。
- `config.js`：可公开的前端运行时配置，只放 API 地址，不得放密码或密钥。
- `manifest.json` / `sw.js`：可安装 PWA 和应用外壳离线缓存。

项目不需要打包工具或 npm 依赖。运行环境为 Node.js 20+。

## 数据模型

| 空间 | 记录特征 |
| --- | --- |
| 书籍 / 电影 / 找工作 / Prompt / 生活 | 各自独立表单与 `pw_records_<module>` 命名空间 |
| 英语 | 词汇及 `listening` / `speaking` / `reading` / `writing` 四种 `subtype`，每种独立表单 |
| 穿搭 | 每条记录是风格 `{ id, name, images[], order }`，`images` 保存稳定文件 ID 顺序 |
| 旅行 | `gone` / `want` 两种 `ttype`；去过的地点含 `images[]` 和独立 `coverPhotoId` |

每条记录都有稳定 `id`、`createdAt`、`updatedAt`。图片和附件同样使用稳定 ID 与记录关联。

## 全局图片预览

- 旅行、穿搭、找工作、Prompt & Skills 的图片，以及英语阅读/写作中的图片附件，统一使用同一个全屏查看器。
- 列表和编辑页读取 480px 缩略图；点击后从 IndexedDB 或可选云端文件接口加载原始 Blob。
- 手机支持左右滑动、双指缩放、双击放大和拖动；桌面支持方向键、滚轮缩放和鼠标拖动。
- 新导入图片会原样保存上传文件，缩略图单独生成。旧版本已经压缩为 1920px JPEG 的历史图片无法反向恢复原始画质。
- 书籍、词汇、电影和生活目前没有图片上传字段，因此没有需要接入的内容图片；以后新增图片字段时可直接复用全局查看器。

## 本地运行

```bash
node server.js
```

打开 `http://localhost:8797`。本地模式无需配置环境变量；GitHub Pages 发布版同样直接使用本机存储。

## 完整本地备份

- 「设置 → 本机数据保护」会请求浏览器持久存储，并显示当前用量、配额及保护状态。
- 「导出完整备份」生成一个 `.pwb` 文件，包含全部记录、原图、缩略图、录音和附件。
- iPhone 可通过系统分享面板保存到「文件」或 iCloud Drive；也可下载后转存到电脑。
- 「从文件恢复」会先检查文件头、版本、范围和每个二进制附件的 CRC32。全部通过后才写入 IndexedDB 和记录层。
- 默认每 7 天提醒备份，可切换为 14 或 30 天，也可关闭。
- `.pwb` 含个人原始数据且未加密，应只保存到可信位置。

## 可选云端部署

1. 使用支持长时运行 Node.js 进程的主机，启动命令为 `node server.js`。
2. 挂载持久化磁盘，并将 `WORKBENCH_DATA_DIR` 指向该磁盘。不要使用会在重启时清空的临时目录。
3. 在主机的秘密/环境变量中配置：
   - `WORKBENCH_SESSION_SECRET`（至少 32 个随机字符）
   - `WORKBENCH_DATA_DIR`
   - `PORT` / `HOST`（按云主机要求）
4. 必须使用 HTTPS，否则 PWA、Service Worker 和移动端文件能力不可靠。
5. 如果前端与 API 分开部署：将 `config.js` 的 `apiBase` 改为 API HTTPS 根地址，并把前端精确 Origin 加入 `WORKBENCH_ALLOWED_ORIGINS`。

启用可选云同步时还需在 `config.js` 将 `cloudEnabled` 改为 `true`。默认值为 `false`，本地模式不会发送同步请求。

兼容旧部署：已有 `WORKBENCH_ADMIN_EMAIL` / `WORKBENCH_ADMIN_PASSWORD` 会在首次启动时安全迁移为 `account.json`（仅保存加盐哈希），原记录和附件不变。新部署可以不配置这两个变量，直接在应用内完成首次注册。

不要把真实 `.env`、密码、Session Secret 或持久化数据目录提交到 Git。

## 升级与兼容

- 首次启动 v2 时，旧「随笔/经期」记录会归档到 `pw_removed_modules_backup_v2`。
- 旧文字型穿搭会归档到 `pw_outfit_legacy_backup_v2`，并按旧风格转成 Moodboard 分类。
- 迁移幂等，重复启动不会覆盖新数据。
- 设置页仍可导入/导出旧版 JSON（仅记录）；v2 导入兼容旧 v1 JSON。新 `.pwb` 才是包含二进制附件的完整备份。

## 测试

```bash
node --check app.js
node --check backup-codec.js
node --check store.js
node --check server.js
node tests/backup.test.mjs
node tests/store.test.mjs
node tests/album.test.mjs
node tests/migration.test.mjs
node tests/sync.test.mjs
```

`backup.test.mjs` 验证完整容器往返和损坏检测；`tests/backup.visual.html` 在真实浏览器 IndexedDB 中验证记录、照片、缩略图、音频的备份—删除—恢复闭环。`sync.test.mjs` 继续覆盖可选云同步 API。

## 真机验收

桌面浏览器和模拟视口不能完整复现 iOS 的 Safe Area、灵动岛、键盘、底部 Home Indicator、回弹滚动和触摸长按。发布 HTTPS 后，请在 iPhone 17 基础版 Safari 与「添加到主屏幕」两种模式各执行一次：安全区、输入键盘、相册多选、长按拖拽、音频播放与前后台切换。
