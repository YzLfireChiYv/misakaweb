# Bilibili-Evolved 上游解析

| 项 | 值 |
| --- | --- |
| 文档标识 | upstream/bilibili-evolved |
| 上游 URL | https://github.com/the1812/Bilibili-Evolved.git |
| 默认分支 | master（`origin/HEAD` 指向 `refs/remotes/origin/master`，本地检出 `master`） |
| HEAD | fa06dcec095dbccaba82f50ae2318c8d61c26671（短哈希 fa06dce） |
| 日期 | 2026-09-26 05:34:25 +0000 |
| 解析日期 | 2026-10-07 |
| 历史是否浅克隆 | 是。先 `git clone --depth 1`，再 `git fetch --shallow-since=2026-01-01`。`.git/shallow` 仍在。本地可见提交共 479 个，最早一条是 2026-01-05 的 `474b352`，2025 年及更早的历史不在这份工作树里 |

本地克隆目录是 `C:\AIWorkspace\biliweb\refs\Bilibili-Evolved`。克隆前该目录不存在，已按上面的浅克隆步骤新建，当前 `master` 与 `origin/master` 一致。解析过程没有修改上游源码，没有执行 `npm install` 或 `pnpm install`，没有 `git commit`，也没有重新构建。

HEAD 提交说明是 `CI build`。`git describe --tags --always` 的结果是 `v2.11.4-70-gfa06dce`。按创建顺序能看到的最近标签是 `v2.11.4`，它指向 2026-09-26 13:24:41 +0800 的 `fe65a5a`（`Update donate history`）。同一时间段还能看到 `v2.11.3` 到 `v2.10.6`，以及若干 `*-preview` 标签。

## 仓库记录

根目录 `package.json` 的 `name` 是 `@bevo/core`，`description` 是「强大的哔哩哔哩增强脚本」，`private` 为 `true`，`main` 指向 `dist/bilibili-evolved.user.js`。这份根 `package.json` 没有 `version` 字段。用户脚本版本写在 `src/client/common.meta.json`，值为 `2.11.4`，与已提交的 `dist/bilibili-evolved.user.js` 头部 `// @version 2.11.4` 一致。`registry/package.json` 的 `name` 是 `@bevo/components`，`version` 是 `0.0.1`，这是组件仓库包自己的占位版本，和脚本发行版本分开。包管理器字段是 `pnpm@10.3.0`，锁文件是根目录和 `registry/` 下的 `pnpm-lock.yaml`。当前工作树里没有 `node_modules`。

`LICENCE.md` 写明源代码基于 MIT 许可公开，并附加再分发限制：若发布完整脚本，需要保留 README 且把安装入口只放在 README 的「安装」一节，或者自行承接技术支持并改掉指向本仓库的反馈渠道。作者栏为 Grant Howard 与 Coulomb-G。

## 项目是什么

README 把项目称为「强大的哔哩哔哩增强脚本」。它是一支跑在 Tampermonkey 或 Violentmonkey 上的用户脚本套件，匹配 `*://*.bilibili.com/*`，在 `document-start` 注入。全新安装的核心脚本不自带具体功能，用户从设置面板按组件安装感兴趣的功能。README 写明 Greasemonkey 和 AdGuard 不兼容，并说明脚本与仓库提供的组件在本地处理数据。

技术栈从 `package.json` 和目录可以读出来：TypeScript 5.8、Vue 2.7、Webpack 5、Sass、Babel、ESLint。运行时依赖包括 lodash、`@popperjs/core`、tippy.js、marked、protobufjs、streamsaver、fflate、color、fuse.js。构建分两条：`build-core` 用 `webpack/webpack.prod.ts` 打核心用户脚本，`build-features` 用 `registry/webpack/all.ts` 把每个功能打成独立包。

顶层目录和主要文件如下。

- `src/`：核心运行时，入口是 `src/client/bilibili-evolved.ts`。
- `registry/`：可安装的组件和插件源码，以及已构建的 `registry/dist`。
- `dist/`：已构建的用户脚本。
- `webpack/`：核心包的 Webpack 配置、CDN 与元数据注入。
- `dev-tools/`：本地开发服务器、功能文档生成、PR 检查。
- `doc/` 与 `docs/`：功能说明、安装与回退文档。
- `images/`：README 用图。
- `.github/`、`.vscode/`、`.agents/`：仓库协作与编辑器配置。

