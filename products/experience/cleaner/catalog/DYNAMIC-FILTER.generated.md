# 动态过滤实现链

逐段核对固定源码；实际网页和布局未做浏览器实测。

四步：找到动态 → 获取信息 → 独立判断留下或不留下 → 整理页面。源码位置使用仓库相对路径。

判断契约、页面分派、两种隐藏/恢复模式、绘制、自然排布与补载缺口，统一见[过滤共用登记](FILTER-COMMON.generated.md)。

## 此类过滤的共用能力（不含判断策略）

- **动态列表渲染门槛**｜找到卡片（有源码实现）：动态页与空间动态共用做法：先找 .bili-dyn-list__item，增量时跳过已检查项，筛选前要求已有正文或头部节点。顶栏不走这套门槛。
  - 源码：`src/modules/filters/variety/dynamic/pages/dynamic.ts:182`、`src/modules/filters/variety/dynamic/pages/space.ts:147`
- **动态正文片段与类型标记**｜获取信息（有源码实现）：动态页与空间动态从 DOM 拼接标题、富文本与摘要片段，排除 @ 片段；标题和时长来自内嵌视频卡。类型判断读 .bili-dyn-time 的文字，无主动 API。
  - 源码：`src/modules/filters/variety/dynamic/pages/dynamic.ts:65`、`src/modules/filters/variety/dynamic/pages/space.ts:58`、`src/utils/tool.ts:23`

## 可替换的判断策略

通用匹配和黑白名单组合见[过滤共用登记](FILTER-COMMON.generated.md)；它属于现行策略。

- **现行动态条件与名单**（当前策略，仍与页面耦合）：发布人精确匹配、视频时长、标题/正文关键词、动态视频/直播回放类型按场景选择。标题/正文白名单可救回普通命中，未传强制名单。标题、正文、时长数据键可跨页面或与其他过滤链共享，启用开关并非全部共享。顶栏只在入口读取动态页的五组开关和参数，未独立注册控件，也未监听其后变化。
  - 源码：`src/modules/filters/variety/dynamic/pages/dynamic.ts:24`、`src/modules/filters/variety/dynamic/pages/space.ts:22`、`src/modules/filters/variety/dynamic/pages/header.ts:154`、`src/modules/filters/variety/dynamic/subFilters/black.ts:6`、`src/modules/filters/variety/dynamic/subFilters/white.ts:3`

## 动态页（dynamic）

- **找到动态**（有源码实现）：等待 .bili-dyn-home--member，初次全量，监听子树后增量。列表是否存在 .bili-dyn-list-tabs 影响发布人提取。
  - 源码：`src/modules/filters/index.ts:107`、`src/modules/filters/variety/dynamic/pages/dynamic.ts:221`、`src/modules/filters/variety/dynamic/pages/dynamic.ts:151`、`src/modules/filters/variety/dynamic/pages/dynamic.ts:148`
  - 注册条件：`isPageDynamic`。
- **获取信息**（有源码实现）：读 DOM。发布人仅在判为全部动态时取头部文字；时长支持封面时间和备用时长类名。
  - 源码：`src/modules/filters/variety/dynamic/pages/dynamic.ts:65`
  - uploader：对象 DOM，`.bili-dyn-title__text`。全部动态条件下读取 .bili-dyn-title__text`src/modules/filters/variety/dynamic/pages/dynamic.ts:66`
  - duration：对象 DOM，`.bili-dyn-card-video__cover-shadow .duration-time, .bili-dyn-card-video__duration`。视频封面时长或 .bili-dyn-card-video__duration`src/modules/filters/variety/dynamic/pages/dynamic.ts:72`
  - title：对象 DOM，`.bili-dyn-card-video__title`。嵌入视频标题`src/modules/filters/variety/dynamic/pages/dynamic.ts:78`
  - content：对象 DOM，`.bili-dyn-content :is( .dyn-card-opus__title, .bili-rich-text__content > span:not(.bili-rich-text-module.at), .dyn-card-opus__summary span )`。正文、标题、摘要片段拼接`src/modules/filters/variety/dynamic/pages/dynamic.ts:81`
  - dynVideo：对象 DOM，`.bili-dyn-time`。时间栏含动态视频`src/modules/filters/variety/dynamic/pages/dynamic.ts:95`
  - playback：对象 DOM，`.bili-dyn-time`。时间栏含直播回放`src/modules/filters/variety/dynamic/pages/dynamic.ts:98`
