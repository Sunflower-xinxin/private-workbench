# 私人工作台（Web 原型 / PWA）

本地优先、离线可用的私人收纳工作台 Web 原型。10 个模块：书籍 / 英语（雅思）/ 电影 / 穿搭 /
找工作 / Prompt & Skills / 生活 / 随笔 / 经期 / 旅行。

**旅行模块**含完整照片相册：双列瀑布流、全屏查看器（左右滑动 · 双指缩放 · 双击放大）、
批量选择/删除、缩略图懒加载。照片以 Blob 存 IndexedDB（缩略图 + 原图独立副本）。

## 手机安装（添加到主屏幕）

1. 用手机浏览器（iOS Safari / Android Chrome）打开本站地址
2. iOS：分享 → **添加到主屏幕**；Android：菜单 → **添加到主屏幕 / 安装应用**
3. 添加后从桌面图标启动，全屏独立运行，**离线可用**（Service Worker 缓存外壳）

> 数据仅存本机（localStorage + IndexedDB），不上传任何服务器；清除浏览器数据会删除未备份内容。

## 本地运行

```bash
node server.js   # 或任意静态服务器指向本目录，打开 http://localhost:8797
```

## 结构

- `index.html` 外壳 + 设计系统；`store.js` 数据层（模块隔离存储/草稿/备份导出导入）
- `app.js` UI 与路由（含旅行相册 v0.3 与全屏查看器）
- `manifest.json` + `sw.js` + 图标：PWA（可安装、离线）
- `tests/` 数据层自动化测试（Node 直接运行）
- `gen-icon.js` 图标生成脚本（纯 Node，无依赖）
