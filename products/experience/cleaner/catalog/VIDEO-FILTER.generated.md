# 视频过滤实现链

逐页核对源码；站点实时选择器与布局未做浏览器实测。

四步：找到卡片 → 获取信息 → 独立判断留下或不留下 → 整理页面。源码位置使用仓库相对路径。

判断契约、页面分派、两种隐藏/恢复模式、绘制、自然排布与补载缺口，统一见[过滤共用登记](FILTER-COMMON.generated.md)。

## 此类过滤的共用能力（不含判断策略）

- **卡片字段转换**｜获取信息（有源码实现）：共用工具提供 BV 解析、时长和日期转换。每页调用哪些转换以字段旁的 helpers 为准。
  - 源码：`src/utils/tool.ts:8`、`src/utils/tool.ts:23`、`src/utils/tool.ts:41`
- **搜索结果的标签与相关度输入**｜获取信息（实验功能）：仅启用旧相关度时使用；脚本不为此另发搜索请求。按 BV 依次查站点响应缓存、Pinia 首屏数据、卡片 Vue 信息。响应或首屏的 tag 拆为标签用于相关度；卡片回退没有标签，不能据此认定视频无标签。关闭会停止解析响应并清空缓存。
  - 源码：`src/modules/filters/variety/video/pages/search.ts:77`、`src/modules/filters/variety/video/pages/search.ts:99`、`src/modules/filters/variety/video/pages/search.ts:137`、`src/modules/filters/variety/video/pages/search.ts:152`、`src/utils/fetch.ts:43`
  - 站点 /search/type（search_type=video）→ data.result[]：bvid、title、description、author、tag、hit_columns。
  - Pinia 首屏 result 中 result_type=video 的 data[]：bvid、title、description、author、tag、hit_columns。
  - 卡片 Vue props.info：title、description、author.name；缺少 tag、hit_columns 原始值。
- **按需补取视频统计**｜获取信息（有源码实现）：六个视频模块均有该可选取数入口。当前策略在普通规则初筛后，只给仍需判断且有 BV 的卡片取数。按 BV 缓存与合并在途请求，本地计算点赞率、收藏率。取数失败不以此隐藏，可在后续扫描重试。
  - 源码：`src/modules/filters/variety/video/statGate.ts:70`、`src/modules/filters/variety/video/viewStat.ts:12`、`src/modules/filters/variety/video/viewStat.ts:93`、`src/modules/filters/variety/video/viewStat.ts:120`、`src/modules/filters/variety/video/statRate.ts:2`
  - B站 /x/web-interface/view → data.stat：view、like、favorite；缺少 本地封装未返回标签、简介或评论数。
- **跨页面主动获取标签**｜获取信息（未实现）：当前未实现通用标签取数或标签过滤。搜索页的已有 tag 仅供现行相关度，不能替代其它页面的标签来源。独立标签脚本仅为研究参考。
- **首页专用占位修正**｜整理页面（独立可选）：隐藏活动轮播时有独立的卡片占位样式；扩大加载量会隐藏额外骨架，预加载也有骨架与锚点样式。这些受各自选项控制，不是视频过滤后对所有卡片执行的收尾。
  - 源码：`src/modules/rules/homepage/groups/basic.scss:58`、`src/modules/rules/homepage/groups/rcmd.scss:216`、`src/modules/rules/homepage/groups/rcmd.scss:224`
- **首页独立加载选项**｜整理页面（独立可选）：增加载入数量改写推荐请求的批量参数；预加载按滚动位置调整加载锚点。两者均不统计过滤后可见卡片，也没有按隐藏数量主动补载。
  - 源码：`src/modules/rules/homepage/groups/rcmd.ts:94`、`src/modules/rules/homepage/groups/rcmd.ts:116`
- **播放页相关视频数据过滤**｜整理页面（实验功能）：独立开关启用后，使用本轮命中卡片的BV号过滤站点 __INITIAL_STATE__.related。它只删缓存项，不补载；已删缓存项没有本地回填，切换规则需要刷新恢复。
  - 源码：`src/modules/filters/variety/video/pages/video.ts:186`、`src/modules/filters/variety/video/pages/video.ts:421`

## 可替换的判断策略

通用匹配和黑白名单组合见[过滤共用登记](FILTER-COMMON.generated.md)；它属于现行策略。

