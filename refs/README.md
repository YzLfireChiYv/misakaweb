# refs/（本机上游克隆）

这些目录是 GitHub 上的上游仓库，给后续重构对照用。完整树不进本仓 git 历史。快照说明写在 `analysis/upstream/`。

2026-10-07 拉下来的上游钉扎见 `analysis/upstream/PINS.md`。`bilibili-cleaner` 的 `experience` 分支在此之上做了体验版，并让页面判断跟着当前网址走。

| 目录 | 2026-10-07 HEAD |
|------|-----------------|
| `bilibili-cleaner` | 上游 `15d9bce`（v4.5.13）。体验版改动在分支 `experience`。 |
| `bilibili_blocked_videos_by_tags` | `33a7d07`（v1.5.0） |
| `Bilibili-Evolved` | `fa06dce`（v2.11.4） |
| `wider-bilibili` | `6a8d970`（0.4.9） |
| `scriptcat` | `8085454`（1.5.0-beta.4 之后） |

```powershell
cd C:\AIWorkspace\biliweb\refs
git clone https://github.com/festoney8/bilibili-cleaner.git
git clone https://github.com/tjxwork/bilibili_blocked_videos_by_tags.git
git clone https://github.com/the1812/Bilibili-Evolved.git
git clone https://github.com/posthumz/wider-bilibili.git
git clone https://github.com/scriptscat/scriptcat.git
```

| 目录 | 角色 |
|------|------|
| `bilibili-cleaner` | 页面壳：选择器、净化开关、SCSS、`enableFn` |
| `bilibili_blocked_videos_by_tags` | 内容判定点子：标题、标签、点赞率、收藏投币比等。只抽取，不整份搬 |
| `Bilibili-Evolved` | 更重的网页改造对照 |
| `wider-bilibili` | 宽屏与布局对照 |
| `scriptcat` | 安装宿主。GM API 以它为准 |

前身仓库在 `C:\GrokProject\biliweb`。新的工作区是 `C:\AIWorkspace\biliweb`。
