# bilibili_blocked_videos_by_tags 上游解析

| 项 | 内容 |
| --- | --- |
| 文档标识 | bilibili-blocked-videos-by-tags |
| 上游 URL | https://github.com/tjxwork/bilibili_blocked_videos_by_tags.git |
| 默认分支 | main |
| HEAD | 33a7d07bb43f3f6f1abfe6c0a69db527ade051b6（33a7d07） |
| 日期 | 2025-11-30 18:03:14 +0800 |
| 对照的前身钉扎 | 33a7d07（2025-11-30，说明 Update README.md） |
| 解析日期 | 2026-10-07 |

本地克隆目录是 `C:\AIWorkspace\biliweb\refs\bilibili_blocked_videos_by_tags`。克隆完成后执行了 `git fetch --shallow-since=2025-11-01`，当前本地仓库是浅仓库。`origin/main` 与本地 `main` 一致，HEAD 说明为 `Update README.md`，提交正文为空。

## 1. 仓库是什么

这个仓库提供一份油猴用户脚本，在 Bilibili 页面上按标题、UP 主、标签等条件匹配视频卡片，再覆盖叠加层或隐藏卡片，并附带热搜处理和非视频元素隐藏。脚本头 `@name` 为「Bilibili 按标签、标题、时长、UP主屏蔽视频」，`@version` 为 1.5.0，`@namespace` 为 `https://github.com/tjxwork`。

作者在脚本头写为 `tjxwork`。README 顶部 HTML 注释的作者邮箱是 `tjxgame@outlook.com`，最后编辑者署名 `tjxgame`。菜单里的「作者」按钮打开 `https://space.bilibili.com/351422438`，「赞助」按钮打开 `https://afdian.com/a/tjxgame`。README 同时给出 Greasy Fork 页面「Bilibili 按标签、标题、时长，UP 主屏蔽视频」。

许可证以脚本头为准：`@license` 写的是 `CC-BY-NC-SA`。README 顶部 HTML 注释另有一行 `Copyright (c) 2025 by tjxwork, All Rights Reserved.`。仓库文件列表里没有单独的 `LICENSE` 文件。

## 2. 源码形态

仓库跟踪文件只有两份：`README.md` 和 `bilibili_blocked_videos_by_tags.user.js`。源码形态是单文件用户脚本加上说明文档，目录里没有包管理文件、构建配置或拆分模块。

主文件路径是 `bilibili_blocked_videos_by_tags.user.js`。按文件行数计为 3032 行，体积 130587 字节。README 更新说明里作者自己也写到脚本已经快 3000 行，合并功能后更难维护，并提到拆分重构做到一半就停了。

脚本匹配 `www`、`live`、`search`、`space`、`account`、`message`、`t`、`link` 这几个 `bilibili.com` 主机。真正扫视频卡片时，动漫、直播、账号、消息、动态、空间数字路径、历史和直播设置这些地址会提前返回。README 列出的生效页面包括首页、分区首页、播放页右侧推荐、搜索页、综合热门、每周必看、入站必刷、排行榜，以及部分旧版首页元素。

## 3. 判定读哪里

主流程函数在页面 `load`、窗口 `resize`，以及 `document.body` 的子树 `MutationObserver` 里反复执行。同窗口里用 `videoInfoDict` 以 BV 号做缓存，用 `videoUpInfoDict` 以 UID 做 UP 信息缓存。README「实现逻辑」写的顺序是先判黑后判白：标题、UP 主、充电专属、收藏投币比、竖屏、时长、播放量、点赞率、视频分区、UP 主等级、UP 主粉丝数、UP 主简介、标签、双重标签、精选评论、置顶评论，最后白名单。代码在点赞率之后还有投币率，菜单和功能列表里同样有这一项。