- **现行黑白名单与条件阈值**（有源码实现）：这是当前可替换策略。普通黑名单命中可被白名单救回，BV强制黑名单覆盖白名单；另有时长、发布日期、旧质量、相关度和可选统计阈值。当前实现先做页面字段判断，再按需补统计后完成取舍。
  - 源码：`src/modules/filters/variety/video/subFilters/black.ts:7`、`src/modules/filters/variety/video/subFilters/white.ts:7`、`src/modules/filters/decision/compatibility.ts:33`、`src/utils/tool.ts:115`、`src/utils/tool.ts:357`
- **独立评分策略**（未实现）：未实现。今后可使用相同卡片信息替换或组合判断策略，仍只向页面交付留下或不留下；旧搜索相关度和热门质量指标只是现行策略内部指标。

## 首页（homepage）

- **找到卡片**（有源码实现）：等待 .container，检查其直接子卡片；子节点变化后扫描未标记卡片。当前依赖站点首个匹配容器，是否仍命中推荐列表须实测。
  - 源码：`src/modules/filters/index.ts:51`、`src/modules/filters/variety/video/pages/homepage.ts:244`、`src/modules/filters/variety/video/pages/homepage.ts:166`、`src/modules/filters/variety/video/pages/homepage.ts:167`
  - 注册条件：`isPageHomepage`。
  - `:scope > :is(.feed-card, .bili-video-card.is-rcmd, .bili-feed-card)`。`src/modules/filters/variety/video/pages/homepage.ts:166`
- **获取信息**（有源码实现）：标题、作者、时间和播放量读自DOM文本；BV号取标题链接或封面链接；已关注取卡片图标文字。
  - 源码：`src/modules/filters/variety/video/pages/homepage.ts:73`
  - duration：对象 DOM，`.bili-video-card__stats__duration`；convertTimeToSec。`src/modules/filters/variety/video/pages/homepage.ts:74`
  - views：对象 DOM，`.bili-video-card__stats--text`。`src/modules/filters/variety/video/pages/homepage.ts:78`
  - title：对象 DOM，`.bili-video-card__info--tit a`。`src/modules/filters/variety/video/pages/homepage.ts:90`
  - pubdate：对象 DOM，`.bili-video-card__info--date`；convertDateToDays。`src/modules/filters/variety/video/pages/homepage.ts:93`
  - bvid：对象 DOM，`.bili-video-card__info--tit a` 或 `.bili-video-card__image--link`，取 href；matchBvid。`src/modules/filters/variety/video/pages/homepage.ts:97`
  - uploader：对象 DOM，`.bili-video-card__info--author`。`src/modules/filters/variety/video/pages/homepage.ts:103`
  - isFollow：对象 DOM，`.bili-video-card__info--icon-text`。`src/modules/filters/variety/video/pages/homepage.ts:106`
- **独立判断留下或不留下**（有源码实现）：此页绑定字段和当前规则，交给独立判断入口。
  - 源码：`src/modules/filters/variety/video/pages/homepage.ts:198`
  - 当前策略／普通黑名单：duration → videoDurationFilter；`global-duration-filter-value`、`homepage-duration-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:198`
  - 当前策略／普通黑名单：views → videoViewsFilter；`global-views-filter-value`、`homepage-views-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:199`
  - 当前策略／普通黑名单：title → videoTitleFilter；`global-title-keyword-filter-value`、`homepage-title-keyword-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:200`
  - 当前策略／普通黑名单：pubdate → videoPubdateFilter；`global-pubdate-filter-value`、`homepage-pubdate-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:201`
  - 当前策略／普通黑名单：uploader → videoUploaderFilter；`global-uploader-filter-value`、`homepage-uploader-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:202`
  - 当前策略／普通黑名单：uploader → videoUploaderKeywordFilter；`global-uploader-keyword-filter-value`、`homepage-uploader-keyword-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:204`
  - 当前策略／白名单：uploader → videoUploaderWhiteFilter；`global-uploader-whitelist-filter-value`、`homepage-uploader-whitelist-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:207`
  - 当前策略／白名单：title → videoTitleWhiteFilter；`global-title-keyword-whitelist-filter-value`、`homepage-title-keyword-whitelist-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:208`
  - 当前策略／白名单：isFollow → videoIsFollowWhiteFilter；`homepage-following-whitelist-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:209`
  - 当前策略／强制黑名单：bvid → videoBvidFilter；`global-bvid-filter-value`、`homepage-bvid-filter-status`。`src/modules/filters/variety/video/pages/homepage.ts:212`
