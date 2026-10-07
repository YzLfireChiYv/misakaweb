# biliweb

哔哩哔哩网页端的用户脚本与插件整合。工作区是 `C:\AIWorkspace\biliweb`。

这个目录是 `C:\GrokProject\biliweb` 的全面重构。前身那套独立壳不再作为这一版的结构。当前可安装的是体验版 0.1.2。公开仓库是 `YzLfireChiYv/misakaweb`。脚本只从这份仓库更新。

## 现在磁盘上有什么

| 路径 | 内容 |
|------|------|
| `products/experience/` | 体验版安装脚本 `misakaweb.user.js` |
| `refs/bilibili-cleaner` | 体验版源码，分支 `experience` |
| `refs/` | 五个上游的本机克隆。嵌套 git 仓库，不进本仓历史。 |
| `analysis/upstream/` | 各上游的解析，以及 `PINS.md` 快照表。 |
| `analysis/predecessor/` | 前身 MisakaClean 的模块地图。长文档仍在前身仓库。 |
| `docs/HANDOFF.md` | 下一轮会话的入口。 |

## 上游

| 目录 | 这一轮的 HEAD | 角色 |
|------|----------------|------|
| `refs/bilibili-cleaner` | `15d9bce`（v4.5.13，2026-09-28） | 页面壳：选择器、SCSS、`enableFn` |
| `refs/bilibili_blocked_videos_by_tags` | `33a7d07`（v1.5.0，2025-11-30） | 内容判定的字段与接口点子 |
| `refs/Bilibili-Evolved` | `fa06dce`（v2.11.4，2026-09-26） | 更重的网页改造对照 |
| `refs/wider-bilibili` | `6a8d970`（0.4.9，2026-08-04） | 宽屏与布局对照 |
| `refs/scriptcat` | `8085454`（1.5.0-beta.4 之后，2026-09-29） | 安装宿主，GM API 以它为准 |

克隆命令和各仓能不能改，写在 `refs/README.md`。提交哈希与许可证写在 `analysis/upstream/PINS.md`。

## 下一轮先读

1. `docs/HANDOFF.md`
2. `analysis/predecessor/misaka-clean-map.md`
3. `analysis/upstream/PINS.md`
