# Wider Bilibili 上游解析

| 项 | 值 |
| --- | --- |
| 文档标识 | upstream/wider-bilibili |
| 上游 URL | https://github.com/posthumz/wider-bilibili.git |
| 默认分支 | master |
| HEAD | 6a8d9703eafdc65289fb1909f3dcca4d3b5d0726（短哈希 6a8d970） |
| 日期 | 2026-08-04 22:06:41 +0800 |
| 解析日期 | 2026-10-07 |

本地克隆目录是 `C:\AIWorkspace\biliweb\refs\wider-bilibili`。克隆时该目录尚不存在，已从上述 URL 新建克隆，当前检出 `master`，与 `origin/master` 的 HEAD 一致。解析过程没有修改上游源码，没有执行 `npm install`，没有 `git commit`，也没有重新构建。

## 仓库记录

`package.json` 的 `name` 是 `wider-bilibili`，`version` 是 `0.4.9`，`private` 为 `true`。根目录 `LICENSE` 是 MIT License，版权声明为 Copyright (c) 2024 posthumz。`vite.config.ts` 里用户脚本的 `license` 字段同样写成 MIT，脚本说明是「哔哩哔哩宽屏体验」。HEAD 提交说明是 `fix: 播放器高度`。依赖锁文件是 `pnpm-lock.yaml`。运行时依赖列表为空，TypeScript、Vite、vite-plugin-monkey、ESLint 和 Husky 都列在 `devDependencies`。

## 项目做什么

README 把这支油猴脚本定位成哔哩哔哩的宽屏体验。播放器占满页面的宽度和高度，页面仍然可以滚动。宽屏状态走的是站点原生的「网页全屏」样式。视频、首页、动态、阅读等页面使用统一的页边距。用户可以用 `Shift+Alt+W` 打开设置面板，也可以从脚本菜单打开。README 还写到，脚本会顺手修掉 B 站前端的一些其它样式问题，作者没有逐条列出。

README 列出的可选项包括这些能力。播放器高度可以自适应，从而去掉上下黑边。导航栏可以放到播放器下方。小窗播放器可以调节大小，并记住拖动后的位置，非 16:9 视频会去掉黑边。播放器下方可以留出一段标题空间。播放器底栏控件可以收紧宽度和间距。暂停时可以强制把控件留在画面上。网页全屏下可以显示播放人数和弹幕数，站点自带的网页全屏样式默认不显示这两项。在选项上单击右键，可以把该项恢复成默认值。

README 的注意写明，脚本只保证新版页面的适配。原「宽屏」按钮和「网页全屏」按钮被去掉，「全屏」按钮仍然保留。

## 源码结构

README 的开发说明写的技术栈是 TypeScript、Vite 和 vite-plugin-monkey。`package.json` 里对应的开发依赖版本是 `typescript` `^5.9.2`、`vite` `^6.3.5`、`vite-plugin-monkey` `^7.1.4`。用户脚本构建入口写在 `vite.config.ts`：`vite-plugin-monkey` 的 `entry` 是 `src/main.ts`，构建目标是 `es2020`，`run-at` 是 `document-start`，`noframes` 为真，匹配地址是 `http*://*.bilibili.com/*`。开发服务器端口是 2233。

页面分发和播放器状态写在 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\main.ts`。`www.bilibili.com` 的首页、`/read`、`/opus` 各自注入对应样式；其余路径先注入视频页样式，等到页面里出现 `#bilibili-player` 再继续处理播放器。`t.bilibili.com`、`space.bilibili.com`、`message.bilibili.com`、`search.bilibili.com` 各有一段分支。没有单独适配的地址只保留通用样式。等待节点和 `DOMContentLoaded` 的辅助函数在 `src/utils.ts`。