- **整理页面**（依赖站点自然排布）：过滤后的卡片由浏览器按站点布局收拢，未发现通用重排。另有可选轮播/骨架修正。
  - 源码：`src/modules/filters/variety/video/pages/homepage.ts:175`
  - 补载（未实现）：新增卡片依赖站点加载；可选加载调节并非按过滤后的可见数补位。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：属性模式、站点自然排布、按可见数量补载、卡片字段转换、按需补取视频统计、跨页面主动获取标签、首页专用占位修正、首页独立加载选项。

## 新版分区页（channel）

- **找到卡片**（有源码实现）：等待 #app，扫描后代 .feed-card；监听子树，增量时排除已有检查标记的卡片。
  - 源码：`src/modules/filters/index.ts:69`、`src/modules/filters/variety/video/pages/channel.ts:229`、`src/modules/filters/variety/video/pages/channel.ts:155`、`src/modules/filters/variety/video/pages/channel.ts:156`
  - 注册条件：`isPageChannel`。
  - `.feed-card`。`src/modules/filters/variety/video/pages/channel.ts:155`
- **获取信息**（有源码实现）：标题和BV链接取卡片标题/封面，时长取封面统计，作者和发布时间从卡片同一文本按分隔符拆开。
  - 源码：`src/modules/filters/variety/video/pages/channel.ts:65`
  - duration：对象 DOM，`.bili-cover-card__stats .bili-cover-card__stat:last-child span`；convertTimeToSec。`src/modules/filters/variety/video/pages/channel.ts:66`
  - title：对象 DOM，`.bili-video-card__title a`。`src/modules/filters/variety/video/pages/channel.ts:72`
  - pubdate：对象 DOM，`.bili-video-card__author .bili-video-card__text:nth-child(2)`；convertDateToDays。`src/modules/filters/variety/video/pages/channel.ts:75`
  - bvid：对象 DOM，`.bili-video-card__title a` 或 `.bili-cover-card`，取 href；matchBvid。`src/modules/filters/variety/video/pages/channel.ts:87`
  - uploader：对象 DOM，`.bili-video-card__author .bili-video-card__text:nth-child(2)`。`src/modules/filters/variety/video/pages/channel.ts:93`
- **独立判断留下或不留下**（有源码实现）：此页绑定字段和当前规则，交给独立判断入口。
  - 源码：`src/modules/filters/variety/video/pages/channel.ts:185`
  - 当前策略／普通黑名单：duration → videoDurationFilter；`channel-duration-filter-status`、`global-duration-filter-value`。`src/modules/filters/variety/video/pages/channel.ts:185`
  - 当前策略／普通黑名单：title → videoTitleFilter；`channel-title-keyword-filter-status`、`global-title-keyword-filter-value`。`src/modules/filters/variety/video/pages/channel.ts:186`
  - 当前策略／普通黑名单：pubdate → videoPubdateFilter；`channel-pubdate-filter-status`、`global-pubdate-filter-value`。`src/modules/filters/variety/video/pages/channel.ts:187`
  - 当前策略／普通黑名单：uploader → videoUploaderFilter；`channel-uploader-filter-status`、`global-uploader-filter-value`。`src/modules/filters/variety/video/pages/channel.ts:188`
  - 当前策略／普通黑名单：uploader → videoUploaderKeywordFilter；`channel-uploader-keyword-filter-status`、`global-uploader-keyword-filter-value`。`src/modules/filters/variety/video/pages/channel.ts:190`
  - 当前策略／白名单：uploader → videoUploaderWhiteFilter；`channel-uploader-whitelist-filter-status`、`global-uploader-whitelist-filter-value`。`src/modules/filters/variety/video/pages/channel.ts:193`
  - 当前策略／白名单：title → videoTitleWhiteFilter；`channel-title-keyword-whitelist-filter-status`、`global-title-keyword-whitelist-filter-value`。`src/modules/filters/variety/video/pages/channel.ts:194`
  - 当前策略／强制黑名单：bvid → videoBvidFilter；`channel-bvid-filter-status`、`global-bvid-filter-value`。`src/modules/filters/variety/video/pages/channel.ts:197`
- **整理页面**（依赖站点自然排布）：当前过滤调用链只隐藏卡片，依赖站点自然排布；没有过滤专用补洞。
  - 源码：`src/modules/filters/variety/video/pages/channel.ts:164`
  - 补载（未实现）：监听站点后续加载的卡片，未实现按可见数补载。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：属性模式、站点自然排布、按可见数量补载、卡片字段转换、按需补取视频统计、跨页面主动获取标签。