- **独立判断留下或不留下**（有源码实现）：发布人、时长、标题、正文、动态视频及直播回放过滤；标题和正文白名单。右键发布人可把昵称写入动态黑名单并重查。
  - 源码：`src/modules/filters/variety/dynamic/pages/dynamic.ts:197`、`src/modules/filters/variety/dynamic/pages/dynamic.ts:485`
  - 当前策略／普通黑名单：uploader → dynUploaderFilter；`dyn-uploader-filter-status`、`dyn-uploader-filter-value`。`src/modules/filters/variety/dynamic/pages/dynamic.ts:186`
  - 当前策略／普通黑名单：duration → dynDurationFilter；`dyn-duration-filter-status`、`global-duration-filter-value`。`src/modules/filters/variety/dynamic/pages/dynamic.ts:187`
  - 当前策略／普通黑名单：title → dynVideoTitleFilter；`dyn-title-keyword-filter-status`、`global-title-keyword-filter-value`。`src/modules/filters/variety/dynamic/pages/dynamic.ts:188`
  - 当前策略／普通黑名单：content → dynContentFilter；`dyn-content-keyword-filter-status`、`global-content-keyword-filter-value`。`src/modules/filters/variety/dynamic/pages/dynamic.ts:189`
  - 当前策略／普通黑名单：dynVideo → dynDynVideoFilter；`dyn-dyn-video-filter-status`。`src/modules/filters/variety/dynamic/pages/dynamic.ts:190`
  - 当前策略／普通黑名单：playback → dynPlaybackFilter；`dyn-playback-filter-status`。`src/modules/filters/variety/dynamic/pages/dynamic.ts:191`
  - 当前策略／白名单：title → dynVideoTitleWhiteFilter；`dyn-video-title-white-filter-status`、`global-title-keyword-whitelist-filter-value`。`src/modules/filters/variety/dynamic/pages/dynamic.ts:193`
  - 当前策略／白名单：content → dynContentWhiteFilter；`dyn-content-white-filter-status`、`global-content-keyword-whitelist-filter-value`。`src/modules/filters/variety/dynamic/pages/dynamic.ts:194`
- **整理页面**（依赖站点自然排布）：隐藏整项动态；无阻拦条件时恢复。布局和新内容加载仍由站点控制。
  - 源码：`src/modules/filters/variety/dynamic/pages/dynamic.ts:160`
  - 未实现：动态详情主动取数、过滤后补洞或按数量补载。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：属性模式、站点自然排布、按可见数量补载、动态列表渲染门槛、动态正文片段与类型标记。

## 个人空间动态（space）

- **找到动态**（有源码实现）：等待 #app；实际检查只在空间 /数字/dynamic 路径。首次全量，子树变化后增量。
  - 源码：`src/modules/filters/index.ts:113`、`src/modules/filters/variety/dynamic/pages/space.ts:199`、`src/modules/filters/variety/dynamic/pages/space.ts:133`、`src/modules/filters/variety/dynamic/pages/space.ts:117`
  - 注册条件：`isPageSpace`。
- **获取信息**（有源码实现）：与动态页共用正文提取方式；时长只读封面上的 duration-time，不取发布人。
  - 源码：`src/modules/filters/variety/dynamic/pages/space.ts:58`
  - duration：对象 DOM，`.bili-dyn-card-video__cover-shadow .duration-time`。封面 duration-time`src/modules/filters/variety/dynamic/pages/space.ts:59`
  - title：对象 DOM，`.bili-dyn-card-video__title`。嵌入视频标题`src/modules/filters/variety/dynamic/pages/space.ts:63`
  - content：对象 DOM，`.bili-dyn-content :is( .dyn-card-opus__title, .bili-rich-text__content > span:not(.bili-rich-text-module.at), .dyn-card-opus__summary span )`。正文、标题、摘要片段拼接`src/modules/filters/variety/dynamic/pages/space.ts:66`
  - dynVideo：对象 DOM，`.bili-dyn-time`。时间栏含动态视频`src/modules/filters/variety/dynamic/pages/space.ts:80`
  - playback：对象 DOM，`.bili-dyn-time`。时间栏含直播回放`src/modules/filters/variety/dynamic/pages/space.ts:83`
- **独立判断留下或不留下**（有源码实现）：空间专用开关控制时长、标题、正文和类型规则，共用相关参数与名单；没有发布人规则。
  - 源码：`src/modules/filters/variety/dynamic/pages/space.ts:177`
  - 当前策略／普通黑名单：duration → dynDurationFilter；`global-duration-filter-value`、`space-dyn-duration-filter-status`。`src/modules/filters/variety/dynamic/pages/space.ts:166`
  - 当前策略／普通黑名单：title → dynVideoTitleFilter；`global-title-keyword-filter-value`、`space-dyn-title-keyword-filter-status`。`src/modules/filters/variety/dynamic/pages/space.ts:167`
  - 当前策略／普通黑名单：content → dynContentFilter；`global-content-keyword-filter-value`、`space-dyn-content-keyword-filter-status`。`src/modules/filters/variety/dynamic/pages/space.ts:168`
  - 当前策略／普通黑名单：dynVideo → dynDynVideoFilter；`space-dyn-video-filter-status`。`src/modules/filters/variety/dynamic/pages/space.ts:169`
  - 当前策略／普通黑名单：playback → dynPlaybackFilter；`space-playback-filter-status`。`src/modules/filters/variety/dynamic/pages/space.ts:170`
  - 当前策略／白名单：title → dynVideoTitleWhiteFilter；`global-title-keyword-whitelist-filter-value`、`space-dyn-video-title-white-filter-status`。`src/modules/filters/variety/dynamic/pages/space.ts:173`
  - 当前策略／白名单：content → dynContentWhiteFilter；`global-content-keyword-whitelist-filter-value`、`space-dyn-content-white-filter-status`。`src/modules/filters/variety/dynamic/pages/space.ts:174`
