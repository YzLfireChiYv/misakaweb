# 前身地图 — MisakaClean

| 字段 | 值 |
|------|----|
| 文档标识 | `analysis/predecessor/misaka-clean-map.md` |
| 前身路径 | `C:\GrokProject\biliweb` |
| 解析日期 | 2026-10-07 |
| 前身 HANDOFF 写的版本 | 根 `docs/HANDOFF.md` 文首写 **v0.5.1-test**，同文「产品分工」表写 **v0.4.1-test**。产品 `products/misaka-clean/docs/HANDOFF.md` 文首与表内都写 **0.5.1-test**。 |
| package.json 版本 | `products/misaka-clean/package.json` 的 `version` 为 **0.5.1-test**。 |

本文件只作新仓入口地图。长文仍留在前身，后续任务按需回读。解析时未复制前身源码，未解压任何 7z，未读取 `private/`，未执行 `npm install`，未改前身树里的任何文件。

---

## 1. 前身是什么

前身工作区路径是 `C:\GrokProject\biliweb`。根目录是薄 monorepo，产品源码在 `products/` 下，根上没有产品 `src/`。

主力产品名是 MisakaClean，目录是 `products/misaka-clean`。`package.json` 的包名是 `misakaclean`，描述写的是净化壳加上视频过滤雏形（多词表、一次编译、评分）。

安装用的构建产物是 `products/misaka-clean/dist/misakaclean.user.js`。产品 HANDOFF 与根 HANDOFF 都写体积大约 750KB，gzip 大约 146KB。运行宿主是 ScriptCat + Edge。安装时把该用户脚本交给 ScriptCat，覆盖旧版。

同一产品目录下还有独立编辑页 `editor/`，开发命令是 `npm run editor`，端口 5174。磁盘上另有 `editor-dist/`。用户脚本与编辑页是两份构建。

版本以各文件原文为准，本次读到的写法如下。

| 读到的文件 | 该文件里写的版本 |
|------------|------------------|
| `products/misaka-clean/package.json` | `0.5.1-test` |
| `products/misaka-clean/docs/HANDOFF.md` | 文首 **v0.5.1-test**，表内 **0.5.1-test** |
| `docs/HANDOFF.md` | 文首 **v0.5.1-test**；「产品分工」表写成 **v0.4.1-test** |
| `docs/PURPOSE.md`「现在做到哪」 | **v0.4.1-test**（文内日期 2026-08-14） |
| `products/misaka-clean/docs/architecture.md` | 标题写 **v0.4.1**，文首表写 **0.5.1-test** |

`package.json` 与产品 HANDOFF 一致，都是 `0.5.1-test`。根 HANDOFF 文首与产品表不一致。`docs/PURPOSE.md` 的「现在做到哪」仍停在 v0.4.1-test。架构文标题与表内版本也不一致。下文叙述产品现状时，以 `package.json` 与产品 HANDOFF 的 **0.5.1-test** 为安装版本，并保留上表里较旧的写法，避免把某一份文档单独当成唯一版本。

项目要解决的是内容过滤，对象是家长，自定义空间要留足。净化是接上游壳时带上的页面减法。上游主要是本机 `refs/bilibili-cleaner`，负责页面变了之后的选择器、SCSS 和他们的 `enableFn`。MisakaClean 负责把裁定留下的壳接稳，并放入自己的过滤与同步。跟版只动适配层。过滤模块和同步模块不因跟版去改 cleaner 源码，也不依赖 cleaner 的开关 id。

当前形态是浏览器里的用户脚本。平板方案写成后一阶段，优先改网页。前身在写这些文档时，仓库里没有独立 App 目录。

---

## 2. 模块地图

入口是 `src/main.ts`，调用 `src/core/boot.ts` 的 `boot()`。`boot()` 按 `src/modules/types.ts` 里的 `MODULE_ORDER` 依次 `setup()`。单个模块失败会记日志，不会拦住后面的模块。顺序是 purify 20、filter 30、sync 40、plugins 45、shell 50。数字之间留了空隙。

判定代码在 `src/filter/`，不 import `@cleaner`。藏卡与回滚在 `src/apply/filter-video-apply.ts` 和 `src/apply/video-cards.ts`。净化路径是 `features/catalog.keep.json`、`apply/style-pack.ts`、`apply/hooks-runtime.ts`、`apply/purify-apply.ts`、`page/route-watch.ts`。

