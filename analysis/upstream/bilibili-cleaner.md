# bilibili-cleaner 上游解析

| 项 | 值 |
| --- | --- |
| 文档标识 | upstream/bilibili-cleaner |
| 上游 URL | https://github.com/festoney8/bilibili-cleaner.git |
| 默认分支 | main |
| HEAD | 15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9（短哈希 15d9bce） |
| 日期 | 2026-09-28 10:02:24 +0800 |
| 对照的前身钉扎 | 9ed9bc12b69f9a794957b9cb0ad556446efba1a9（短哈希 9ed9bc1），2026-08-05 12:36:28 +0800，提交说明 `v4.5.5 (#353)`，本机路径 `C:\GrokProject\biliweb\refs\bilibili-cleaner` |
| 解析日期 | 2026-10-07 |

本地克隆目录是 `C:\AIWorkspace\biliweb\refs\bilibili-cleaner`。解析开始时该目录不存在，已从上述 URL 新建克隆。`origin` 的默认分支是 `main`。当前检出 `main`，HEAD 与 `origin/main` 一致，工作树干净。解析过程没有修改上游源码，没有执行 `npm install` 或 `pnpm install`，没有 `git commit`。

克隆刚完成时仓库带有完整历史。随后按任务执行 `git fetch --shallow-since=2026-07-01`。这次 fetch 成功后，`git rev-parse --is-shallow-repository` 为 `true`，本克隆成为浅克隆。浅历史已经覆盖 2026-08 前后的提交，`9ed9bc1` 仍然存在，并且是当前 HEAD 的祖先，因此没有再执行 `git fetch --deepen`。

## 版本与标签

HEAD 的完整哈希是 `15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9`，短哈希是 `15d9bce`，提交日期是 2026-09-28 10:02:24 +0800，提交说明是 `v4.5.13 (#378)`。

`package.json` 的 `version` 字段是 `0.0.0`。用户脚本版本写在 `vite.config.ts` 的 `userscript.version`，当前值是 `4.5.13`。附注标签 `v4.5.13` 剥开后指向同一提交 `15d9bce`。`CHANGELOG.md` 最上方的版本节是 `4.5.13`，条目为：修复热门页隐藏 banner，修复分区页隐藏 banner，修复分区页隐藏分区栏，优化功能冲突提示。

附注标签 `v4.5.5` 剥开后指向 `9ed9bc12b69f9a794957b9cb0ad556446efba1a9`。该提交说明是 `v4.5.5 (#353)`，日期是 2026-08-05 12:36:28 +0800。`CHANGELOG.md` 的 `4.5.5` 节写的是：修复夜间模式报错，优化彻底隐藏推荐搜索，修复播放页播放器和视频信息交换位置。

本克隆里还能看到 `v4.5.0` 到 `v4.5.13` 的标签。`v4.5.6` 到 `v4.5.12` 的发版提交分别是 `cee90c0`、`f74dc4a`、`0d11803`、`845eb11`、`a40ee70`、`e5d5b96`、`6794385`。

## 仓库是什么

这个仓库是 festoney8 的油猴脚本「bilibili 页面净化大师」。README 把它定义成 B 站页面净化与视频、评论、动态过滤：净化顶栏、视频列表、播放器、评论区，并按时长、UP 主、标题关键词、BV 号等条件筛视频，按用户名、关键词、评论类型、等级筛评论，按用户名和视频标题筛动态。脚本匹配 `*://*.bilibili.com/*`，并在 `vite.config.ts` 里排除消息同步页、数据站、创作中心、登录、接口、直播部分子页等地址。`run-at` 是 `document-start`。README 给出的安装源是 Greasyfork 脚本 479861（稳定版），以及 GitHub `release` 分支和 JSDelivr 上的测试版用户脚本。

根目录 `LICENSE` 是 MIT License，版权声明为 Copyright (c) 2023 festoney8。`vite.config.ts` 里用户脚本的 `license` 字段同样写成 MIT。