根上还有 `README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`LICENCE.md`、`package.json`、`pnpm-lock.yaml`、`tsconfig.json`。

## 功能怎样组织

功能分成核心内置组件、可安装组件、可安装插件三层。

核心内置组件写在 `src/components/`，由 `src/components/built-in-components.ts` 固定列出：`settingsPanel`、`launchBar`、`i18n`、`autoUpdate`、`notifyNewVersion`、`bisector`、`compatibilities`。设置面板、启动栏、语言、更新检查和兼容性补丁属于这一层。

可安装组件的源码根目录是 `registry/lib/components/`。每个功能通常是一个子目录，里面有 `index.ts` 和 `index.md`。`index.ts` 用 `defineComponentMetadata` 导出 `component`，字段里有 `name`（组件 id）、`displayName`、`entry`、`tags`、`urlInclude` / `urlExclude`、`instantStyles`。标签常量在 `src/components/types.ts` 的 `componentsTags`，包括视频、样式、动态、直播、工具、触摸、实验、通用。Webpack 把 `registry/lib/components/**/index.ts` 各自打成独立包，产物在 `registry/dist/components/`。用户安装后，代码存在设置里，启动时由 `src/core/external-input/load-feature-code.ts` 在沙箱中执行，再进入 `src/components/component.ts` 的 `loadAllComponents`。

可安装插件的源码根目录是 `registry/lib/plugins/`，产物在 `registry/dist/plugins/`。插件导出 `plugin`，在 `setup` 里调用 `addData` / `addHook`，给已有组件登记扩展，例如下载器的输入输出、顶栏按钮、快捷键动作、动态过滤器的屏蔽块。加载入口是 `src/plugins/plugin.ts` 的 `loadAllPlugins`。组件自己也可以带 `plugin` 字段，运行时会被抽出来挂上。

废弃实现放在 `registry/lib/deprecated/`，例如旧的 `simplify-home`、`auto-continue`、`pip`。在线安装用的合集包写在 `registry/lib/docs/packages/`，其中 `cleaner` 是「简洁至上」，`downloader` 是下载器，`starter` 是常用功能包。

下面按主题列出目录和组件 id。id 取自各目录 `index.ts` 里的组件或插件 `name`。`video/player/common` 和 `video/danmaku/converter` 是共用代码，没有单独的组件 id。`style/dark-mode/old` 是夜间模式用的 CSS 切片。

### 播放器

目录 `registry/lib/components/video/player/`：

- `auto-light`（`playerAutoLight`）
- `control-background`（`playerControlBackground`）
- `custom-auto-play`（`customAutoPlay`）
- `default-mode`（`defaultPlayerMode`）
- `disable-double-click-fullscreen`（`disableDoubleClickFullscreen`）
- `disable-scroll-volume`（`disableScrollVolume`）
- `extend-speed`（`extendVideoSpeed`）
- `focus`（`playerFocus`）
- `intersection-actions`（`playerIntersectionActions`）
- `invert-scroll-volume`（`invertScrollVolume`）
- `legacy-auto-play`（`legacyAutoPlay`）
- `mini-player-size`（`miniPlayerSize`）
- `preserve-danmaku-input`（`preserveDanmakuInput`）
- `rbvp`（`rbvp`）
- `remember-speed`（`rememberVideoSpeed`）
- `remember-video-collection`（`rememberVideoCollection`）
- `remove-popup`（`removePlayerPopup`）
- `screenshot`（`videoScreenshot`）
- `seek-by-frames`（`seekByFrames`）
- `show-cover`（`showCoverBeforePlay`）
- `show-upload-time`（`showUploadTime`）
- `skip-charge-list`（`skipChargeList`）
- `video-scaling`（`videoScaling`）

配套插件 `registry/lib/plugins/video/player/speed`（`speed.keymap`）。

同层视频页功能在 `registry/lib/components/video/`：`auto-remove-watchlater`（`autoRemoveWatchlater`）、`av-url`（`avUrl`）、`biliplus-redirect`（`biliplusRedirect`）、`bvid-convert`（`bvidConvert`）、`default-location`（`videoDefaultLocation`）、`full-description`（`fullVideoDescription`）、`full-episode-title`（`fullEpisodeTitle`）、`metadata`（`saveVideoMetadata`）、`outer-watchlater`（`outerWatchlater`）、`quick-favorite`（`quickFavorite`）、`seo-redirect`（`seoRedirect`）、`snapshot`（`videoSnapshot`）。

弹幕在 `registry/lib/components/video/danmaku/`：`airborne`（`danmakuAirborne`）、`download`（`downloadDanmaku`）、`expand`（`expandDanmakuList`）、`merger`（`danmakuMerger`）、`unescape`（`unescapeDanmaku`）。字幕下载是 `video/subtitle/download`（`downloadSubtitle`）。

触摸播放在 `registry/lib/components/touch/`：`combo-like`（`touchComboLike`）、`double-click-control`（`doubleClickControl`）、`mini-player`（`touchMiniPlayer`）、`player-control`（`touchPlayerControl`）、`player-gestures`（`touchPlayerGestures`）。

样式目录里和播放器布局直接相关的还有 `player-on-top`（`playerOnTop`）、`player-on-top-new`（`playerOnTopNew`）、`player-shadow`（`playerShadow`）、`special-danmaku`（`disableSpecialDanmaku`）。

### 样式

目录 `registry/lib/components/style/`：

- `always-show-duration`（`alwaysShowDuration`）
- `auto-hide-sidebar`（`autoHideSidebar`）
- `clear-home`（`clear-home`）
- `custom-font-family`（`customFontFamily`）
- `custom-navbar`（`customNavbar`）
- `dark-mode`（`darkMode`），子目录 `follow-system`（`darkModeFollowSystem`）、`integrated`（`integratedDarkMode`）、`schedule`（`darkModeSchedule`）
- `hi-res-button-styles`（`hiResButtonStyles`）
- `home-redesign/fresh`（`freshHome`）、`home-redesign/minimal`（`minimalHome`）
- `replace-cover`（`replaceCover`）
- `scrollbar`（`elegantScrollbar`）
- `sidebar-offset`（`sidebarOffset`）
- `simplify/comments`（`simplifyComments`）、`simplify/live`（`simplifyLiveroom`）
- `v1-panel`（`v1PanelStyle`）
- `video-page-background`（`videoPageBackground`）

隐藏类样式在 `style/hide/`：`banner`（`hideBanner`）、`home-carousel`（`hideHomeCarousel`）、`trending-search`（`hideTrendingSearch`）、`user-card`（`hideUserCard`）、`user-pendent`（`hideUserPendent`）、`bangumi/reviews`（`hideBangumiReviews`）、`bangumi/sponsors`（`hideBangumiSponsors`）、`video/notes`（`hideVideoNotes`）、`video/recommended-live`（`hideRecommendedLive`）、`video/related-videos`（`hideRelatedVideos`）、`video/report`（`hideVideoReport`）、`video/share`（`hideVideoShare`）、`video/top-mask`（`hideVideoTopMask`）。

顶栏插件在 `registry/lib/plugins/style/`：`custom-navbar-channel`（`customNavbar.items.channel`）、`custom-navbar-dark-mode`（`customNavbar.items.darkMode`）、`custom-navbar-integrated-dark-mode`（`customNavbar.items.integratedDarkMode`）、`custom-navbar-pgc`（`customNavbar.items.pgc`）。

### 下载

组件：`registry/lib/components/video/download`（`downloadVideo`）、`video/subtitle/download`（`downloadSubtitle`）、`video/danmaku/download`（`downloadDanmaku`）、`utils/download-audio`（`downloadAudio`）、`utils/download-emoticons`（`downloadEmoticons`）。`downloadVideo` 内部还有 `apis`、`inputs/video`、`inputs/bangumi`、`outputs`。

下载器插件在 `registry/lib/plugins/video/download/`：`manual-input`（`downloadVideo.inputs.manual`）、`empty-output`（`downloadVideo.outputs.empty`）、`idm-output`（`downloadVideo.outputs.idm`）、`aria2-output`（`downloadVideo.outputs.aria2`）、`motrix-output`（`downloadVideo.outputs.motrix`）、`mpv-output`（`downloadVideo.outputs.mpv`）、`mpv-output-ex`（`downloadVideo.outputs.mpv-ex`）、`mpv-output-playlist`（`downloadVideo.outputs.mpv-playlist`）、`wasm-output`（`downloadVideo.outputs.wasm`）、`abdm-output`（`downloadVideo.outputs.abdm`）。

### 直播

目录 `registry/lib/components/live/`：

- `badge-helper`（`badgeHelper`）
- `badge-keepalive`（`badgeKeepalive`）
- `block-live-visibility-detection`（`blockLiveVisibilityDetection`）
- `chat-panel-fit`（`liveChatPanelFit`）
- `danmaku-sendbar`（`liveDanmakuSendbar`）
- `front-back-volume`（`frontBackVolume`）
- `gift-box`（`liveGiftBox`）
- `hide-gift-fullscreen`（`hide-fullscreen-gift-bar`）
- `hide-player-blur`（`hideLivePlayerBlur`）
- `home-mute`（`liveHomeMute`）
- `home-pause`（`liveHomePause`）
- `live-danmaku-helper`（`liveDanmakuHelper`）
- `liveroom-username-link`（`liveroomUsernameLink`）
- `original`（`originalLiveroom`）
- `remove-mask-panel`（`removeLiveMaskPanel`）
- `remove-watermark`（`removeLiveWatermark`）
- `showgirl`（`dpiLiveShowgirl`）
- `side-bar`（`collapseLiveSideBar`）

### 动态

目录 `registry/lib/components/feeds/`：

- `copy-link`（`copyFeedsLink`）
- `del-feeds`（`deleteFeeds`）
- `disable-details`（`disableFeedsDetails`）
- `extend-live`（`extendFeedsLive`）
- `filter`（`feedsFilter`）
- `fixed-sidebars`（`fixedFeedsSidebars`）
- `fold-comments`（`foldComments`）
- `full-content`（`fullFeedsContent`）
- `full-title`（`fullFeedsTitle`）
- `group-filter`（`feedsGroupFilter`）
- `hide-comment-preview`（`hideFeedsCommentPreview`）
- `image-auto-back-to-top`（`imageAutoBackToTop`）
- `legacy-image-viewer`（`legacyFeedsImageViewer`）
- `unfold`（`unfoldFeeds`）

动态过滤插件：`registry/lib/plugins/feeds/filter/hide-charge-feeds`（`feedsFilter.pluginBlocks.chargeFeeds`）、`hide-goods`（`feedsFilter.pluginBlocks.goods`）。

### 评论

- `registry/lib/components/style/simplify/comments`（`simplifyComments`）
- `registry/lib/components/feeds/fold-comments`（`foldComments`）
- `registry/lib/components/utils/comments/content-replace`（`commentContentReplace`）
- `utils/comments/copy-link`（`copyCommentsLink`）
- `utils/comments/disable-search-link`（`disableCommentsSearchLink`）
- `utils/comments/image-export`（`commentImageExport`）
- `utils/comment-reply-up-like-show`（`commentReplyUpLikeShow`）
- `feeds/hide-comment-preview`（`hideFeedsCommentPreview`）

### 过滤与屏蔽

和内容过滤、推荐屏蔽、去广告直接相关的目录集中在这些位置，说明见下一节。

- `utils/remove-promotions`（`removePromotions`）
- `utils/black-list`（`blackList`）
- `feeds/filter`（`feedsFilter`）及其两个插件 `hide-charge-feeds`、`hide-goods`
- `feeds/group-filter`（`feedsGroupFilter`）
- `feeds/del-feeds`（`deleteFeeds`）
- `style/clear-home`（`clear-home`）
- `style/hide/` 下的 `related-videos`、`recommended-live`、`home-carousel`、`banner`、`trending-search`、`bangumi/sponsors`
- `video/player/remove-popup`（`removePlayerPopup`）
- `video/player/skip-charge-list`（`skipChargeList`）
- `style/special-danmaku`（`disableSpecialDanmaku`）
- `style/simplify/comments`（`simplifyComments`）
- `live/hide-gift-fullscreen`（`hide-fullscreen-gift-bar`）
- `live/remove-watermark`（`removeLiveWatermark`）
- `live/remove-mask-panel`（`removeLiveMaskPanel`）
- `utils/comments/content-replace`（`commentContentReplace`）

### 其它

`registry/lib/components/utils/` 里其余工具：`active-video-links`（`activeVideoLinks`）、`album-time-show`（`albumPubTimeShow`）、`auto-like`（`autoLike`）、`bigger-video-preview`（`biggerVideoPreview`）、`change-update-urls`（`changeUpdateUrls`）、`check-in-center`（`checkInCenter`）、`column-unlock`（`columnUnlock`）、`dev-client`（`devClient`）、`image-exporter`（`imageExporter`）、`image-resolution`（`imageResolution`）、`import-series`（`importSeries`）、`ip-show`（`ipShow`）、`keymap`（`keymap`）、`mall-link-redirect`（`mallLinkRedirect`）、`subscribe-time-show`（`subscribeTimeShow`）、`url-params-clean`（`urlParamsClean`）、`v1-migrate`（`v1Migrate`）、`view-avatar`（`viewAvatar`）、`view-cover`（`viewCover`）、`watchlater-page-redirect`（`watchlaterPageRedirect`）、`watchlater-redirect`（`watchlaterRedirect`）。

启动栏搜索插件在 `registry/lib/plugins/launch-bar/`：`audio-search`、`bangumi-search`、`cv-search`、`number-search`、`trending-search`、`uid-search`，id 形如 `launchBar.actions.audioSearch`。快捷键插件在 `registry/lib/plugins/utils/`：`keymap-dark-mode`、`keymap-empty-action.ts`、`keymap-toggle-danmaku-list`、`keymap-toggle-player-light`、`keymap-toggle-subtitle`。设置面板插件 `settings-panel/recent-components` 的 id 是 `settingsPanel.tagFilters.recentComponents`。加载动画插件 `v-loading/reimu` 的 id 是 `vLoading.reimu`。

## 怎样判断页面，怎样注入 CSS 和 DOM

用户脚本的站点范围写在 `src/client/common.meta.json`。`match` 是 `*://*.bilibili.com/*`，`exclude` 去掉 API、创作编辑器、企业站、开放平台等地址，`run-at` 是 `document-start`。入口 `src/client/bilibili-evolved.ts` 调用 `src/client/init.ts` 的 `init`。`init` 先等到 `<head>` 出现，再跑 `src/client/compatibility.ts` 的兼容补丁。番剧页如果检测到 `bangumi_area_limit_hack` 且兼容组件开启了 `disableOnBalh`，初始化会在这里返回。