## 热门、每周必看及排行榜（popular）

- **找到卡片**（有源码实现）：等待 #app，匹配热门/必看列表的 .video-card 和非番剧排行榜的 .rank-item；子树变化后始终全量检查。
  - 源码：`src/modules/filters/index.ts:63`、`src/modules/filters/variety/video/pages/popular.ts:235`、`src/modules/filters/variety/video/pages/popular.ts:162`
  - 注册条件：`isPagePopular`。
  - `.card-list .video-card, .video-list .video-card, .rank-list:not(.pgc-list) .rank-item`。`src/modules/filters/variety/video/pages/popular.ts:162`
- **获取信息**（有源码实现）：普通卡片读取 __vue__.videoData；排行榜按 data-rank 读取列表 Vue 数据。可得到标题、BV号、作者、时长、尺寸及投币和点赞统计。画面方向由尺寸推导，旧质量分数归到判断策略。
  - 源码：`src/modules/filters/variety/video/pages/popular.ts:82`、`src/modules/filters/variety/video/pages/popular.ts:69`
  - title：站点 Vue 数据；getVideoData。`src/modules/filters/variety/video/pages/popular.ts:83`
  - bvid：站点 Vue 数据；getVideoData。`src/modules/filters/variety/video/pages/popular.ts:86`
  - uploader：站点 Vue 数据；getVideoData。`src/modules/filters/variety/video/pages/popular.ts:89`
  - duration：站点 Vue 数据；getVideoData。`src/modules/filters/variety/video/pages/popular.ts:92`
  - dimension：站点 Vue 数据；getVideoData。`src/modules/filters/variety/video/pages/popular.ts:103`
  - coin：站点 Vue 数据。站点 videoData.stat.coin；供当前旧质量策略。`src/modules/filters/variety/video/pages/popular.ts:96`
  - like：站点 Vue 数据。站点 videoData.stat.like；供当前旧质量策略，与主动API来源分开。`src/modules/filters/variety/video/pages/popular.ts:96`
  - dimension.height / dimension.width：站点 Vue 数据。尺寸用来推导横屏或竖屏。`src/modules/filters/variety/video/pages/popular.ts:104`
- **独立判断留下或不留下**（有源码实现）：此页绑定字段和当前规则，交给独立判断入口。
  - 源码：`src/modules/filters/variety/video/pages/popular.ts:189`
  - 当前策略指标 quality：旧投币/点赞拟合指标。点赞数为0时未知。 输入：站点 Vue 数据 stat.coin、站点 Vue 数据 stat.like。`src/modules/filters/variety/video/pages/popular.ts:95`
  - 当前策略／普通黑名单：duration → videoDurationFilter；`global-duration-filter-value`、`popular-duration-filter-status`。`src/modules/filters/variety/video/pages/popular.ts:189`
  - 当前策略／普通黑名单：title → videoTitleFilter；`global-title-keyword-filter-value`、`popular-title-keyword-filter-status`。`src/modules/filters/variety/video/pages/popular.ts:190`
  - 当前策略／普通黑名单：uploader → videoUploaderFilter；`global-uploader-filter-value`、`popular-uploader-filter-status`。`src/modules/filters/variety/video/pages/popular.ts:191`
  - 当前策略／普通黑名单：uploader → videoUploaderKeywordFilter；`global-uploader-keyword-filter-value`、`popular-uploader-keyword-filter-status`。`src/modules/filters/variety/video/pages/popular.ts:193`
  - 当前策略／普通黑名单：dimension → videoDimensionFilter；`popular-dimension-filter-status`。`src/modules/filters/variety/video/pages/popular.ts:194`
  - 当前策略／普通黑名单：quality → videoQualityFilter；`global-quality-filter-value`、`popular-quality-filter-status`。`src/modules/filters/variety/video/pages/popular.ts:195`
  - 当前策略／白名单：uploader → videoUploaderWhiteFilter；`global-uploader-whitelist-filter-value`、`popular-uploader-whitelist-filter-status`。`src/modules/filters/variety/video/pages/popular.ts:198`
  - 当前策略／白名单：title → videoTitleWhiteFilter；`global-title-keyword-whitelist-filter-value`、`popular-title-keyword-whitelist-filter-status`。`src/modules/filters/variety/video/pages/popular.ts:199`
  - 当前策略／强制黑名单：bvid → videoBvidFilter；`global-bvid-filter-value`、`popular-bvid-filter-status`。`src/modules/filters/variety/video/pages/popular.ts:202`