`package.json` 的 `name` 是 `bilibili-cleaner`，`private` 为 `true`，`type` 为 `module`，`packageManager` 是 `pnpm@12.3.4`。依赖锁文件是 `pnpm-lock.yaml`。运行时依赖包括 Vue `^3.5.42`、Pinia `^3.0.4`、`@vueuse/core`、`@headlessui/vue`、`@heroicons/vue`、Tailwind CSS `^4.3.3`、`universal-cookie`、`emoji-regex-xs`、`n-gram`、`p-limit`。开发依赖包括 TypeScript `^6.0.3`、Vite `^8.3.0`、`vite-plugin-monkey` `^8.1.1`、`@vitejs/plugin-vue`、`sass-embedded`、`vue-tsc`、ESLint、Stylelint、Prettier、Husky、Vitest。构建脚本是 `vue-tsc -b && vite build`。`CHANGELOG.md` 的 `4.5.0` 节记录过工具链升级到 pnpm、Vite 8、monkey v8 和 Tailwind v4；`4.5.9` 附近的提交又把包管理器记到 pnpm 12。

顶层目录有 `.github`（CI 与 issue 模板）、`.husky`、`.vscode`、`images`（README 截图）、`src`。顶层文件还有 `README.md`、`CHANGELOG.md`、`NOTE.md`、`LICENSE`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`vite.config.ts`、`tsconfig.json`、`eslint.config.js`、`postcss.config.js`。

`src` 的入口是 `src/main.ts`。它创建 id 为 `bili-cleaner` 的节点，在该节点自己的 shadow root 里挂 Vue 应用，并用 Pinia 管净化面板和各过滤面板。页面净化规则在 `src/modules/rules`。视频、评论、动态、专栏过滤在 `src/modules/filters`。面板视图在 `src/views`，开关等控件在 `src/components`。页面判断、shadow hook、存储和 URL 处理在 `src/utils`。

## 规则按页面怎么切

页面净化的总表在 `src/modules/rules/index.ts`。它导出 `rules`，每一项带 `name`、`groups`、`style` 和 `checkFn`。`loadRuleStyle()` 只在 `checkFn()` 为真且存在样式时，把对应样式节点挂到 `document.documentElement`。开关是否生效由 `src/modules/index.ts` 的 `loadRules()` 再按同一 `checkFn` 走一遍 `group.items`。

各页面包都在 `src/modules/rules/<页面>/`。包内 `index.ts` 汇总 `groups`，`groups/*.ts` 写功能项，`groups/*.scss` 写选择器，`index.scss` 用 `@use` 收进同包的 scss。`groups` 里的文件数如下。

| 页面包 | 路径 | groups 的 ts | groups 的 scss | groups 文件合计 |
| --- | --- | --- | ---: | ---: |
| 首页 | `src/modules/rules/homepage` | 4 | 4 | 8 |
| 视频播放页 | `src/modules/rules/video` | 13 | 13 | 26 |
| 活动播放页 | `src/modules/rules/festival` | 5 | 5 | 10 |
| 番剧播放页 | `src/modules/rules/bangumi` | 10 | 10 | 20 |
| 动态页 | `src/modules/rules/dynamic` | 7 | 7 | 14 |
| 直播间 | `src/modules/rules/live` | 9 | 9 | 18 |
| 热门页 | `src/modules/rules/popular` | 3 | 3 | 6 |
| 分区页 | `src/modules/rules/channel` | 3 | 3 | 6 |
| 空间页 | `src/modules/rules/space` | 3 | 3 | 6 |
| 搜索页 | `src/modules/rules/search` | 2 | 2 | 4 |
| 稍后再看 | `src/modules/rules/watchlater` | 1 | 1 | 2 |
| 评论区 | `src/modules/rules/comment` | 1 | 1 | 2 |
| 全站通用 | `src/modules/rules/common` | 6 | 7 | 13 |
| 调试 | `src/modules/rules/debug` | 1 | 0 | 1 |

14 个页面包的 `groups` 合计 68 个 ts 和 68 个 scss，共 136 个文件。`common` 多一个没有对应 ts 的 `groups/font.scss`，由 `common/index.scss` 一并 `@use`。`debug` 只有 `groups/basic.ts`，没有 scss，也没有 `index.scss`。

`rules` 与页面判断的对应关系写在 `src/modules/rules/index.ts`。`homepage` 用 `isPageHomepage`。`video` 在 `isPageVideo()` 或 `isPagePlaylist()` 时启用，播放列表复用视频页规则。`festival`、`bangumi`、`dynamic`、`live`、`popular`、`channel`、`space`、`search`、`watchlater` 各自对应同名的 `isPage*`。`comment` 标记了 `isSpecial`，在视频、番剧、动态、空间、播放列表、活动页启用。`common` 同样标记了 `isSpecial`，`checkFn` 恒为真。`debug` 没有样式，`checkFn` 是 `isPageSpace`。`pageType.ts` 里还有 `message` 页面类型，规则目录下没有单独的 message 包。