单个功能是否在当前页生效，由 `src/core/settings/helpers.ts` 的 `isComponentEnabled` 决定。组件启用之后，若写了 `urlExclude`，当前 URL 命中任一项就跳过；若写了 `urlInclude`，当前 URL 需要命中其中至少一项。比较函数是 `src/core/utils/index.ts` 的 `matchUrlPattern`：它取 `document.URL`，去掉查询串，字符串模式做 `includes`，正则模式做 `test`。页面分类常量集中在 `src/core/utils/urls.ts`，包括视频、番剧、课程、直播间、动态、专栏、主站分区、播放器页和稍后再看。同文件的 `matchCurrentPage` 用来判断当前页是否落在某一组地址里。动态卡片还有第二层适配，`src/components/feeds/api/manager/base.ts` 按 `src/components/feeds/api/manager/adaptor.ts` 里的 URL 列表选择对应页面的卡片管理器。

样式注入集中在 `src/core/style.ts`。`addStyle` 创建 `<style>` 并插入 `<head>` 末尾；`addImportantStyle` 把同一份样式插到 `<body>` 末尾，用来压过站点的 `!important`。组件可以声明 `instantStyles`。`preloadStyles` 在组件逻辑运行前把这些样式放进文档片段。标记了 `important` 的进 body 片段，标记了 `shadowDom` 的交给 `src/core/shadow-root/styles.ts`：那里构造 `CSSStyleSheet`，由 `src/core/shadow-root/dom-observer.ts` 监听新的 shadow root，再推进 `adoptedStyleSheets`。用户后来安装的自定义样式走 `src/plugins/style.ts` 的 `installStyle`，模式有 `default`、`instant`、`important`。

