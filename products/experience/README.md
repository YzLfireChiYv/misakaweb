# 体验版 0.1.0

安装文件是 `bilibili-cleaner-experience.user.js`。把它交给 ScriptCat 或 Tampermonkey。脚本名是「bilibili 页面净化大师 体验版」，命名空间和官方脚本分开。两支脚本同时开时会各藏一次卡片，试用时把官方脚本关掉。

这支脚本基于 bilibili-cleaner `15d9bce`（v4.5.13）。源码改动在 `refs/bilibili-cleaner` 的 `experience` 分支。没有接 Greasy Fork 的更新地址，管理器不会把它换回官方版。

## 这一版有什么

视频过滤跑完原有黑名单、白名单和 BV 高权限之后，对仍然会显示、且不是白名单救回的视频按需请求播放量、点赞数、收藏数。低于打开的那几项下限就藏卡。三个开关都关时不请求。白名单救回的卡片不请求。

规则仓库同步在各过滤面板的「规则仓库同步」。填写 WebDAV 目录、账号、密码，并打开总开关。目录里会有 `bili-rules.stamp` 和 `bili-rules.pack`。两个时间戳谁更晚，谁覆盖另一边；相同则不传文件。同步的是名单和阈值。页面开关、净化开关、链接和密码留在本机。

从首页点进视频时，页面判断会跟着当前网址走，对应页面的过滤会补启动。

## 重新构建

```powershell
cd C:\AIWorkspace\biliweb\refs\bilibili-cleaner
corepack pnpm install --ignore-scripts
corepack pnpm exec vue-tsc -b
corepack pnpm exec vite build
Copy-Item -Force dist\bilibili-cleaner.user.js C:\AIWorkspace\biliweb\products\experience\bilibili-cleaner-experience.user.js
```
