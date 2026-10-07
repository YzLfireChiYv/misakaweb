# HANDOFF — biliweb 重构仓

| 字段 | 值 |
|------|----|
| 文档标识 | `docs/HANDOFF.md` |
| 更新 | 2026-10-07 |
| 工作区 | `C:\AIWorkspace\biliweb` |
| 前身 | `C:\GrokProject\biliweb`，保留为历史树 |
| 本仓状态 | 体验版 0.1.2。公开仓库 `https://github.com/YzLfireChiYv/misakaweb`。安装文件的 `@downloadURL` 与 `@updateURL` 指向该仓库的 raw 脚本。 |

人类负责目标和验收。这一轮只重建仓库并解析上游，方便后面的正式任务开工。没有迁移产品源码，没有改上游文件，没有安装依赖。

## 新会话阅读顺序

1. 本文件。
2. `analysis/predecessor/misaka-clean-map.md`。前身产品叫 MisakaClean，安装版本按 `package.json` 与产品 HANDOFF 是 **0.5.1-test**。根 HANDOFF 的产品表和 `docs/PURPOSE.md` 的「现在做到哪」仍写着 v0.4.1-test，以地图里的对照表为准。
3. `analysis/upstream/PINS.md`。五个上游的 HEAD、浅克隆范围、许可证。
4. 任务碰到某一仓时，再打开 `analysis/upstream/` 下对应的解析。
5. 需要前身的目标陈述、过滤模型和 KEEP / DROP 时，回 `C:\GrokProject\biliweb` 读 `docs/PURPOSE.md`、`products/misaka-clean/docs/filter-engine-models.md`、`products/misaka-clean/docs/filter-fields.md`、`analysis/misaka-clean-settings-DIFF.txt`。这些正文没有复制到本仓。

## 本仓目录

```text
biliweb/
  README.md
  docs/HANDOFF.md
  products/experience/        体验版 0.1.2 安装脚本 misakaweb.user.js
  analysis/upstream/          五份解析 + PINS.md
  analysis/predecessor/       MisakaClean 模块地图
  refs/bilibili-cleaner       experience 分支，gitignore
```

`refs/**` 除 `refs/README.md` 外不进本仓提交。`private/`、`node_modules/`、`dist/` 已忽略。不要把前身 `private/` 和个人日用的 253 条标题规则复制过来。

## 上游这一轮的结论

| 上游 | HEAD | 后续任务要记住的事实 |
|------|------|----------------------|
| bilibili-cleaner | `15d9bce` v4.5.13（2026-09-28） | 相对前身钉扎 `9ed9bc1` v4.5.5 有 57 个提交。顶栏、banner、分区栏、热门页、直播、评论链式过滤、搜索相关度都有改动。`pageType.ts` 仍冻住首次 URL，`shadow.ts` 仍按首次页面决定是否 hook `attachShadow`。前身 SPA 补丁没有进入这次干净克隆。 |
| bilibili_blocked_videos_by_tags | `33a7d07` v1.5.0（2025-11-30） | 停在前身同一提交。单文件 3032 行。标题和热搜读 DOM；标签、view、UP 卡片、评论走接口，并有 3 秒缓存。脚本头仍 `@require` cdnjs 与 bootcdn 上的 Vue 3.2.31。许可证是 CC-BY-NC-SA。 |
| Bilibili-Evolved | `fa06dce` v2.11.4（2026-09-26） | 2026 年仍活跃。组件在 `registry/lib/components/`，样式注入在 `src/core/style.ts`，shadow 样式在 `src/core/shadow-root/`。过滤与去广告组件包括 `removePromotions`、`feedsFilter`、`blackList`、`clear-home` 等。作只读对照。 |
| wider-bilibili | `6a8d970` 0.4.9（2026-08-04） | 宽屏主要在 `src/styles/video.css` 与 `src/styles/common.css`。播放器状态在 `src/main.ts`。README 写明兼容 Bilibili-Evolved 的夜间模式和自定义顶栏。 |
| scriptcat | `8085454`（2026-09-29） | GM API 在 `src/app/service/content/gm_api/` 与 service worker 同名目录。元数据解析在 `src/pkg/utils/script.ts` 的 `parseMetadata`。扩展许可证是 GPLv3。 |

各仓解析里的路径、计数和提交说明以那些文件为准。本文件只保留开工需要的索引。

## 前身产品留在旧树里的状态

净化壳已接上：KEEP 335 项，默认全关，34 个 `enableFn` 进了 hooks。构建依赖 `refs/bilibili-cleaner`，构建前由 `products/misaka-clean/scripts/patch-cleaner-spa.mjs` 打上面那两处 SPA 补丁。

视频过滤雏形已能藏卡并回滚，默认关闭。业态预设有 `preset-video-civic`、`preset-video-hustle`、`preset-video-review`。厚编辑器雏形在前身 `products/misaka-clean/editor/`。同步、插件、评论、动态、专栏仍是预留槽。

## 体验版 0.1.2

安装 `products/experience/misakaweb.user.js`。脚本名是「bilibili 页面净化大师 体验版」。命名空间是 `https://github.com/YzLfireChiYv/misakaweb`。试用时关掉官方脚本，避免两支一起藏卡。

公开仓库名是 `misakaweb`。自动更新只请求这个仓库的 raw 脚本。问题反馈菜单打开 `YzLfireChiYv/misakaweb` 的 issues。

源码在 `refs/bilibili-cleaner` 分支 `experience`，基底是 `15d9bce`（v4.5.13）。

视频过滤在原有黑名单、白名单和 BV 高权限之后，对仍然显示、且不是白名单救回的视频按需取播放量、点赞数、收藏数。低于已打开项的下限就用 cleaner 原有方式藏卡。三个开关都关时不请求。取数失败不藏，留给下一次扫描。

规则仓库同步只传名单和阈值。页面开关、净化开关、WebDAV 链接和密码留在本机。`bili-rules.stamp` 是时间戳，`bili-rules.pack` 是简略 gzip 正文。谁的时间戳更晚谁覆盖谁，相同则不传。

`pageType` 每次读当前网址。`attachShadow` 总是挂钩且只挂一次。`history.pushState` 之后会补启动新页面的净化项和过滤器。

前身 MisakaClean 没有迁进本仓。没有恢复 MisakaWeb，没有新建原生 App 目录。