过滤模块另按内容种类切开，总表在 `src/modules/filters/index.ts`。视频过滤页面文件在 `src/modules/filters/variety/video/pages/`，覆盖首页、播放页、热门、分区、搜索、空间。评论过滤在 `variety/comment/pages/common.ts`。动态过滤在 `variety/dynamic/pages/` 的 `dynamic.ts`、`space.ts`、`header.ts`。专栏过滤在 `variety/article/pages/searchArticle.ts`。黑白名单和比较器在各种类的 `subFilters` 与 `src/modules/filters/core`。

## enableFn 与 disableFn

`ISwitchItem` 在 `src/types/item.ts` 声明可选的 `enableFn`、`disableFn` 和 `enableFnRunAt`。`enableFnRunAt` 取 `document-start` 或 `document-end`，缺省按立即执行处理。`src/modules/index.ts` 的 `loadSwitchItem` 在 GM 存储判定为开启后调用 `enableFn`。`src/components/items/SwitchComp.vue` 在面板拨动开关时分别调用 `enableFn` 和 `disableFn`。

标识 `enableFn` 出现在约 33 个源文件、约 170 处。标识 `disableFn` 出现在约 17 个源文件、约 124 处。数量级是百次级，集中在两组目录。

`src/modules/rules` 下约 20 个 `groups/*.ts` 写出 `enableFn`，合计约 75 处；其中带 `disableFn` 的约 34 处。出现文件包括 `video/groups` 的 `basic.ts`、`miniPlayer.ts`、`playerLayout.ts`、`right.ts`、`toolbar.ts`，`bangumi/groups` 的同名一组，以及 `comment/groups/basic.ts`、`common/groups` 的 `basic.ts`、`headerCenter.ts`、`headerRight.ts`，`dynamic/groups/centerDyn.ts`、`homepage/groups/rcmd.ts`、`live/groups` 的 `basic.ts`、`headerCenter.ts`、`info.ts`，`space/groups/basic.ts`。`comment/groups/basic.ts` 单独就有约 24 对开关回调。规则侧一共 68 个 groups ts，多数开关项没有 `enableFn`。这些项靠 `loadSwitchItem` 在 `<html>` 上设置与 `id` 同名的属性，再由同名 scss 用 `html[<id>]` 选择器生效。`src/modules/rules/video/groups/basic.scss` 里 `html[video-page-hide-fixed-header]` 就是这种写法。

`src/modules/filters/variety` 下 10 个 `pages/*.ts` 成对写出 `enableFn` 和 `disableFn`，各约 87 处。文件是 `article/pages/searchArticle.ts`，`comment/pages/common.ts`，`dynamic/pages/dynamic.ts`，`dynamic/pages/space.ts`，以及 `video/pages` 的 `homepage.ts`、`video.ts`、`popular.ts`、`channel.ts`、`search.ts`、`space.ts`。

## 按页打包的样式入口

会被按页引入的 `index.scss` 共 13 个，全部由 `src/modules/rules/index.ts` 以 `?style` 后缀导入：

- `src/modules/rules/homepage/index.scss`
- `src/modules/rules/video/index.scss`
- `src/modules/rules/festival/index.scss`
- `src/modules/rules/bangumi/index.scss`
- `src/modules/rules/dynamic/index.scss`
- `src/modules/rules/live/index.scss`
- `src/modules/rules/popular/index.scss`
- `src/modules/rules/channel/index.scss`
- `src/modules/rules/space/index.scss`
- `src/modules/rules/search/index.scss`
- `src/modules/rules/watchlater/index.scss`
- `src/modules/rules/comment/index.scss`
- `src/modules/rules/common/index.scss`

`debug` 没有 `index.scss`，`rules` 里它的 `style` 是 `undefined`。每个 `index.scss` 只 `@use` 本包 `groups` 下的 scss。以视频页为例，`video/index.scss` 收进 basic、danmaku、danmakuControl、info、miniPlayer、player、subtitle、playerControl、playerLayout、right、sidebar、toolbar、upInfo。`loadRuleStyle()` 按 `checkFn` 决定挂哪几份，所以播放页会同时挂上 video、comment、common，首页会挂上 homepage 和 common。

另外两处样式不走这 13 个页面入口。`src/main.ts` 用 `import css from './style.css?style'` 把面板样式放进插件自己的 shadow root。`src/modules/filters/index.ts` 的 `loadFilterStyle()` 写入一条内联规则，用 `config.filterHideSign` 属性把命中过滤的节点设为 `display: none`。