| 目录 | 角色 | 职责 |
|------|------|------|
| `src/apply/` | 净化壳与过滤应用分文件存放 | `style-pack.ts`、`hooks-runtime.ts`、`purify-apply.ts` 属于净化壳，接 bilibili-cleaner 的样式包和 `enableFn`。`filter-video-apply.ts`、`video-cards.ts` 属于过滤核心，负责按页等待节点、打 hide sign、增量跳过已访问、`revertAll` 回滚。 |
| `src/core/` | 启动骨架；插件 API 是预留槽 | `boot.ts` 按顺序启动模块。`config.ts` 占存储键名。`registry.ts` 的 `registerPlugin()` 是插件预留槽，启动时只打印已注册数量。 |
| `src/features/` | 净化壳 | KEEP 目录、出现页判断和特性类型。`catalog.keep.json` 当前 335 条，每条 `defaultEnabled` 都是 `false`。`domain` 目前是 `purify`。人类裁定为 DROP 的项不在这份目录里。 |
| `src/filter/` | 过滤核心 | 词表、编译、自动机、评分、hybrid 链路、业态预设、走图和 `decideVideo`。评论、动态、专栏只在类型和 `kinds` 里占位，扫描未接。 |
| `src/modules/` | 启动模块，角色按文件分开 | `purify-module.ts` 是净化壳。`filter-module.ts` 是过滤核心。`sync-module.ts` 是同步预留槽。`plugin-module.ts` 是插件预留槽。`shell-module.ts` 挂界面并注册 ScriptCat 菜单。 |
| `src/page/` | 净化壳 | 从 URL 判断页面类型，监听 B 站 SPA 换路，并在换页后补跑尚未跑过的 `enableFn`。 |
| `src/storage/` | 净化壳存储、过滤存储、差量 | `features.ts` 只保存值为 true 的净化开关，并迁移一批旧 id。`filter.ts` 持久化 `misakaclean.filter.v1`。`shell.ts` 保存快捷按钮。`settings-diff.ts` 做相对默认的差量。同步键和插件键在 `core/config.ts` 占名，这两处存储尚未写入。 |
| `src/ui/` | 净化壳界面、过滤薄入口、同步预留面板 | `PurifyPanel.vue`、`SideFab.vue`、`SwitchRow.vue`、`menu.ts`、`mount.ts` 服务净化壳和菜单。`FilterPanel.vue` 是 B 站页上的过滤薄入口。`SyncPanel.vue` 能管快捷按钮，WebDAV 只有预留文案。评论、动态、专栏过滤共用面板，扫描未接。 |
| `src/utils/` | 共用 | `logger.ts` 写日志。 |
| `src/main.ts`、`src/vite-env.d.ts` | 入口与类型环境 | `main.ts` 启动 `boot()`。`vite-env.d.ts` 是 Vite 类型声明。 |

预留槽集中在三处。同步预留槽是 `modules/sync-module.ts` 和存储键 `misakaclean.sync.v1`，接入函数名是 `setSyncApi()`。插件预留槽是 `modules/plugin-module.ts`、`core/registry.ts` 的 `registerPlugin()` 和存储键 `misakaclean.plugins.v1`。评论、动态、专栏预留槽是过滤面板上的对应栏目，以及 `kinds` 里的 comment、dynamic、article；现在只跑视频。

厚编辑器不在 `src/` 里。它的页面在产品目录 `editor/`，求值仍调用 `src/filter/` 的 `tracePipeline`。

本次读到的 `src` 文件路径如下。