样式汇总在 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\styles.ts`。它把各份 CSS 以内联字符串导入，再交给 `GM_addStyle`。页面样式放在 `src/styles/`，可选效果放在 `src/styles/options/`。构建插件 `cleanBuild` 在打用户脚本时会把 `src/styles/**/*.css` 静态收进 `styles.ts` 的导出对象。

设置面板的标记在 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\pages\options.html`。面板外观在 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\styles\panel.css`。选项的默认值、样式开关和存储监听在 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\options.ts`。独立预览页是 `src/pages/index.html`，配合 `vite.config.html.ts`，根目录设为 `src/pages`，端口 2333。README 写的独立开发命令是 `npm vite -c vite.config.html.ts` 或 `npm html`。

## 效果落在哪些文件

播放器铺满、页边距、高度和控件外观主要写在 CSS 里。播放页的主样式文件是 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\styles\video.css`。全站左右边距和顶栏高度写在 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\styles\common.css`。按页面拆开的样式还有这些文件：

- `src/styles/home.css` 负责首页。
- `src/styles/read.css` 负责阅读页。
- `src/styles/opus.css` 负责新版动态详情。
- `src/styles/t.css` 负责 `t.bilibili.com`。
- `src/styles/space.css` 负责空间页。
- `src/styles/message.css` 负责消息页。
- `src/styles/search.css` 负责搜索页。

`common.css` 把 `--layout-padding-input` 默认设为 `30px`，把 `--navbar-height` 设为 `64px`，再把实际页边距收成 `min(var(--layout-padding-input), 15vw)`。`video.css` 用 `--player-height: calc(100vh - var(--reserve-height))` 计算播放器高度，预留高度不超过 `25vh`。播放器容器 `#playerWrap.player-wrap` 和 `#bilibili-player-wrap` 用绝对定位贴在页面顶部，左右拉满，内边距被清掉。视频、番剧和收藏、稍后再看的下方容器用 `--layout-padding` 留出左右边距。原宽屏按钮 `.bpx-player-ctrl-wide` 和网页全屏按钮 `.bpx-player-ctrl-web` 在这里被隐藏。

可选样式在 `src/styles/options/`。`upperNavigation.css` 在导航栏改到播放器上方时，把顶栏顶距清零，并给播放器让出 `--navbar-height`。`fixHeight.css` 在关闭自动高度时把视频高度写成 `100vh`。`mini.css` 约束小窗宽度，默认 `--mini-width` 是 `320px`，最小宽度 `180px`，并放了一个左侧拖拽条 `.bpx-player-mini-resizer`。`compactControls.css`、`hideControls.css`、`pauseShowControls.css`、`stickyHeader.css`、`stickyAside.css` 分别对应控件间距、隐藏控件、暂停显示控件、粘性导航栏和动态页粘性侧栏。`reserveTitleBar.css` 目前是空文件。预留标题高度由 `options.ts` 写入 `--reserve-height-input`，再由 `video.css` 的高度公式消费。

README 记载大部分效果基本只使用 CSS 达成。`src/main.ts` 和 `src/options.ts` 另外处理了几处节点，这些节点给上面的样式提供状态。视频页在播放器内容器存在时，把 `data-screen` 设为 `web`，并包住 `setAttribute`，使小窗以外的屏幕状态继续落在 `web`。小窗宽度、右边距和底边距通过样式变量与一段注入样式保存，默认右边距 `52px`、底边距 `8px`。脚本会创建小窗缩放条，并把弹幕观看信息节点移到 `.bpx-player-control-bottom-center`。Bilibili Evolved 的 `.custom-navbar` 会被挂到 `#biliMainHeader` 里面。动态页会把 `.right` 节点放进 `.left`。设置面板是页面加载后插入 `body` 末尾的 `#wider-bilibili`。自动高度开启时，`ResizeObserver` 读取 `.bpx-player-container` 的内容高度，写到 `--player-height-record`，让顶栏让位跟真实画面高度对齐。

## README 里的兼容范围