- **整理页面**（依赖站点自然排布）：当前过滤调用链不改排行榜名次或网格结构；隐藏卡片后的排布由站点决定。
  - 源码：`src/modules/filters/variety/video/pages/popular.ts:168`
  - 补载（未实现）：没有从排名或推荐数据补齐被隐藏项的逻辑。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：属性模式、站点自然排布、按可见数量补载、卡片字段转换、按需补取视频统计、跨页面主动获取标签。

## 搜索页（search）

- **找到卡片**（有源码实现）：等待 .search-layout，扫描视频结果列表和用户卡片内的视频；用户卡片外层还有独立UP主筛选，子树变化后重新全量检查。
  - 源码：`src/modules/filters/index.ts:75`、`src/modules/filters/variety/video/pages/search.ts:397`、`src/modules/filters/variety/video/pages/search.ts:270`、`src/modules/filters/variety/video/pages/search.ts:271`、`src/modules/filters/variety/video/pages/search.ts:341`
  - 注册条件：`isPageSearch`。
  - `:where(.video.search-all-list, .search-page-video) .video-list > div`。`src/modules/filters/variety/video/pages/search.ts:270`
  - `.user-list .video-list-item`。`src/modules/filters/variety/video/pages/search.ts:271`
- **获取信息**（有源码实现）：普通字段来自卡片DOM，UP名可回落用户卡。标签、简介及命中字段来自站点已有响应或页面状态，数据来源与缺失情况见共用的搜索数据环节。
  - 源码：`src/modules/filters/variety/video/pages/search.ts:167`、`src/modules/filters/variety/video/pages/search.ts:99`、`src/modules/filters/variety/video/pages/search.ts:137`、`src/modules/filters/variety/video/pages/search.ts:152`
  - duration：对象 DOM，`.bili-video-card__stats__duration`；convertTimeToSec。`src/modules/filters/variety/video/pages/search.ts:168`
  - title：对象 DOM，`.bili-video-card__info--tit`。`src/modules/filters/variety/video/pages/search.ts:172`
  - bvid：对象 DOM，`.bili-video-card__wrap > a` 或 `.bili-video-card__info--right > a`，取 href；matchBvid。`src/modules/filters/variety/video/pages/search.ts:175`
  - uploader：对象 DOM，`.bili-video-card__info--author` 或 `.user-name`。`src/modules/filters/variety/video/pages/search.ts:208`
  - uploaderCard：对象 DOM，`.user-name`。`src/modules/filters/variety/video/pages/search.ts:214`
  - keyword：页面地址。页面 URL 的 keyword 参数；供当前相关度策略。`src/modules/filters/variety/video/pages/search.ts:188`
- **独立判断留下或不留下**（有源码实现）：此页绑定字段和当前规则，交给独立判断入口。
  - 源码：`src/modules/filters/variety/video/pages/search.ts:302`
  - 当前策略指标 relativity：旧搜索相关度；标签的取数与回退见搜索结果数据环节。 输入：当前搜索关键词、站点已有标题、简介、作者、标签和 hit_columns。`src/modules/filters/variety/video/pages/search.ts:184`
  - 当前策略／普通黑名单：duration → videoDurationFilter；`global-duration-filter-value`、`search-duration-filter-status`。`src/modules/filters/variety/video/pages/search.ts:302`
  - 当前策略／普通黑名单：title → videoTitleFilter；`global-title-keyword-filter-value`、`search-title-keyword-filter-status`。`src/modules/filters/variety/video/pages/search.ts:303`
  - 当前策略／普通黑名单：uploader → videoUploaderFilter；`global-uploader-filter-value`、`search-uploader-filter-status`。`src/modules/filters/variety/video/pages/search.ts:304`
  - 当前策略／普通黑名单：uploader → videoUploaderKeywordFilter；`global-uploader-keyword-filter-value`、`search-uploader-keyword-filter-status`。`src/modules/filters/variety/video/pages/search.ts:306`
  - 当前策略／普通黑名单：relativity → videoRelativityFilter；`search-relativity-filter-status`、`search-relativity-threshold-value`。`src/modules/filters/variety/video/pages/search.ts:307`
  - 当前策略／白名单：uploader → videoUploaderWhiteFilter；`global-uploader-whitelist-filter-value`、`search-uploader-whitelist-filter-status`。`src/modules/filters/variety/video/pages/search.ts:310`
  - 当前策略／白名单：title → videoTitleWhiteFilter；`global-title-keyword-whitelist-filter-value`、`search-title-keyword-whitelist-filter-status`。`src/modules/filters/variety/video/pages/search.ts:311`
  - 当前策略／强制黑名单：bvid → videoBvidFilter；`global-bvid-filter-value`、`search-bvid-filter-status`。`src/modules/filters/variety/video/pages/search.ts:314`
  - 当前策略／普通黑名单：uploaderCard → videoUploaderFilter；`global-uploader-filter-value`、`search-uploader-filter-status`。`src/modules/filters/variety/video/pages/search.ts:363`
  - 当前策略／普通黑名单：uploaderCard → videoUploaderKeywordFilter；`global-uploader-keyword-filter-value`、`search-uploader-keyword-filter-status`。`src/modules/filters/variety/video/pages/search.ts:365`
  - 当前策略／白名单：uploaderCard → videoUploaderWhiteFilter；`global-uploader-whitelist-filter-value`、`search-uploader-whitelist-filter-status`。`src/modules/filters/variety/video/pages/search.ts:369`