```text
src/main.ts
src/vite-env.d.ts
src/apply/filter-video-apply.ts
src/apply/hooks-runtime.ts
src/apply/purify-apply.ts
src/apply/style-pack.ts
src/apply/video-cards.ts
src/core/boot.ts
src/core/config.ts
src/core/registry.ts
src/features/appear.ts
src/features/catalog.keep.json
src/features/catalog.keep.ts
src/features/types.ts
src/filter/ac.ts
src/filter/compile.ts
src/filter/engine.ts
src/filter/graph.ts
src/filter/linear.ts
src/filter/match.ts
src/filter/parse.ts
src/filter/presets.ts
src/filter/score.ts
src/filter/types.ts
src/filter/walk.ts
src/modules/filter-module.ts
src/modules/plugin-module.ts
src/modules/purify-module.ts
src/modules/shell-module.ts
src/modules/sync-module.ts
src/modules/types.ts
src/page/page-state.ts
src/page/page-type.ts
src/page/route-watch.ts
src/storage/features.ts
src/storage/filter.ts
src/storage/settings-diff.ts
src/storage/shell.ts
src/ui/App.vue
src/ui/FilterPanel.vue
src/ui/host.css
src/ui/menu.ts
src/ui/mount.ts
src/ui/PurifyPanel.vue
src/ui/shell-api.ts
src/ui/SideFab.vue
src/ui/SwitchRow.vue
src/ui/SyncPanel.vue
src/utils/logger.ts
```

---

## 3. 构建依赖

构建必须能解析本机已有的 `refs/bilibili-cleaner`。该克隆被 gitignore。从产品目录看，相对路径是 `../../refs/bilibili-cleaner`。缺少这份克隆时，构建前的补丁脚本会直接失败，并提示先按 `refs/README.md` 克隆。

补丁脚本是 `products/misaka-clean/scripts/patch-cleaner-spa.mjs`。`package.json` 用 `prebuild` 在 `vite build` 之前调用它。脚本可重复执行。它只改本机克隆里的两个文件，仓库里的这份脚本是这两处修改的记录。

| 被补的文件 | 补丁落点 |
|------------|----------|
| `refs/bilibili-cleaner/src/utils/shadow.ts` | `attachShadow` 在构造时就 hook，并且最多装一次。补丁去掉按首次页面类型才 hook 的门闩，避免首页再点进视频后评论区 shadow 钩子错过。 |
| `refs/bilibili-cleaner/src/utils/pageType.ts` | `href`、`host`、`pathname` 改到 `currPage()` 内部每次读取当前 `location`。补丁去掉模块加载时缓存的 `ans`。 |

产品目录里的构建与检查命令是 `npm run build`、`npm run check:filter`、`npm run check:settings-diff`、`npm run check:page-type`。编辑页是 `npm run editor` 与 `npm run build:editor`。根 HANDOFF 写明根目录 `package.json` 可以用 `npm run build:clean` 把构建转发到该产品。目录对账脚本还有 `rebuild-catalog.mjs`、`fix-catalog-groups.mjs`、`reconcile-catalog.mjs`。组名中文来自 `fix-catalog-groups.mjs`。id 由 `rebuild-catalog.mjs` 按 cleaner 的 `page|name` 生成。

`vite.config.ts` 用 `dualAtAlias` 区分两套 `@/`，并用 `?style` 把 SCSS 编成样式元素。跟版允许动的适配层是 `apply/style-pack.ts`、`apply/hooks-runtime.ts`、`features/catalog.keep.json`，以及上述补丁脚本打到本机克隆上的两处。`modules/filter-module.ts` 与 `modules/sync-module.ts` 禁止因跟版而改，这两处也不 import `@cleaner`。

壳上已经接入的规模：KEEP 335 项；34 个带 `enableFn` 的项已接入 hooks。对账报告在前身 `analysis/misaka-clean-catalog-RECONCILE.txt`。

---

## 4. 过滤雏形做到哪一步

产品 HANDOFF 把默认写成：所有净化开关关闭；过滤总开关关闭；存储里找不到的键视为关闭。代码里 `emptyKindState()` 的 `enabled` 是 `false`，`mode` 是 `hybrid`，`pipelineId` 是空字符串，`scoreThreshold` 是 80。读取存储时，只有 `enabled === true` 才算打开。全新安装时净化 values 是空对象，因此不写 html 属性、不跑 enable。

视频藏卡与回滚已经在真 B 站上由人类测过，人类说测试成功。实现照抄 cleaner：查 `.feed-card` 本身（首页打在查到的那个节点上），hide sign，incr 跳过已访问，`revertAll` 回滚。应用文件是 `src/apply/filter-video-apply.ts` 与 `src/apply/video-cards.ts`。设置菜单随时可开，不按进页类型锁死，对应 `src/ui/menu.ts`。净化开关的真页点验，产品 HANDOFF 写明 AI 仍未在真 B 站 + ScriptCat 上点过。