DOM 侧有三条常用路径。`src/core/utils/index.ts` 的 `mountVueComponent` 把 Vue 单文件组件挂到指定元素。`src/core/spin-query.ts` 的 `sq` 按间隔轮询，直到选择器出现或超过重试次数；动态过滤器就是用 `select` 找到侧栏再把 Vue 卡片插进去。`src/core/observer.ts` 封装 `MutationObserver`，提供子节点、属性和视频切换监听。很多纯样式功能的 `entry` 是空操作，只靠 `instantStyles` 或给 `document.body` 加 class。加载时机由通用设置里的 `LoadingMode` 控制：`src/components/component.ts` 的 `loadAllComponents` 可以等到 `contentLoaded` 或 `fullyLoaded`（`src/core/life-cycle.ts`）再跑插件和组件。

## 内容过滤、屏蔽推荐与去广告

仓库里有一批专门做过滤、藏推荐和去广告的组件。合集包 `registry/lib/docs/packages/cleaner.ts` 把其中一部分收成「简洁至上」。

`removePromotions`（`registry/lib/components/utils/remove-promotions`）删除站内广告，说明里点名首页推广模块、手机 App 推荐和视频页右侧广告。广告卡片可以完全隐藏，让后面的视频卡片补上位置，也可以改成自定义占位文本。选项里可以保留视频页的活动横幅。调试模式会给广告卡片加高亮边框，同时让其它屏蔽选项失效。