- **整理页面**（依赖站点自然排布）：卡片或用户卡片外层隐藏后靠站点布局收拢，不改结果总量或分页。
  - 源码：`src/modules/filters/variety/video/pages/search.ts:281`
  - 补载（未实现）：继续使用站点翻页，不按过滤结果主动跨页找内容。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：属性模式、站点自然排布、按可见数量补载、卡片字段转换、搜索结果的标签与相关度输入、按需补取视频统计、跨页面主动获取标签。

## 个人空间（space）

- **找到卡片**（有源码实现）：等待 #app，按空间主页、投稿、旧合集/系列和新版列表子路由选卡片；不匹配则跳过。子树变化后全量检查。
  - 源码：`src/modules/filters/index.ts:81`、`src/modules/filters/variety/video/pages/space.ts:185`、`src/modules/filters/variety/video/pages/space.ts:104`、`src/modules/filters/variety/video/pages/space.ts:108`、`src/modules/filters/variety/video/pages/space.ts:112`、`src/modules/filters/variety/video/pages/space.ts:116`
  - 注册条件：`isPageSpace`。
  - 条件 `/^\/\d+$/.test(location.pathname)`：`#page-index .small-item, .section-wrap.video-section .items__item, .section-wrap.lists-section .video-list__item`。`src/modules/filters/variety/video/pages/space.ts:106`
  - 条件 `/^\/\d+\/(?:upload\/)?video$/.test(location.pathname)`：`#submit-video :is(.small-item,.list-item), .video-list .upload-video-card`。`src/modules/filters/variety/video/pages/space.ts:110`
  - 条件 `/^\/\d+\/channel\/(collectiondetail|seriesdetail)/.test(location.pathname)`：`:is(#page-collection-detail,#page-series-detail) li.small-item`。`src/modules/filters/variety/video/pages/space.ts:114`
  - 条件 `/^\/\d+\/lists/.test(location.pathname)`：`.space-lists .video-list .video-list__item, .space-list-details .list-video-item`。`src/modules/filters/variety/video/pages/space.ts:118`
- **获取信息**（有源码实现）：使用旧/新两套卡片DOM提取时长和标题，标题链接解析BV。当前该视频过滤器不读取UP主字段。
  - 源码：`src/modules/filters/variety/video/pages/space.ts:42`
  - duration：对象 DOM，`span.length` 或 `.bili-cover-card__stats .bili-cover-card__stat:nth-last-child(1)`；convertTimeToSec。`src/modules/filters/variety/video/pages/space.ts:43`
  - title：对象 DOM，`a.title` 或 `.bili-video-card__title a`。`src/modules/filters/variety/video/pages/space.ts:49`
  - bvid：对象 DOM，`a.title` 或 `.bili-video-card__title a`，取 href；matchBvid。`src/modules/filters/variety/video/pages/space.ts:55`
