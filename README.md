# 私人工作台

一个 Mobile First 的本地优先 PWA，支持手机与电脑使用同一账号同步记录、图片、音频和附件。

现役空间：书籍 / 英语 / 电影 / 穿搭 / 找工作 / Prompt & Skills / 生活 / 旅行。「随笔」和「经期」已从产品、路由、表单及同步模型移除；升级时旧数据会先存入可恢复的本地归档。

## 架构

- `index.html`：页面外壳、设计令牌、响应式布局、iOS Safe Area 和 PWA meta。
- `app.js`：Hash 路由、界面组件、表单交互、图片预览、拖拽排序、封面和同步账号界面。
- `store.js`：记录模型、表单定义、迁移、`localStorage` 离线缓存、IndexedDB 二进制资产和云同步客户端。
- `server.js`：零依赖 Node.js 静态服务器 + 账号验证 + 记录合并 + 文件存储 API。
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

每条记录都有稳定 `id`、`createdAt`、`updatedAt`。客户端与服务端依据 `updatedAt` 合并；删除操作保存墓碑时间，防止离线旧设备把已删记录重新上传。

## 本地运行

```bash
cp .env.example .env  # 仅作参考；server.js 读取进程环境变量
WORKBENCH_SESSION_SECRET="at-least-32-random-characters" \
WORKBENCH_DATA_DIR="$(pwd)/.data" \
node server.js
```

打开 `http://localhost:8797`，进入「设置 → 账号与多设备同步 → 注册」创建唯一私人账号。注册成功后入口会关闭，其他设备使用同一账号登录。前后端同源时 `config.js` 保持 `apiBase: ''` 即可。

## 云端部署必需配置

1. 使用支持长时运行 Node.js 进程的主机，启动命令为 `node server.js`。
2. 挂载持久化磁盘，并将 `WORKBENCH_DATA_DIR` 指向该磁盘。不要使用会在重启时清空的临时目录。
3. 在主机的秘密/环境变量中配置：
   - `WORKBENCH_SESSION_SECRET`（至少 32 个随机字符）
   - `WORKBENCH_DATA_DIR`
   - `PORT` / `HOST`（按云主机要求）
4. 必须使用 HTTPS，否则 PWA、Service Worker 和移动端文件能力不可靠。
5. 如果前端与 API 分开部署：将 `config.js` 的 `apiBase` 改为 API HTTPS 根地址，并把前端精确 Origin 加入 `WORKBENCH_ALLOWED_ORIGINS`。

兼容旧部署：已有 `WORKBENCH_ADMIN_EMAIL` / `WORKBENCH_ADMIN_PASSWORD` 会在首次启动时安全迁移为 `account.json`（仅保存加盐哈希），原记录和附件不变。新部署可以不配置这两个变量，直接在应用内完成首次注册。

不要把真实 `.env`、密码、Session Secret 或持久化数据目录提交到 Git。

## 升级与备份

- 首次启动 v2 时，旧「随笔/经期」记录会归档到 `pw_removed_modules_backup_v2`。
- 旧文字型穿搭会归档到 `pw_outfit_legacy_backup_v2`，并按旧风格转成 Moodboard 分类。
- 迁移幂等，重复启动不会覆盖新数据。
- 设置页仍可导出/ 导入 JSON 记录备份；v2 导入兼容旧 v1 JSON。二进制附件应通过服务端持久磁盘另行备份。

## 测试

```bash
node --check app.js
node --check store.js
node --check server.js
node tests/store.test.mjs
node tests/album.test.mjs
node tests/migration.test.mjs
node tests/sync.test.mjs
```

`sync.test.mjs` 会临时启动本机 API，验证登录、两设备合并、删除墓碑、二进制文件往返和重启后持久化。

## 真机验收

桌面浏览器和模拟视口不能完整复现 iOS 的 Safe Area、灵动岛、键盘、底部 Home Indicator、回弹滚动和触摸长按。发布 HTTPS 后，请在 iPhone 17 基础版 Safari 与「添加到主屏幕」两种模式各执行一次：安全区、输入键盘、相册多选、长按拖拽、音频播放与前后台切换。