浏览器方面，README 要求运行环境支持 ES2020、CSS 原生嵌套和 `popover`。它给出的版本下限是 Chromium 120+、Firefox 125+、Safari 17.2+，并建议直接使用最新版本。作者写明自测范围只有 Firefox 最新版和 Edge 最新版。`vite.config.ts` 的用户脚本头另外登记了 `firefox 117+`、`chrome 120+`、`edge 120+`，构建 `target` 是 `es2020`。`panel.css` 在缺少 `:popover-open` 或 CSS 嵌套时，会在面板按钮区显示升级提示。

插件方面，README 写明兼容 Bilibili Evolved，范围包括夜间模式和自定义顶栏在内的大部分插件，仓库地址是 `https://github.com/the1812/Bilibili-Evolved`。README 同时写明兼容解除 B 站区域限制，脚本页是 `https://greasyfork.org/scripts/25718`。源码里和 Evolved 直接相关的选择器包括 `.custom-navbar`、顶栏弹出层、`#bilibili-player` 内的夜间模式颜色覆盖、`.be-settings .sidebar`，以及 `compactControls.css` 里的 `.be-video-control-bar-extend`。区域限制脚本在这份源码里没有单独分支，兼容关系以 README 的声明为准。

## 设置如何打开

README 写的打开方式有两种。快捷键是 `Shift+Alt+W`。另一条入口在脚本菜单。`options.ts` 用 `GM_registerMenuCommand('选项', ...)` 注册菜单项，点击后调用面板的 `showPopover()`。快捷键监听要求 `shiftKey` 与 `altKey` 同时按下、`ctrlKey` 与 `metaKey` 不按下，按键是 `W`，然后调用 `togglePopover()`。

面板节点是 `div#wider-bilibili`，`popover` 设为 `auto`。标记来自 `src/pages/options.html`，分组是「通用」「播放页」「动态页」。通用项是左右边距，单位 px，提示写明不会超过 15% 宽度。播放页项包括自动高度、预留高度、导航栏下置、粘性导航栏、紧凑控件间距、显示观看信息、隐藏控件、暂停显示控件、小窗样式，以及「重置小窗位置」按钮。动态页项是粘性侧栏。关闭按钮使用 `popovertarget="wider-bilibili"`。

选项值通过 `GM_setValue` 按中文选项名存储，并用 `GM_addValueChangeListener` 回写样式开关或 CSS 变量。复选框和数字框的右键会删掉对应存储，界面回到 `options.ts` 里的 `fallback`。数字框被清空时同样回到默认值。左右边距的默认值是 `30`。预留高度的默认值是 `96`。导航栏下置、自动高度、小窗样式、粘性导航栏、紧凑控件间距、显示观看信息和隐藏控件默认打开。暂停显示控件和粘性侧栏默认关闭。

## 对 biliweb 的用法

这份仓库给 biliweb 作宽屏和页面布局的只读对照。对照时看选择器、CSS 变量和播放器状态，不把这里的油猴注入方式搬进 biliweb。当前阶段保持这份对照，不把宽屏播放器做进 biliweb。

以后如果做平板或网页布局，按下面的顺序读本地文件。

1. 先读 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\styles\common.css`。这里定义全站左右边距 `--layout-padding` 和导航栏高度 `--navbar-height`。
2. 再读 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\styles\video.css`。这里有播放器绝对定位、高度公式、视频页与番剧页下方容器的边距，以及 `#bilibili-player`、`.bpx-player-container`、`.video-container-v1`、`.main-container`、`.plp-l`、`.plp-r`、`.plp-left-wrap` 这些选择器。
3. 接着读 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\styles\options\upperNavigation.css` 和 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\styles\options\fixHeight.css`。两份文件分别对应导航栏位于播放器上方，以及关闭自动高度时视频占满视口。
4. 然后读 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\main.ts` 里 `www.bilibili.com` 的视频页分支。这段代码说明样式依赖 `data-screen="web"`，也说明 `--player-height-record` 来自播放器容器的高度监听。
5. 页面边距再按页面读 `src/styles/home.css`、`src/styles/space.css`、`src/styles/t.css`、`src/styles/read.css`、`src/styles/opus.css`、`src/styles/search.css`、`src/styles/message.css`。这些文件都在 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\styles\` 下。
6. 选项含义以 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\pages\options.html` 和 `C:\AIWorkspace\biliweb\refs\wider-bilibili\src\options.ts` 为准。小窗尺寸和位置只在需要对照小窗时再读 `src/styles/options/mini.css` 与 `main.ts` 后半段。