- **独立判断留下或不留下**（有源码实现）：此页绑定字段和当前规则，交给独立判断入口。
  - 源码：`src/modules/filters/variety/video/pages/space.ts:147`
  - 当前策略／普通黑名单：duration → videoDurationFilter；`global-duration-filter-value`、`space-duration-filter-status`。`src/modules/filters/variety/video/pages/space.ts:147`
  - 当前策略／普通黑名单：title → videoTitleFilter；`global-title-keyword-filter-value`、`space-title-keyword-filter-status`。`src/modules/filters/variety/video/pages/space.ts:148`
  - 当前策略／白名单：title → videoTitleWhiteFilter；`global-title-keyword-whitelist-filter-value`、`space-title-keyword-whitelist-filter-status`。`src/modules/filters/variety/video/pages/space.ts:151`
  - 当前策略／强制黑名单：bvid → videoBvidFilter；`global-bvid-filter-value`、`space-bvid-filter-status`。`src/modules/filters/variety/video/pages/space.ts:154`
- **整理页面**（依赖站点自然排布）：未发现按空间子路由执行的过滤后补洞；退出布局后依赖站点自然排布。
  - 源码：`src/modules/filters/variety/video/pages/space.ts:128`
  - 补载（未实现）：未实现按可见数补载；继续使用空间页现有列表与分页。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：属性模式、站点自然排布、按可见数量补载、卡片字段转换、按需补取视频统计、跨页面主动获取标签。

## 播放页与播放列表（video）

- **找到卡片**（有源码实现）：等待右侧推荐容器 #reco_list、.recommend-list-v1 或 .recommend-list-container；扫描接下来播放与推荐卡片。子树变化后全量检查。
  - 源码：`src/modules/filters/index.ts:57`、`src/modules/filters/variety/video/pages/video.ts:218`、`src/modules/filters/variety/video/pages/video.ts:132`
  - 注册条件：`() => isPageVideo() || isPagePlaylist()`。
  - `.next-play :is(.video-page-card-small, .video-page-operator-card-small), .rec-list :is(.video-page-card-small, .video-page-operator-card-small), .recommend-video-card`。`src/modules/filters/variety/video/pages/video.ts:132`
- **获取信息**（有源码实现）：时长来自封面，标题和作者来自信息区；BV取标题或封面链接。番剧右键入口的存在不等于番剧注册了此过滤链。
  - 源码：`src/modules/filters/variety/video/pages/video.ts:64`
  - duration：对象 DOM，`.pic-box span.duration`；convertTimeToSec。`src/modules/filters/variety/video/pages/video.ts:65`
  - title：对象 DOM，`.info > a p`。`src/modules/filters/variety/video/pages/video.ts:69`
  - bvid：对象 DOM，`.info > a` 或 `.pic-box .framepreview-box > a`，取 href；matchBvid。`src/modules/filters/variety/video/pages/video.ts:72`
  - uploader：对象 DOM，`.info > .upname .name`。`src/modules/filters/variety/video/pages/video.ts:78`
- **独立判断留下或不留下**（有源码实现）：此页绑定字段和当前规则，交给独立判断入口。
  - 源码：`src/modules/filters/variety/video/pages/video.ts:159`
  - 当前策略／普通黑名单：duration → videoDurationFilter；`global-duration-filter-value`、`video-duration-filter-status`。`src/modules/filters/variety/video/pages/video.ts:159`
  - 当前策略／普通黑名单：title → videoTitleFilter；`global-title-keyword-filter-value`、`video-title-keyword-filter-status`。`src/modules/filters/variety/video/pages/video.ts:160`
  - 当前策略／普通黑名单：uploader → videoUploaderFilter；`global-uploader-filter-value`、`video-uploader-filter-status`。`src/modules/filters/variety/video/pages/video.ts:161`
  - 当前策略／普通黑名单：uploader → videoUploaderKeywordFilter；`global-uploader-keyword-filter-value`、`video-uploader-keyword-filter-status`。`src/modules/filters/variety/video/pages/video.ts:163`
  - 当前策略／白名单：uploader → videoUploaderWhiteFilter；`global-uploader-whitelist-filter-value`、`video-uploader-whitelist-filter-status`。`src/modules/filters/variety/video/pages/video.ts:166`
  - 当前策略／白名单：title → videoTitleWhiteFilter；`global-title-keyword-whitelist-filter-value`、`video-title-keyword-whitelist-filter-status`。`src/modules/filters/variety/video/pages/video.ts:167`
  - 当前策略／强制黑名单：bvid → videoBvidFilter；`global-bvid-filter-value`、`video-bvid-filter-status`。`src/modules/filters/variety/video/pages/video.ts:170`