卡片范围来自页面 DOM。选择器覆盖 `div.bili-video-card`、`div.video-page-card-small`、`li.bili-rank-list-video__item`、`div.video-card`、`li.rank-item`、`div.video-card-reco`、`div.video-card-common`、`div.rank-wrap`。没有 `a` 的节点会被丢掉。旧版首页顶部推荐条不存在时，类名恰好为 `bili-video-card is-rcmd` 的节点也会被丢掉。

各条件的数据来源如下。

- 标题读卡片 DOM。函数从链接里取出 BV 号，标题取卡片里第一个带 `title` 且标签名不是 `span` 的 `title` 属性。正则开启时按正则测试，关闭时按整句相等比较。
- UP 名称和 UID 先读卡片 DOM，找指向 `space.bilibili.com/数字` 的链接，UID 取路径数字，名称取该链接里 `span` 的文本。同一缓存字段在 view 接口返回后会再写入 `owner.name` 和 `owner.mid`。名称在正则模式下走正则，UID 始终按字符串相等比较。白名单用同一套名称和 UID，做精确相等，命中后把该 BV 标成白名单并撤掉已经加上的隐藏或叠加层。
- 标签和双重标签读标签接口，卡片 DOM 不提供这组标签。接口是 `https://api.bilibili.com/x/web-interface/view/detail/tag?bvid=`，脚本取返回数组里的 `tag_name`。双重标签的规则按 `|` 分成两段，两段都命中该视频的标签数组才生效。菜单提示写明有些标签可能和分区重名。只有标签开关或双重标签开关打开，且对应数组非空时，才会发这个请求。
- 充电专属、收藏投币比、竖屏、时长、播放量、点赞率、投币率、分区都读视频 view 接口，地址是 `https://api.bilibili.com/x/web-interface/view?bvid=`。充电标记用 `data.is_upower_exclusive`。收藏投币比用 `stat.favorite / stat.coin`，并只处理播放数达到 5000、收藏数达到 50、发布时间早于当前 7200 秒的视频，默认阈值是 10。竖屏用 `dimension.width < dimension.height`。时长用 `duration`，单位秒，和设置值比较。播放量用 `stat.view`。点赞率是点赞数除以播放数再乘 100，保留两位小数。投币率是投币数除以播放数再乘 100。分区用 `data.tname`，支持正则或整句相等。
- 主流程对每张已经解析出 BV 号的卡片都会调用上述 view 接口，这次调用顺带写入 UP 名称、UID、AV 号、发布时间和分辨率。缓存里已经有 `videoDuration` 时跳过。同一个 BV 距离上次 view 请求不足 3 秒时也跳过。
- UP 等级、粉丝数、简介读 UP 卡片接口 `https://api.bilibili.com/x/web-interface/card?mid=`。等级取 `card.level_info.current_level`，粉丝取 `card.fans`，简介取 `card.sign`。等级和粉丝是「低于设置值则屏蔽」。简介支持正则或整句相等。这三项里至少有一项开关打开且阈值或词表有效时，才会发这个请求。同一 UID 已经有等级，并且距离 `updateTime` 小于 3600000 毫秒时，直接复用缓存。源码旁边的注释写成了 4 小时，比较式使用的是 3600000 毫秒。同一 BV 的 UP 接口同样有 3 秒间隔。
- 精选评论和置顶评论读评论接口 `https://api.bilibili.com/x/v2/reply`。查询参数里 `type` 为 1，`oid` 被赋成当前缓存键里的那个 BV 字符串，`sort` 为 0，`ps` 为 1，`pn` 为 1，`nohot` 为 0。精选标记读 `data.control.web_selection`。置顶评论读 `data.upper.top.content.message`，再按正则或整句相等去撞词表。这两项对应开关未打开时不请求。每个 BV 同样有 3 秒间隔，另外用 `setTimeout` 把相继请求错开，每次调用把延迟增加 100 毫秒，延迟超过「尚未拿到精选标记的 BV 数量 × 100 毫秒」后回到 0。
- 热搜读页面 DOM，不另发接口。整栏隐藏针对 `div.trending`。单条处理针对 `div.trending-item`，用元素的 `textContent` 去对关键字或已有标题屏蔽词，正则与精确模式沿用对应开关。菜单文案是「按已有的标题项屏蔽热搜项」，代码传入的数组是 `blockedTitle_Array`。
- 去掉非视频元素也只改 DOM。命中节点加上 `hideAD` 类，样式是 `display: none !important`。首页处理楼层单卡、指向 `cm.bilibili.com` 的推广或广告，以及指向直播的 feed 卡。搜索综合页处理课堂、广告和直播卡片，类加在父节点上。播放页处理 `div#slide_ad`、`.ad-report`、游戏小卡、特别小卡、运营小卡、直播小窗、活动块和广告小卡。