## 页面类型与 shadow hook

对照文件是 `src/utils/pageType.ts` 的 `currPage`、`isPageHomepage` 等导出函数，以及 `src/utils/shadow.ts` 的 `Shadow` 构造函数和私有方法 `hook`。自 `9ed9bc1` 到当前 HEAD，这两个文件的 diff 为空。浅历史里它们更早的改动停在 2026-07-27 的 `5d5aecd` 和 2026-07-22 的 `51537ff`。新克隆保持 `9ed9bc1` 上的写法。前身克隆里的两处未提交补丁没有打进这个目录。

当前 `pageType.ts` 在模块顶层把 `location.href`、`location.host`、`location.pathname` 记进常量 `href`、`host`、`pathname`。`currPage()` 只读这三份常量，返回 `homepage`、`video`、`popular`、`search`、`dynamic`、`live`、`bangumi`、`playlist`、`space`、`message`、`channel`、`festival`、`watchlater` 或空字符串。模块求值时执行一次 `const ans = currPage()`。`isPageVideo`、`isPageBangumi`、`isPageFestival` 等函数比较的是 `ans`。

前身目录 `C:\GrokProject\biliweb\refs\bilibili-cleaner` 的工作区对 `src/utils/pageType.ts` 有未提交修改。那份补丁把 `href`、`host`、`pathname` 挪进 `currPage()`，删掉 `ans`，让每个 `isPage*` 在调用时再执行 `currPage()`，从而读取当时的 `location`。

当前 `shadow.ts` 的 `Shadow` 是单例，`getInstance()` 在模块末尾立刻执行。构造函数里，当 `isPageVideo()`、`isPageBangumi()`、`isPageSpace()`、`isPageDynamic()`、`isPagePlaylist()`、`isPageFestival()` 有一个为真时调用 `hook()`。这些谓词读的是上面那份页面快照。`hook()` 替换 `Element.prototype.attachShadow`，并重定义 `ShadowRoot.prototype` 的 `innerHTML`，用来在新建 shadow root 时补样式、记节点、挂 `MutationObserver`。`hook()` 本身没有“只安装一次”的标志。

前身目录对 `src/utils/shadow.ts` 的未提交补丁删掉上述页面谓词判断，构造函数直接调用 `hook()`。`hook()` 增加实例字段 `hooked`，已安装时立即返回，然后才改 `attachShadow`。补丁注释说明，页面类型如果冻在首次 URL 上，单页切换之后评论区的 shadow 会错过 hook。

## 自 2026-08-05 以来的提交

`9ed9bc1` 到 HEAD 之间有 57 个提交，时间从 2026-08-06 到 2026-09-28。HEAD 已经离开钉扎提交。下面按主题归类，每条写短哈希、日期和说明。一条提交只归一次，跨 scss 与 ts 的放在更贴近说明的那一类。

### 选择器 / DOM

- `e422fef`（2026-09-22）`feat: video page hide mini player when ending`。播放页和番剧页的 `miniPlayer.ts` 与 `miniPlayer.scss` 增加播放结束后隐藏小窗。
- `7474cd3`（2026-09-11）`fix: new header right (#369)`。`common/groups/headerRight.ts` 与对应 scss 适配新顶栏右侧。
- `6b55f14`（2026-09-09）`feat: space page hide charge video`。空间页 `basic.ts` 与 `basic.scss` 增加隐藏充电视频。
- `4af865c`（2026-09-09）`fix: fullscreen key f editable check`。播放页、番剧页 `playerLayout.ts` 和直播 `info.ts` 修正全屏快捷键与可编辑元素的判断，并改了 `src/utils/tool.ts`。
- `e2def96`（2026-09-01）`update: item detail`。直播页 `basic.ts`、`info.ts`、`info.scss` 和 `live/index.ts` 调整功能项细节。
- `3d20ba2`（2026-09-01）`remove: video page invalid items`。播放页、番剧页、活动页的 `danmakuControl` 以及播放页 `right` 去掉失效项。
- `e474547`（2026-09-12）`fix: fullscreen scrollable eplist menu issue`。播放页和番剧页 `playerLayout.ts` 与 scss 修正全屏可滚动时的选集菜单。
- `58bcb58`（2026-09-12）`fix: code review`。复查并修改播放页、番剧页 `playerLayout.ts`。
- `1b590cc`（2026-09-09）`fix: homepage redirect (#367)`。`src/main.ts` 把带 `index.html` 的首页重定向到无后缀首页。
- `a7750d0`（2026-08-30）`feat: live page disable hotkey follow`。直播页 `basic.ts` 增加禁止快捷键关注。
- `7a08905`（2026-08-30）`fix: fullscreen key f scrollable listener`。播放页和番剧页 `playerLayout.ts` 调整 F 键全屏可滚动的监听。
- `032112a`（2026-08-30）`feat: fullscreen key f scrollable`。同上两个 `playerLayout.ts` 加上 `src/utils/tool.ts`，让全屏滚动吃到 F 键。