`feedsFilter`（`registry/lib/components/feeds/filter`）按类型或关键词过滤动态首页，也可以去掉动态页上的一些侧边卡片。说明要求到动态首页里打开详细设置。侧边「正在直播」指原版板块；若同时开了直播信息扩充，需要先关掉扩充，这项隐藏才会生效。组件会在左侧栏挂一块 Vue 过滤卡片。

`feedsFilter.pluginBlocks.chargeFeeds` 在装有动态过滤器时移除充电专属动态。`feedsFilter.pluginBlocks.goods` 在同样前提下移除商品带货动态，说明里的例子是「UP主的推荐 · 来自 XX」。

`feedsGroupFilter` 按关注分组筛选动态。`deleteFeeds` 用来删除动态，可选只删转发抽奖（保留自己中奖的动态）或全部删除。`blackList` 按 UP 主名称屏蔽首页视频卡，支持精确匹配和正则。它的说明写明只能在首页里使用或调整设置，实现上监听 `.bili-video-card`，命中后清空封面、作者和标题。

`clear-home` 的显示名是「首页净化」，作用是删除首页特定类型的卡片。`hideHomeCarousel` 处理首页轮播：可以整块隐藏、整块透明并禁止点击，或在自定义模式下停掉自动轮播、模糊图片、隐藏图片和标题。`hideBanner` 隐藏首页顶部横幅。`hideTrendingSearch` 隐藏搜索栏和搜索页里的「bilibili 热搜」；不输入关键词就按回车或点搜索时，仍会打开搜索页。

