# 上游快照（2026-10-07）

| 字段 | 值 |
|------|----|
| 文档标识 | `analysis/upstream/PINS.md` |
| 解析日期 | 2026-10-07 |
| 克隆根 | `C:\AIWorkspace\biliweb\refs` |
| 前身钉扎所在 | `C:\GrokProject\biliweb\refs` |

本表是这一轮拉取后、本机 `git log -1` 核对过的快照。完整树留在 `refs/`，不进本仓 git 历史。逐仓解析在同目录的五份文档里。

| 目录 | 上游 | 分支 | HEAD | 日期 | 版本 | 相对前身 |
|------|------|------|------|------|------|----------|
| `bilibili-cleaner` | https://github.com/festoney8/bilibili-cleaner | `main` | `15d9bce` | 2026-09-28 | 用户脚本 `4.5.13`（`package.json` 仍是 `0.0.0`） | 前身钉在 `9ed9bc1`（v4.5.5，2026-08-05）。其后 57 个提交。`9ed9bc1` 仍是祖先。 |
| `bilibili_blocked_videos_by_tags` | https://github.com/tjxwork/bilibili_blocked_videos_by_tags | `main` | `33a7d07` | 2025-11-30 | 脚本头 `1.5.0` | 与前身钉扎相同。2025-11-30 之后没有新提交。 |
| `Bilibili-Evolved` | https://github.com/the1812/Bilibili-Evolved | `master` | `fa06dce` | 2026-09-26 | 用户脚本 `2.11.4`（`v2.11.4-70-gfa06dce`） | 前身通常只在归档包里。2026 年浅历史里有 479 个提交。 |
| `wider-bilibili` | https://github.com/posthumz/wider-bilibili | `master` | `6a8d970` | 2026-08-04 | `0.4.9` | 前身没有这份工作树克隆。最后提交说明是 `fix: 播放器高度`。 |
| `scriptcat` | https://github.com/scriptscat/scriptcat | `main` | `8085454` | 2026-09-29 | `package.json` `1.5.0-beta.4`；`src/manifest.json` `1.5.0.1500` | 前身没有这份工作树克隆。HEAD 在标签 `v1.5.0-beta.4` 之后。 |

## 克隆深度

| 目录 | 历史 |
|------|------|
| `bilibili-cleaner` | 克隆完成后执行过 `git fetch --shallow-since=2026-07-01`，当前是浅仓库。可见提交约 77 个，已盖住 `9ed9bc1` 到 `15d9bce`。要更早历史时再 `git fetch --unshallow`。 |
| `bilibili_blocked_videos_by_tags` | `git fetch --shallow-since=2025-11-01` 之后是浅仓库。窗口内最新提交就是 `33a7d07`。 |
| `Bilibili-Evolved` | `--depth 1` 后再 `--shallow-since=2026-01-01`。可见提交 479 个，最早约 2026-01-05。 |
| `wider-bilibili` | 普通克隆，历史完整。跟踪文件 40 个。 |
| `scriptcat` | `--depth 1` 后再 `--shallow-since=2026-06-01`。可见提交 162 个，从 2026-06-02 到 HEAD。 |

五份工作树在核对时都是干净的，没有本机补丁，也没有 `node_modules`。

## 跟版时先看的差异

`bilibili-cleaner` 从 v4.5.5 到 v4.5.13 的用户可见变化，CHANGELOG 可以收成这些：

- 4.5.6：搜索页视频相关度过滤、全屏滚动的 F 键、评论链式过滤、直播禁止快捷键关注、直播弹幕样式对齐播放页。
- 4.5.7：去掉播放页失效功能。
- 4.5.8：首页 `index.html` 后缀、F 键对评论编辑器的影响、空间页视频过滤。
- 4.5.9：首页新版顶栏左右两侧、隐藏 banner。
- 4.5.10：全屏滚动对选集列表的影响、一批默认开关调整。
- 4.5.11：首页发布日期过滤、顶栏净化。
- 4.5.12：播放页、番剧页、动态页顶栏吸附、全屏滚动时顶栏位置、小窗在播放结束后隐藏。
- 4.5.13：热门页隐藏 banner、分区页隐藏 banner、分区页隐藏分区栏、功能冲突提示。

`src/utils/pageType.ts` 与 `src/utils/shadow.ts` 在 `9ed9bc1..15d9bce` 的 diff 为空。上游仍在模块加载时冻住 `location`，并且只在首次页面属于视频、番剧、空间、动态、播放列表、活动时 hook `attachShadow`。前身那两处 SPA 补丁留在 `C:\GrokProject\biliweb\refs\bilibili-cleaner` 的未提交修改里，没有打进这次新克隆。

## 许可证（后续抽取时先看）

| 仓库 | 许可证 | 抽取时的约束 |
|------|--------|----------------|
| bilibili-cleaner | MIT | 可以对照选择器、SCSS、`enableFn`。保留版权声明。 |
| bilibili_blocked_videos_by_tags | 脚本头 `@license` 为 `CC-BY-NC-SA`。仓库没有单独的 `LICENSE` 文件。 | 只抽取字段和判定思路。不要把该单文件并进可再分发的产品源码。 |
| Bilibili-Evolved | MIT，另有再分发限制（完整脚本再发布时保留 README 安装入口，或自行承接支持并改掉指向原仓库的反馈渠道） | 只读对照组件和样式注入。不要整包再发布。 |
| wider-bilibili | MIT | 只读对照布局 CSS。 |
| scriptcat | GPLv3 | 只作宿主行为对照。不要把扩展源码打进用户脚本产品。 |