### 样式

- `ed3d96a`（2026-09-28）`fix: channel page hide banner and channel`。改 `channel/groups/basic.scss`，对应隐藏 banner 和分区栏。
- `362ae23`（2026-09-28）`fix: popular page hide banner (#376)`。改 `popular/groups/basic.scss`。
- `8a2dce1`（2026-09-22）`fix: screen scrollable move header bottom`。改播放页和番剧页 `playerLayout.scss`，全屏滚动时把顶栏挪到底部。
- `1713745`（2026-09-22）`fix: fixed header`。改播放页、番剧页、动态页 `basic.scss` 的顶栏吸附。
- `1e0515c`（2026-09-17）`fix: header left item css`。改 `common/groups/headerLeft.scss`。
- `c7fe092`（2026-09-11）`fix: homepage hide banner (#369)`。改 `homepage/groups/basic.scss`。
- `ff2ae28`（2026-09-11）`fix: new header left (#369)`。改 `common/groups/headerLeft.scss`。
- `ae56646`（2026-09-09）`fix: space page home section`。改 `space/groups/basic.scss`。
- `1615301`（2026-09-01）`feat: video page hide below activity`。改 `video/groups/toolbar.scss`，隐藏播放器下方活动。
- `0b2b2d9`（2026-09-01）`fix: live page hide combo card`。改直播 `info.scss` 和 `right.scss`。
- `5ad78fc`（2026-08-30）`feat: live page danmaku style (#360)`。直播弹幕样式同步到 `live/groups/danmaku.scss`、`danmaku.ts`，并更新 `live/index.scss` 与 `index.ts`。
- `6156fea`（2026-08-30）`update: live page hide combo card`。改 `live/groups/right.scss`。
- `4c3d5cb`（2026-08-30）`update: live page hide combo card`。同样改 `live/groups/right.scss`。

### 过滤面板

- `a4836d7`（2026-09-17）`fix: homepage video pubdate filter (#372)`。改 `src/utils/tool.ts`，修首页视频发布日期过滤。
- `81796eb`（2026-08-30）`fix: code review`。复查评论过滤 `variety/comment/pages/common.ts`，并顺手改了播放页、番剧页 `playerLayout.ts` 和热门页 `layout.scss`。
- `43829a5`（2026-08-30）`feat: comment filter support chain filter (#358)`。评论过滤 `common.ts` 和 `subFilters/black.ts` 支持链式过滤。
- `2808d5a`（2026-08-30）`feat: update coreCheck`。更新 `filters/core/core.ts`，并改到视频、动态、专栏各页的过滤入口。
- `e308168`（2026-08-30）`fix: typo`。修正过滤核心和各 `pages` 文件里的笔误。
- `c72eb84`（2026-08-30）`feat: update calcVideoRelativity algo (#359)`。调整搜索页视频相关度算法，涉及 `video/pages/search.ts`、`tool.ts` 和依赖声明。
- `00597a0`（2026-08-30）`feat: search page video relativity filter (#359)`。搜索页视频过滤增加相关度条件。
- `8995b62`（2026-08-29）`feat: bigram calc`。用 bigram 计算相关度，改 `search.ts`、`video/subFilters/black.ts` 和 `tool.ts`，依赖里出现 `n-gram`。
- `3ffd7ed`（2026-08-29）`feat: search page video relativity filter, update deps`。落地搜索页相关度过滤并更新依赖。
- `d164ae3`（2026-08-06）`update: comment bot filter`。更新 `comment/extra/bots.ts` 和评论过滤页。

### 构建