默认链路名叫 **hybrid**，日常扣分表 id 是 `video-title-penalty`。顺序是：BV 点名弃用（白名单救不回来）；白名单和已关注放行；其余硬名单弃用（标题黑、UP 精确或关键词、时长、播放量、发布天数）；然后标题扣分表评分。一行写成 `词 + 词` 时，空格加号空格分开的每一段都必须同时出现。词表内按运行分从高到低，第一行命中就停。分数大于等于 `scoreThreshold`（默认 80）则弃用。面板日常入口只有「加一条标题扣分」。硬名单和条件默认折起。

救人规则写在评分上：点赞量和收藏率都过门槛，才从扣分里减 100。缺一个数不救。首页卡片上常常没有这两个数。180 万播放配 9% 点赞，按设计救不了。类型里有 `likes` 和 `favRate`，抽取路径没有接站点接口。

业态预设已经有三条可选链路，出处写在 0.4.2。id 在 `src/filter/presets.ts`。

| 业态 id | 链路 id | 词表 id | 面板名 |
|---------|---------|---------|--------|
| `civic` | `preset-video-civic` | `video-title-penalty-civic` | 时政 / 课文 |
| `hustle` | `preset-video-hustle` | `video-title-penalty-hustle` | 搞钱副业 |
| `review` | `preset-video-review` | `video-title-penalty-review` | 影评夸张 |

默认 hybrid 的 `pipelineId` 仍是空字符串，只使用日常扣分表。三张业态表不进同一个评分节点。分区自动进线、游戏线、绿灯线还没有。`buildTradePipeline` 在 `src/filter/linear.ts`，选中某条业态时只叠那一张表。

厚编辑器的位置是 `products/misaka-clean/editor/`，文件为 `editor/index.html`、`editor/main.ts`、`editor/App.vue`、`editor/editor.css`。产品 HANDOFF 写 0.5.0 已有阶段列、试走和导入导出。画布是自绘阶段列，求值走 `tracePipeline`。B 站脚本只留「打开规则树页」薄入口，打开地址写成 `http://127.0.0.1:5174/`。画布不打进 `misakaclean.user.js`。拖拽重连、防环编辑、GitHub Pages 托管还没有。根 `docs/HANDOFF.md` 在 2026-08-13 至 08-14 的阶段表里仍写「已定，代码未做厚编辑器」。产品目录里 `editor/` 已经存在，产品 HANDOFF 与 `analysis/unfinished-named-work.md` 把该目录记成可用雏形。两份文档的这句话对应不同日期，以磁盘上的 `editor/` 和产品 HANDOFF 描述当前雏形。

已定模型名词与边界摘自 `products/misaka-clean/docs/filter-engine-models.md` 和 `products/misaka-clean/docs/filter-fields.md`，此处只留名词。

| 中文 | 代码标识 | 已定边界 |
|------|----------|----------|
| 词表 | `Lexicon` | 同一类信息可以有多份。行上重要性存储 0 到 99，没写存 0；运行时加 1，有效 1 到 100。 |
| 节点 | `Node` | 只做判断。一张卡片走进来，从一个出口出去。取数、缓存、画布不是节点。 |
| 条件节点 | `PredicateNode` | 对一个已经抽出的标量做一次比较。 |
| 模式节点 | `PatternNode` | 对一个字符串字段对一份词表。编译档有字面、全等集合、正则、重正则。 |
| 评分节点 | `ScoreNode` | 评分是节点。先得到一个数，再和阈值比较后分流。 |
| 匹配节点 | `MatchNode` | 旧线性代码的并集类型。新生成用条件节点或模式节点；读到旧节点仍能走。 |
| 链路 | `Pipeline` | 一条判定线。 |
| 阶段 | `Stage` | 边只能连到更后的阶段，用来保证无环。 |

三个出口是下一节点、弃用、允许。直接输入是 cleaner 已经从页面抽出的字段。间接输入靠 BV 或用户 mid 再取；没有标识的范畴，间接输入先空着。视频上已定为直接输入的包括标题、UP 名、BV、时长，以及部分页面上的播放量、发布距今、已关注、竖屏、投币数、点赞数。点赞、收藏、投币、标签、分区、简介等接口字段定为间接。BV 只做整串点名。本地可以还原整数 `aid`。BV 的字符形态读不出标题、UP、分区或内容好坏。cleaner 自己算的质量分不用。黑白名单、阈值和正则是拿到数据之后的处理。