会打 B 站 API 的功能可以收成四条。view 接口在每张可识别视频卡片上都会打，充电、收藏投币比、竖屏、时长、播放、点赞率、投币率、分区都依赖它，UP 名称和 UID 也会被它补写。UP 卡片接口只服务等级、粉丝和简介。标签接口只服务标签和双重标签。评论接口只服务精选评论和置顶评论。标题、热搜、非视频元素隐藏可以在不依赖这些接口的情况下用 DOM 完成。UP 黑白名单在卡片链接已经给出 UID 时，也可以先用 DOM 做判断。

README 对频率和风控的原话可以摘要成下面几句。实现逻辑一节写：优先使用网页元素来获取信息，每个相同的 BV 号在 3 秒内最多查询 1 次，同窗口进程以 BV 号为键做临时缓存。v1.1.2 写：获取评论的 API 对请求频率非常敏感，频繁刷新或者开启新页面会导致 B 站拒绝请求，相关功能失效；脚本做了错开请求，正常浏览一般不会被拒绝，但无法保证这些功能始终可用。v1.3.1 写：按相关选项是否启用来决定是否调用相关 API，以减少触发风控的风险。脚本头 v1.2.0 另写：频繁大量加载新内容、刷新网页可能导致 B 站 API 拒绝请求，部分功能暂时失效，相当多功能依靠这些 API 才能工作。

## 4. 屏蔽动作

默认动作是叠加层。命中的视频卡片最前面插入 `div.blockedOverlay`，绝对定位，背景 `rgba(60, 60, 60, 0.85)`，居中白色文字，`backdrop-filter: blur(6px)`，圆角 6px，`z-index` 为 10。文字默认取第一条命中规则；「只显示类型」打开后，记录里只留类型名，不拼接具体命中词。后续扫描会把叠加层宽高改成父元素当前尺寸。菜单按钮可以按已有叠加层的 `display` 在 `flex` 和 `none` 之间切换，这次切换不写入持久设置。播放页里子节点类名是 `card-box` 的卡片，第一次会先加 `blur(5px)`，3 秒后再真正插入叠加层。

隐藏模式由 `hideVideoMode_Switch` 控制，默认关闭。打开后命中卡片设 `display: none`。搜索页同时隐藏父节点。卡片位于 `div.feed-card` 或 `div.bili-feed-card` 内时，连同该外层一起隐藏。热搜单条在同一开关下也是直接 `display: none`，关闭该开关时热搜单条走上面的叠加层。

去掉非视频元素是独立开关 `hideNonVideoElements_Switch`，默认开启。它不依赖视频是否命中屏蔽词，按第 3 节的选择器给广告、直播、课堂、番剧楼层和播放页侧栏推荐类节点加 `hideAD`。

## 5. 设置如何存

设置存在油猴存储里。启动时 `GM_getValue("GM_blockedParameter", 默认对象)` 读出，点「保存」后 `GM_setValue("GM_blockedParameter", blockedParameter)` 写回。键名是 `GM_blockedParameter`。代码里看不到 `localStorage` 读写。读到旧字段名 `blockedTitleArray` 时，`oldParameterAdaptation` 会把旧结构补成当前的开关加数组结构。保存后会立刻再跑一遍主流程。