- `bc8eb4f`（2026-09-17）`chore: bump version, update changelog`。同时改 `package.json`、`pnpm-lock.yaml`、`vite.config.ts`。
- `e525286`（2026-09-17）`fix: types`。调整 `src/types` 下 `collection.ts`、`filter.ts`、`item.ts`。
- `055987d`（2026-09-12）`chore: bump version`。只改 `vite.config.ts` 的脚本版本。
- `babe56b`（2026-09-11）`chore: pnpm 12, update readme and workflow`。包管理器升到 pnpm 12，并改 `.github/workflows` 与 README。
- `b2f9352`（2026-09-11）`chore: bump version and update changelog`。改版本号和 changelog。
- `6d6498a`（2026-09-11）`chore: update deps`。更新 `package.json` 和锁文件。
- `989510e`（2026-09-09）`chore: update changelog and deps`。更新 changelog、`package.json` 和锁文件。
- `18aeb71`（2026-08-30）`chore: update deps`。更新锁文件，并改了 README。

### 其它

- `15d9bce`（2026-09-28）`v4.5.13 (#378)`。当前 HEAD，发版合并。
- `a89be5a`（2026-09-28）`feat: add item conflict warning`。在 `video/groups/playerLayout.ts` 增加功能冲突提示，并改脚本版本说明。
- `6794385`（2026-09-22）`v4.5.12 (#375)`。发版合并。
- `e5d5b96`（2026-09-20）`v4.5.11 (#374)`。发版合并。
- `5d374f1`（2026-09-19）`fix: code review`。复查 `src/utils/tool.ts`。
- `79acc42`（2026-09-19）`fix: code review`。再次复查 `src/utils/tool.ts`。
- `a40ee70`（2026-09-12）`v4.5.10 (#371)`。发版合并。
- `afe2042`（2026-09-12）`update: adjust default enable ites`。调整一批规则项的默认启用和默认禁用，涉及播放页、番剧页、活动页、直播、首页、空间、评论和通用顶栏。
- `fbe50a8`（2026-09-12）`chore: update readme`。更新 README 和 Edge 安装图。
- `845eb11`（2026-09-11）`v4.5.9 (#370)`。发版合并。
- `0d11803`（2026-09-09）`v4.5.8 (#368)`。发版合并。
- `f74dc4a`（2026-09-01）`v4.5.7 (#363)`。发版合并。
- `e04cb69`（2026-09-01）`chore: update issue tmpl (#362)`。更新 `.github/ISSUE_TEMPLATE/bug.yaml`。
- `cee90c0`（2026-08-31）`v4.5.6 (#361)`。发版合并。

`CHANGELOG.md` 对这段区间的用户可见变化可以按版本收成几句。`4.5.6` 增加搜索页视频相关度过滤、全屏滚动的 F 键、评论链式过滤、直播禁止快捷键关注，并把直播弹幕样式对齐普通播放页。`4.5.7` 去掉播放页失效功能。`4.5.8` 修首页 `index.html` 后缀，修正 F 键对评论编辑器的影响，空间页增加视频过滤。`4.5.9` 适配首页新版顶栏左右两侧和隐藏 banner。`4.5.10` 修正全屏滚动对选集列表的影响，并调整默认开关。`4.5.11` 修首页发布日期过滤和顶栏净化。`4.5.12` 修播放页、番剧页、动态页顶栏吸附，修全屏滚动时顶栏位置，小窗播放结束后自动隐藏。`4.5.13` 即上文 HEAD 的 changelog 四条。

## 给 biliweb 重构时怎么读

后续 biliweb 重构时，这个仓库适合当成页面壳来读。值得对照的是 `src/modules/rules/<页面>/groups` 里的选择器、同名 SCSS，以及开关项上的 `enableFn` 和 `disableFn`。页面是否该挂哪一套壳，看 `src/modules/rules/index.ts` 的 `checkFn` 和 `src/utils/pageType.ts`。样式入口看各页 `index.scss` 与 `loadRuleStyle()`。

过滤引擎、GM 存储迁移、Vue 面板、右键菜单、构建和 Greasyfork 发布留在上游仓库里查阅。biliweb 的产品代码按自己的页面壳去摘选择器和启用函数，整仓用户脚本工程留在 `refs/bilibili-cleaner`，不搬进产品目录。前身克隆上的 `pageType.ts` 与 `shadow.ts` 补丁也只作为阅读记录留在本文，新克隆保持上游文件原样。

## 仓库体积

`git rev-list --count HEAD` 在当前浅克隆上得到 77。这是本克隆从浅边界走到 HEAD 能看见的提交数。`9ed9bc1..HEAD` 单独有 57 个提交。工作树排除 `.git`、且不存在 `node_modules` 时约 268 个文件，其中 `src` 约 229 个。扩展名上大约是 131 个 `.ts`、81 个 `.scss`、17 个 `.vue`，其余是图片、工作流、Markdown 和配置。