- **整理页面**（依赖站点自然排布）：过滤本身只隐藏推荐卡片，依赖右侧列表自然收拢。可选相关数据过滤改变站点缓存，不能当作自动重排或补位。
  - 源码：`src/modules/filters/variety/video/pages/video.ts:139`
  - 补载（未实现）：不按可见数补充推荐；相关视频实验功能只从缓存去除命中项。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：属性模式、站点自然排布、按可见数量补载、卡片字段转换、按需补取视频统计、跨页面主动获取标签、播放页相关视频数据过滤。

## 此前本地候选与剩余问题

- **播放页缓存命中与容器发现**（此前本地候选已修）：用本轮返回的命中下标代替尚未刷新或上轮留下的隐藏属性；标题无链接时复用封面链接。延迟挂载的推荐容器按单个类名识别，允许同时具有其它类。
- **补数失败后重试**（此前本地候选已修）：当补数失败时清除已有检查标记，使卡片可以进入之后的增量扫描；不主动发起额外扫描或补载。
- **热门旧质量指标零分母**（此前本地候选已修）：点赞数为0时返回未知值，不让无效除法产生可参与过滤的分数。
- **共享数字控件与旧规则包**（待核对或后续处理）：此前确认的显式0停用和旧规则包省略问题仍待处理，涉及通用控件及同步语义，本次未改。
- **现场结构与排布**（待核对或后续处理）：首页首个 .container、热门页私有 Vue 数据及各页面自然收拢仅有源码证据；当前站点能否命中、是否留洞需要用户实测。
- **跨扫描时序**（待核对或后续处理）：此前的本地候选修复同一轮命中结果与绘制帧的错位；未建立跨路由或异步扫描的新旧结果仲裁。

## 对应的上游文件

链接是固定基线的文件对应，不能凭文件关系判定每行作者。本地差异和未核实来源分别保留。

- `src/modules/filters/decision/compatibility.ts`：已登记自有实现。
  - 值级判断沿用固定上游匹配语义，本地独立实现优先级、统计比较和二选一结果。
- `src/modules/filters/index.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/index.ts)，存在本地差异。
- `src/modules/filters/variety/video/pages/channel.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/video/pages/channel.ts)，存在本地差异。
- `src/modules/filters/variety/video/pages/homepage.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/video/pages/homepage.ts)，存在本地差异。
- `src/modules/filters/variety/video/pages/popular.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/video/pages/popular.ts)，存在本地差异。
  - 热门旧质量指标在点赞数为0时视为未知；不得以无效投币/点赞比判定隐藏。
- `src/modules/filters/variety/video/pages/search.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/video/pages/search.ts)，存在本地差异。
- `src/modules/filters/variety/video/pages/space.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/video/pages/space.ts)，存在本地差异。
- `src/modules/filters/variety/video/pages/video.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/video/pages/video.ts)，存在本地差异。
  - 相关视频缓存使用本轮命中下标，不能读取异步绘制前的DOM隐藏属性；复用标题/封面BV提取。延迟推荐容器按 classList 判断。
- `src/modules/filters/variety/video/statGate.ts`：无固定上游对应，来源待核实。
- `src/modules/filters/variety/video/statRate.ts`：无固定上游对应，来源待核实。
- `src/modules/filters/variety/video/subFilters/black.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/video/subFilters/black.ts)，存在本地差异。
- `src/modules/filters/variety/video/subFilters/white.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/video/subFilters/white.ts)，与基线一致。
- `src/modules/filters/variety/video/viewStat.ts`：无固定上游对应，来源待核实。
- `src/modules/rules/homepage/groups/basic.scss`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/rules/homepage/groups/basic.scss)，与基线一致。
- `src/modules/rules/homepage/groups/rcmd.scss`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/rules/homepage/groups/rcmd.scss)，与基线一致。
- `src/modules/rules/homepage/groups/rcmd.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/rules/homepage/groups/rcmd.ts)，存在本地差异。
- `src/utils/fetch.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/utils/fetch.ts)，存在本地差异。
- `src/utils/tool.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/utils/tool.ts)，与基线一致。

## 未接入的社区参考

- [bilibili_blocked_videos_by_tags.user.js](https://github.com/tjxwork/bilibili_blocked_videos_by_tags/blob/33a7d07bb43f3f6f1abfe6c0a69db527ade051b6/bilibili_blocked_videos_by_tags.user.js#L2163)：独立社区脚本按 BV 主动请求 /x/web-interface/view/detail/tag，读取 data[].tag_name。仅记录实现线索，没有接入本产品任何页面，也没有实测接口。原脚本声明 CC-BY-NC-SA。