`hideRelatedVideos` 隐藏番剧页和视频页右侧的推荐视频列表。说明提醒：要关掉 B 站的自动连播，需要先取消隐藏，开关才会重新出现。`hideRecommendedLive` 隐藏视频页右侧下方的直播推荐。`hideBangumiSponsors` 隐藏番剧页下方的承包榜和右边的承包按钮。

`removePlayerPopup` 删除播放器里出现的各类弹窗，类别可以分开选。已经收成小条的弹窗会被直接删掉，不受类别选择影响。`skipChargeList` 自动跳过视频结尾的充电鸣谢，说明写明不包括番剧承包鸣谢。`disableSpecialDanmaku` 去掉高亮弹幕和 UP 主弹幕的特殊样式，弹幕文字仍保留。

`simplifyComments` 面向新版评论区，可隐藏用户等级、装扮图片、头像框、粉丝勋章和评论区顶部小喇叭横幅，并调整回复换行和编辑框排版。`commentContentReplace` 按多条配置替换评论里的关键词；替换目标如果是链接，就当作表情，留空则删掉命中的词。

`hide-fullscreen-gift-bar` 移除全屏看直播时底部的礼物栏。`removeLiveWatermark` 删除看直播时角落的水印。`removeLiveMaskPanel` 删除看直播时某些分区上的马赛克遮罩。

## 2026 年以来的提交

这份浅历史里的 479 个提交全部落在 2026-01-05 到 2026-09-26。解析日期是 2026-10-07，最近一次提交距此约 11 天。2026 年仓库仍在合并修复、改文档并打 `v2.11.x` 标签，处于活跃状态。更早的年份不在本地 log 里。

最近 15 条提交（日期、短哈希、说明）：