- **整理页面**（依赖站点自然排布）：隐藏或恢复动态列表项，自然排布；不改个人空间的分页或列表数量。
  - 源码：`src/modules/filters/variety/dynamic/pages/space.ts:142`
  - 未实现：发布人字段与规则、动态详情主动取数、过滤后补洞或补载。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：属性模式、站点自然排布、按可见数量补载、动态列表渲染门槛、动态正文片段与类型标记。

## 顶栏动态弹窗（header）

- **找到动态**（有源码实现）：非直播页注册。每秒轮询 .right-entry，计数超限即停；找到后全量扫描 #biliHeaderDynScrollCon .dynamic-all > a，子树变化后仍全量。
  - 源码：`src/modules/filters/index.ts:119`、`src/modules/filters/variety/dynamic/pages/header.ts:133`、`src/modules/filters/variety/dynamic/pages/header.ts:79`
  - 注册条件：`() => !isPageLive()`。
- **获取信息**（有源码实现）：从弹窗 DOM 读昵称和标题。content 实际取带 .article-tag 的标题并去掉“专栏”文字，不能等同于完整动态正文。
  - 源码：`src/modules/filters/variety/dynamic/pages/header.ts:39`
  - uploader：对象 DOM，`.user-name`。.user-name`src/modules/filters/variety/dynamic/pages/header.ts:40`
  - title：对象 DOM，`.all-in-one-article-title:not(:has(.article-tag))`。不含专栏标签的 .all-in-one-article-title`src/modules/filters/variety/dynamic/pages/header.ts:43`
  - content：对象 DOM，`.all-in-one-article-title:has(.article-tag)`。带专栏标签的标题去掉“专栏”，无全文`src/modules/filters/variety/dynamic/pages/header.ts:46`
- **独立判断留下或不留下**（有源码实现）：借用动态页发布人、标题、正文规则和标题/正文白名单的键；入口读取保存值决定启用，不使用动态页 Item 默认值，也没有独立开关或热更新入口。
  - 源码：`src/modules/filters/variety/dynamic/pages/header.ts:154`、`src/modules/filters/variety/dynamic/pages/header.ts:112`
  - 当前策略／普通黑名单：uploader → dynUploaderFilter；`dyn-uploader-filter-status`、`dyn-uploader-filter-value`。`src/modules/filters/variety/dynamic/pages/header.ts:103`
  - 当前策略／普通黑名单：title → dynVideoTitleFilter；`dyn-title-keyword-filter-status`、`global-title-keyword-filter-value`。`src/modules/filters/variety/dynamic/pages/header.ts:104`
  - 当前策略／普通黑名单：content → dynContentFilter；`dyn-content-keyword-filter-status`、`global-content-keyword-filter-value`。`src/modules/filters/variety/dynamic/pages/header.ts:105`
  - 当前策略／白名单：title → dynVideoTitleWhiteFilter；`dyn-video-title-white-filter-status`、`global-title-keyword-whitelist-filter-value`。`src/modules/filters/variety/dynamic/pages/header.ts:108`
  - 当前策略／白名单：content → dynContentWhiteFilter；`dyn-content-white-filter-status`、`global-content-keyword-whitelist-filter-value`。`src/modules/filters/variety/dynamic/pages/header.ts:109`
- **整理页面**（依赖站点自然排布）：对弹窗的条目链接用行内 display 隐藏或恢复；未更新红点、条目计数，也不补载。
  - 源码：`src/modules/filters/variety/dynamic/pages/header.ts:112`
  - 未实现：顶栏独立设置、完整正文和主动取数、按可见数量补载。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：行内样式模式、站点自然排布、按可见数量补载。

## 此前本地候选与剩余问题

- **入口和现场覆盖**（待核对或后续处理）：顶栏没有运行中的规则刷新；各列表选择器、动态页容器的类名匹配及自然收拢仍待实测。本轮只记录。

## 对应的上游文件

链接是固定基线的文件对应，不能凭文件关系判定每行作者。本地差异和未核实来源分别保留。

对照净化大师 15d9bce：动态、空间、顶栏三个页面文件仅改存储导入，动态子过滤器一致。

- `src/modules/filters/index.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/index.ts)，存在本地差异。
- `src/modules/filters/variety/dynamic/pages/dynamic.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/dynamic/pages/dynamic.ts)，存在本地差异。
- `src/modules/filters/variety/dynamic/pages/header.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/dynamic/pages/header.ts)，存在本地差异。
- `src/modules/filters/variety/dynamic/pages/space.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/dynamic/pages/space.ts)，存在本地差异。
- `src/modules/filters/variety/dynamic/subFilters/black.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/dynamic/subFilters/black.ts)，与基线一致。
- `src/modules/filters/variety/dynamic/subFilters/white.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/dynamic/subFilters/white.ts)，与基线一致。
- `src/utils/tool.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/utils/tool.ts)，与基线一致。