存储键：`misakaclean.features.v1` 只存值为 true 的净化开关；`misakaclean.shell.v1` 存快捷按钮显示、拖动和坐标；`misakaclean.filter.v1` 是过滤 store version 2；`misakaclean.sync.v1` 与 `misakaclean.plugins.v1` 已占名。快捷按钮拖动默认关闭。

---

## 5. 已经点名、代码还没做完的空位

下列每条一行。来源是根 HANDOFF、产品 HANDOFF，以及前身 `analysis/unfinished-named-work.md`（盘点日期 2026-08-18）的标题级摘要。

1. 按业态拆链路预设：已有 `preset-video-civic`、`preset-video-hustle`、`preset-video-review` 三条可选链路；分区自动进线、游戏线、绿灯线还没有。
2. 规则树静态页 / 厚编辑器：`editor/` 已有阶段列、试走和导入导出；拖拽重连、防环编辑、GitHub Pages 托管还没有。
3. WebDAV 真连接：同步面板只有预留文案，存储键 `misakaclean.sync.v1` 尚未写入。
4. 间接字段按需取：类型里有 `likes` 和 `favRate`，抽取路径没有接站点接口，缺数就不救。
5. 评论 / 动态 / 专栏扫描：面板能打开这一栏，扫描未接卡片，四套 `kinds` 现在只跑视频。
6. 插件包：`registerPlugin()` 已在 `src/core/registry.ts`，存储键 `misakaclean.plugins.v1` 已占名尚未写入。
7. 差量从编辑页交到脚本：文件导入已有雏形，差量能带上 `pipelineId`，WebDAV 通道未接。
8. 规则正文离站存放：词表仍住在脚本的 `misakaclean.filter.v1`，母路径上的共享基底还没有。

同一批文档还点过净化开关的真页点验，以及目录类型里的 `number`、`list`、`string` 尚未被应用路径认真处理。应用路径目前只认真处理 `kind === 'switch'`。这两条写在产品 HANDOFF 的风险和壳状态表里，上列 8 条已满，细节回前身原文。

---

## 6. 新仓明确不做的事

新仓 `C:\AIWorkspace\biliweb` 里，下列事项保持不做。

不要恢复 MisakaWeb。前身已把它标成抛弃，源码在 `_archive/misaka-web-abandoned-2026-08-13.7z`。该压缩包留在前身归档里。

不要新建原生 App 目录。前身把手机和平板写成后一阶段，并且优先改网页。没有新的人类决定之前，不铺原生客户端目录。

不要把 `private/` 和个人日用的 253 条标题规则带进新仓。根 HANDOFF 写明日用 cleaner 的 253 条标题规则没有打进产品，正文只在本机 `private/`，并且用那 253 条去套课文、搞钱、影评三条样例时一条都没命中。`private/` 不进 git。

不要整份搬运上游。前身把 `refs/bilibili-cleaner`、`refs/bilibili_blocked_videos_by_tags`、`refs/Bilibili-Evolved`、`refs/wider-bilibili`、`refs/scriptcat` 放在本机，是为了拆开对照和接壳。产品侧只保留自己的适配层和自己的核心。

---

## 7. 新仓与前身的关系

新仓路径是 `C:\AIWorkspace\biliweb`。这里是全面重构的工作区，工作区根已经从 `C:\GrokProject\biliweb` 换成这一路径。前身 `C:\GrokProject\biliweb` 保留为历史树，继续放当时的源码、文档、归档和本机 `private/`。

后续正式任务先读本文件 `analysis/predecessor/misaka-clean-map.md`，确认版本、壳、过滤核心、预留槽和空位之后，再按需回前身读长文档。优先回读的长文档是 `docs/PURPOSE.md`、`docs/HANDOFF.md`、`products/misaka-clean/docs/HANDOFF.md`、`products/misaka-clean/docs/architecture.md`、`products/misaka-clean/docs/filter-engine-models.md`、`products/misaka-clean/docs/filter-fields.md`，以及 `analysis/unfinished-named-work.md`。
