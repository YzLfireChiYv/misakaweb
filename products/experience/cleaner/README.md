# MisakaWeb

这里的源码大量借用社区上游项目。

本目录是 MisakaWeb 当前测试产品的开发源码，由本项目独立 Git 仓库管理，不创建嵌套 Git 仓库。

在本目录安装依赖、修改源码和构建。构建命令为 `corepack pnpm exec vue-tsc -b` 和 `corepack pnpm exec vite build`；产物经验证后更新 `../misakaweb.user.js`。

本机 `refs/bilibili-cleaner` 仅供上游阅读对照，不参与产品构建，不在其 `experience` 分支继续开发。具体边界见根目录 `AGENTS.md`。

## 编号测试构建

运行 `pnpm build:feedback`，产物为 `../misakaweb-feedback-test.user.js`。只有该构建显示反馈编号，不含公开自动更新地址；普通构建不显示编号。测试编号保持稳定，数据仍使用原持久化键。

运行 `pnpm test` 检查配置映射与交互判定；安装了 Playwright 的本机还可运行 `node tests/panel-playwright.mjs` 验证面板拖动、关闭和窗口缩窄。测试使用隔离模拟页面，不等同于线上页面验收。用户设置候选与当前交付说明从根目录文档入口定位 OneDrive 资料。

M07 现在打开“快捷开关设置”，每次打开重新居中。页面快捷入口默认位于顶栏搜索右侧，可在面板中关闭或切换为原悬浮按钮；没有可用顶栏时仍可用 M07。`src/modules/shortcut/` 集中管理新入口的设备设置、可用动作及网页位置适配。新设置不加入当前规则同步包，原悬浮坐标保留。

0.1.4.5编号构建在M06/B19中提供净化/优化分类、优化功能组筛选、本页实效设置与全站取舍清单。`src/feedback/review-store.ts`集中保存独立取舍记录，不改实际设置、不加入WebDAV。普通构建使用空取舍目录且不读写该记录。净化全部保留，字体/直角化/夜间模式已确定可选保留、默认不启用，其余未标记优化仍待定。本版尚未物理裁剪功能组，触摸手势尚未集成。

## 分组与发布

`config/optimization-packs.json`记录六组现有优化及预留触摸组，覆盖全部73个优化键；技术依赖与功能类别分开。未来从一套源码构建不同完整脚本，尚未完成的发行组合不会显示为可安装版本。

版本和更新地址集中在`config/release.json`。运行`pnpm release:prepare`完成类型检查、测试和开发构建，自动更新`../misakaweb-feedback-test.user.js`和`../release-manifest.json`；该命令不执行Git操作。仓库根`.github/workflows/userscript.yml`在源码推送后运行同样的检查和构建，仅发布开发脚本与摘要，保留旧0.1.4文件。下一次手动更新到0.1.4.5后，脚本猫可从固定GitHub地址检查后续更新。

0.1.4.6将快捷入口挂到独立body节点，避免进入网站框架管理的搜索子树；位置仍跟随搜索按钮右侧。更新后刷新网页。`pnpm test:search`在隔离匿名Edge中运行完整构建，检查热搜、搜索联想、原生搜索生成的历史及入口模式切换；需可用Playwright包或`PLAYWRIGHT_MODULE_PATH`，结果默认写入忽略的`node_modules/.tmp/live-search/`。它不是日常用户配置或实际脚本猫扩展验收。