仓库里已提交的 `dist/wider-bilibili.user.js` 是构建产物。对照布局时以 `src/styles` 和 `src/main.ts` 为准。

## 2026 年的更新

`git log --since=2026-01-01 --oneline` 有 3 条提交，仓库在 2026 年仍在更新。三次提交都改了 `src/styles/video.css`，并同步了已提交的 `dist/wider-bilibili.user.js`。构建配置 `vite.config.ts` 在这三次提交里没有变化。主题是番剧页选择器和播放器高度适配。

`48e2ef7`（完整哈希 `48e2ef7c7ecfa851cf255485cbc6a5f80c1b7090`，2026-08-03）说明是 `fix: 番剧页左栏padding-top`。它给 `.plp-left-wrap` 增加 `padding-top: 0 !important`。

`b3c9864`（完整哈希 `b3c98641c9efe0bfa18854058490b6782364fa34`，2026-08-04）说明是 `fix: 番剧页播放器样式适配`。它把 `#playerWrap.player-wrap` 与 `#bilibili-player-wrap` 的高度改成 `100%`，把番剧页加载时的右填充改成 `padding: 0 !important`（注释指向 issues/4），并让唯一子元素 `div` 使用 `position: initial !important`。

`6a8d970`（2026-08-04 22:06:41 +0800）说明是 `fix: 播放器高度`。它把上一笔里的容器高度从 `100%` 改回 `height: auto`，并把小窗时 `.bpx-docker` 使用的变量名从 `--player-height--record` 改正为 `--player-height-record`。同一笔提交把 `package.json` 版本从 `0.4.8` 升到 `0.4.9`。这次提交就是当前 HEAD。

## 最近 20 条提交

| 短哈希 | 日期 | 说明 |
| --- | --- | --- |
| 6a8d970 | 2026-08-04 | fix: 播放器高度 |
| b3c9864 | 2026-08-04 | fix: 番剧页播放器样式适配 |
| 48e2ef7 | 2026-08-03 | fix: 番剧页左栏padding-top |
| bab93b4 | 2025-09-08 | fix: space header visibility |
| dbbbb83 | 2025-09-07 | chore: update README |
| 7431e51 | 2025-09-07 | feat: custom reserve height fix: player height; panel display |
| ea253f3 | 2025-09-05 | fix: BiliBili Evolved custom navbar top popup |
| 06fdf65 | 2025-09-04 | chore: build options html |
| 81e0ce4 | 2025-07-23 | fix: 空间页与导航栏宽度 |
| 2a2d934 | 2025-07-14 | fix: `显示观看信息`; 主页刷新按钮 |
| 6561343 | 2025-06-07 | fix: 小窗逻辑优化 |
| 2be30e8 | 2025-06-07 | feat: 选项重置功能 fix: 选项代码重构，选项面板使用popover，husky pre-commit构建 |
| c6396b2 | 2025-05-24 | fix: 自动高度关闭时也监听高度变化 |
| 870f793 | 2025-05-23 | fix: 优化视频高度计算方式 |
| f2f3b57 | 2025-05-23 | Merge pull request #2 from KZDKM/master |
| dac742b | 2025-05-23 | feat: 预留标题栏空间 |
| 2f6cf1d | 2025-04-20 | feat: 适配新版空间页 |
| 0f9bb62 | 2025-03-03 | fix: 宽度样式优先级 |
| 500ca70 | 2025-02-09 | fix: horizontal overflow in Chromium |
| 2c7ee65 | 2025-01-13 | fix: 播放器非整高度导致的顶栏错位 |