1. 2026-09-26 `fa06dce` CI build
2. 2026-09-26 `8abc91a` Merge branch 'preview-fixes'
3. 2026-09-26 `fe65a5a` Update donate history
4. 2026-09-26 `529d9e4` Update docs
5. 2026-09-26 `80d6053` Update version number
6. 2026-09-26 `159965a` Update changelog
7. 2026-09-26 `ae7b806` Merge pull request #5801 from kaixinol/fix/comment-image-export
8. 2026-09-26 `ca56caf` Merge pull request #5800 from T0MYYY/fix/header-entry-trigger-color
9. 2026-09-26 `f4ea3b0` Merge pull request #5772 from WhiteTeal55/fix/dark-integrated
10. 2026-09-26 `657d092` Merge pull request #5768 from kaixinol/fix/disable-details
11. 2026-09-26 `1c036fa` Merge pull request #5750 from WhiteTeal55/fix/toast
12. 2026-09-26 `9571c70` Merge pull request #5749 from WhiteTeal55/fix/5745
13. 2026-09-25 `868de68` Fix legacy auto play (fix #5642)
14. 2026-09-22 `98e6740` fix(hideBanner): 顶栏入口深色改用 --be-color-text-title, 适配融合深色模式
15. 2026-09-22 `daae985` 评论图片导出: 视频 ID 读取 unsafeWindow 的 bvid / aid

## 对 biliweb 的用法

以后做更重的网页改造，包括平板和宽布局时，把 `C:\AIWorkspace\biliweb\refs\Bilibili-Evolved` 当作只读对照。MisakaClean 继续用自己的页面改造方式。这里的组件安装、插件钩子、在线仓库和用户脚本沙箱留在上游，不迁进 MisakaClean。

值得以后精读的三个路径：

1. `C:\AIWorkspace\biliweb\refs\Bilibili-Evolved\src\core\utils\urls.ts`。这里按视频、番剧、直播、动态、主站把 URL 分成数组和正则。读的时候连着看同目录 `index.ts` 的 `matchUrlPattern`，以及 `src\core\settings\helpers.ts` 的 `isComponentEnabled`，可以对照 biliweb 自己的页面判断该覆盖到哪一类地址。
2. `C:\AIWorkspace\biliweb\refs\Bilibili-Evolved\src\core\style.ts`。首屏样式、普通样式和 `!important` 样式的插入点都在这个文件。B 站新播放器大量使用 shadow root，配套实现在 `src\core\shadow-root\`。DOM 等到节点出现再改的轮询和监听在 `src\core\spin-query.ts` 与 `src\core\observer.ts`。
3. `C:\AIWorkspace\biliweb\refs\Bilibili-Evolved\registry\lib\components\style\home-redesign\`。`fresh` 是清爽首页，`minimal` 是极简首页，两者说明都写了互斥，并且会关掉首页悬浮播放。极简首页的列数可以按视图宽度推断，也可以写成固定列数，这是宽布局和窄屏（含平板）最直接的对照。同级的 `custom-navbar`、`player-on-top-new`、`sidebar-offset` 是顶栏、播放器置顶和侧栏偏移，精读首页之后可以顺着这几个目录看。

## 工作树规模与构建产物

排除 `node_modules` 和 `.git` 后，工作树大约有 1705 个文件。扩展名里数量较多的是 TypeScript 约 694 个、Vue 约 225 个、Markdown 约 203 个、JavaScript 约 190 个、source map 约 179 个、SCSS 约 129 个。仓库里没有 `node_modules`。浅克隆完成时 Git 报告检出 1705 个文件，与这个计数一致。

仓库包含已经构建好的用户脚本，路径是：

- `C:\AIWorkspace\biliweb\refs\Bilibili-Evolved\dist\bilibili-evolved.user.js`（1,436,221 字节，头部版本 2.11.4）
- `C:\AIWorkspace\biliweb\refs\Bilibili-Evolved\dist\bilibili-evolved.preview.user.js`（1,436,320 字节）

组件和插件的构建产物也在仓库里：`registry\dist\components` 下约 303 个文件，`registry\dist\plugins` 下约 62 个文件，主要是 `.js` 和配套的 `.map`，按 `feeds`、`live`、`style`、`touch`、`utils`、`video` 等分目录。本次解析没有重新执行构建。