导入和导出都有。导出把当前菜单里的设置做成格式化 JSON，下载文件名形如 `Bilibili_blocked_videos_by_tags_Config_` 加时间戳，扩展名 `.json`。导入打开本地 JSON 文件，解析后检查对象是否带有 `blockedTitle_Switch`、`blockedNameOrUid_Switch`、`blockedTag_Switch` 三者之一，通过后合并进菜单。导入完成时的提示是「设置已加载，请手动保存」，合并结果要再点保存才会写入 `GM_setValue`。「隐藏菜单中的屏蔽词」只改菜单上的显示文字，脚本注释写明它不影响实际屏蔽和导入导出。

## 6. 自 2025-11-30 以来的提交

HEAD 仍是前身钉扎的那一笔：`33a7d07`，完整哈希 `33a7d07bb43f3f6f1abfe6c0a69db527ade051b6`，日期 2025-11-30 18:03:14 +0800，说明 `Update README.md`。自这笔记起，`origin/main` 上没有更新的提交。

浅历史里能看到的上一笔是同日的 `329633c`，说明 `v1.5.0`。`git fetch --shallow-since=2025-11-01` 之后，本地日志只保留这个日期窗口内的提交，更早的历史不在这次浅仓库里。这个窗口的最新提交就是 `33a7d07`。

## 7. 外部 CDN

2026 年 9 月关于「GitHub 版因外部 CDN 间歇清空页面」的公开报道，不在本仓库的 README 或脚本正文里。下面只核对当前 HEAD 里能看见的引用。

主文件 `bilibili_blocked_videos_by_tags.user.js` 的用户脚本头仍有三条 `@require`，都是在脚本运行前由管理器加载的 Vue 3.2.31：

- `https://cdnjs.cloudflare.com/ajax/libs/vue/3.2.31/vue.global.min.js`
- `https://cdn.bootcdn.net/ajax/libs/vue/3.2.31/vue.global.prod.min.js`
- `https://cdn.jsdelivr.net/npm/vue@3.2.31/dist/vue.global.min.js`

菜单创建前执行 `unsafeWindow.Vue = Vue`，再用 `Vue.createApp` 挂到 `#blockedMenuUi`。脚本头 `@icon` 指向 `https://www.bilibili.com/favicon.ico`。README 的效果图用了 `s21.ax1x.com` 和 `imgse.com` 的图片地址，那是文档图片，不是脚本运行时的脚本依赖。

README 与脚本头的 v1.4.5 说明写的是：修复字节跳动 Vue CDN 失效所导致的功能界面不正常。当前这份文件的 `@require` 列表里没有字节跳动域名。这三条外部 Vue 地址是否就是 2026 年 9 月报道里导致页面被间歇清空的那一处，仓库本身没有记载，这里保持不确定。可以确定的是，这份 GitHub 版在 `33a7d07` 上仍然依赖外部 CDN 来提供 Vue。

## 8. 对 biliweb 的用法

这份仓库适合当作内容判定的点子来源。后续可以从这里抽取字段和判定思路：卡片上能直接读到的标题、UP 名称、UID；需要视频详情才有的时长、播放、点赞、投币、收藏、收藏投币比、分辨率方向、充电标记、分区名；需要用户卡片才有的等级、粉丝、简介；需要标签接口才有的单标签和成对标签；需要评论接口才有的精选标记和置顶评论正文；以及热搜词、非视频楼层这类页面结构过滤。判定顺序、白名单兜底、新视频在收藏投币比上的播放量、收藏数和时间门槛、评论接口的频率约束，都可以单独吸收。

整份脚本不搬进产品。它是 3032 行、130587 字节的单文件，菜单、DOM 补丁、油猴存储、外部 Vue 和 B 站页面选择器绑在一起。biliweb 若要落地，只保留字段含义和判定规则，页面操作和接口节奏按自己的架构重写。
