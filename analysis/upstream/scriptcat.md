# ScriptCat 上游解析

| 字段 | 内容 |
| --- | --- |
| 文档标识 | scriptcat |
| 上游 URL | https://github.com/scriptscat/scriptcat.git |
| 默认分支 | main |
| HEAD | `80854540dd1759e55ce79f541fcf582ba9c0a499`（短哈希 `8085454`） |
| 日期 | 2026-09-29T12:13:22+08:00 |
| 版本 | `package.json` 为 `1.5.0-beta.4`；`src/manifest.json` 为 `1.5.0.1500`（`scripts/version.js` 的 `toChromeVersion` 把 beta.4 编成第四段 `1500`） |
| 解析日期 | 2026-10-07 |
| 历史是否浅克隆 | 是。`git fetch --shallow-since=2026-06-01` 已成功。本地可见提交从 2026-06-02 到 HEAD，共 162 个。2026-06-01 之前的历史不在本次克隆中。 |

克隆目录：`C:\AIWorkspace\biliweb\refs\scriptcat`。HEAD 说明：跨浏览器过滤 userScripts 不支持的 `@match` scheme（#1772）。许可证：根目录 `LICENSE` 为 GNU General Public License Version 3，`package.json` 的 `license` 字段为 `GPLv3`。标签 `v1.5.0-beta.4` 指向 `249e2fc31896d6a00ce9425e0a31bcccdc475b2e`（2026-09-18），HEAD 位于该标签之后。

## ScriptCat 是什么

ScriptCat（脚本猫）是用户脚本管理器，按 Tampermonkey 的设计兼容 Tampermonkey 用户脚本，运行目标是浏览器扩展。`src/manifest.json` 声明 `manifest_version` 为 3，入口包含 service worker、选项页和弹出页。README 写明它支持 Chrome、Edge 与 Firefox，并提供传统用户脚本、后台脚本和定时脚本。

顶层主要目录与文件包括 `src`（扩展源码与 manifest）、`packages`（扩展内部模块）、`docs`（架构与维护说明）、`example`（示例用户脚本）、`e2e`（Playwright 测试）、`tests`（Vitest 辅助）、`scripts`（打包与版本脚本）、`eslint-rules`、`rspack-plugins`、`patches`，以及 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`rspack.config.ts`。

仓库用 pnpm 管理依赖。根 `package.json` 的 `preinstall` 通过 `only-allow` 限定使用 pnpm，锁文件是 `pnpm-lock.yaml`。根目录有 `pnpm-workspace.yaml`，内容是 `minimumReleaseAge`、`overrides` 和 `patchedDependencies`。`packages` 下的 `message`、`filesystem`、`cloudscript`、`eslint`、`chrome-extension-mock` 没有各自的 `package.json`。`tsconfig.json` 用路径别名 `@App/*`、`@Packages/*`、`@Tests/*` 把 `src`、`packages`、`tests` 编进同一个扩展工程。`docs/references/architecture-build.md` 把 `packages` 下这些目录称为 pnpm workspace packages。构建脚本使用 rspack。

## GM API 落点

用户脚本调用的 `GM_*` 分成靠近脚本的内容侧、拥有浏览器特权的 service worker 侧，以及后台脚本需要 DOM 时使用的 offscreen 侧。

- 内容侧目录：`src/app/service/content/gm_api/`。注册装饰器在 `src/app/service/content/gm_api/gm_context.ts`。按 `@grant` 装入沙盒的逻辑在 `src/app/service/content/create_context.ts`。
- Service worker 侧目录：`src/app/service/service_worker/gm_api/`。
- Offscreen 侧文件：`src/app/service/offscreen/gm_api.ts`。
- 脚本存储值服务：`src/app/service/service_worker/value.ts` 的 `ValueService`。
- 给脚本作者的类型声明：`src/types/scriptcat.d.ts` 与 `src/types/scriptcat.zh-CN.d.ts`。

符号定义位置如下。

| 符号 | 定义位置 |
| --- | --- |
| `GM_getValue` | `src/app/service/content/gm_api/gm_api.ts` 的 `GMApi.GM_getValue` 与静态 `_GM_getValue`。持久化读写在 `src/app/service/service_worker/value.ts` 的 `ValueService`。 |
| `GM_setValue` | 同上内容侧文件的 `GMApi.GM_setValue` 与静态 `_GM_setValue`。服务工作线程处理函数在 `src/app/service/service_worker/gm_api/gm_api.ts` 的 `GM_setValue`。 |
| `GM_addValueChangeListener` | `src/app/service/content/gm_api/gm_api.ts` 的 `GMApi.GM_addValueChangeListener`。 |
| `GM_xmlhttpRequest` | 内容侧函数在 `src/app/service/content/gm_api/gm_xhr.ts` 的 `GM_xmlhttpRequest`；`src/app/service/content/gm_api/gm_api.ts` 的 `GMApi.GM_xmlhttpRequest` 调用它。服务工作线程处理函数在 `src/app/service/service_worker/gm_api/gm_api.ts` 的 `GM_xmlhttpRequest`，配套文件是同目录的 `gm_xhr.ts`。 |
| `GM_addStyle` | `src/app/service/content/gm_api/gm_api.ts` 的 `GMApi.GM_addStyle`。 |
| `GM_addElement` | `src/app/service/content/gm_api/gm_api.ts` 的 `GMApi.GM_addElement`。 |
| `GM_registerMenuCommand` | `src/app/service/content/gm_api/gm_api.ts` 的 `GMApi.GM_registerMenuCommand`。服务工作线程入口在 `src/app/service/service_worker/gm_api/gm_api.ts` 的 `GM_registerMenuCommand`。 |
| `GM_notification` | 内容侧 `GMApi.GM_notification` 与静态 `_GM_notification` 在 `src/app/service/content/gm_api/gm_api.ts`。服务工作线程处理函数在 `src/app/service/service_worker/gm_api/gm_api.ts` 的 `GM_notification`。 |
| `unsafeWindow` | 运行时赋值在 `src/app/service/content/create_context.ts`（`context.unsafeWindow = window`）。类型声明在 `src/types/scriptcat.d.ts`。 |
| `GM_info` | 对象由 `src/app/service/content/gm_api/gm_info.ts` 的 `evaluateGMInfo` 生成。`src/app/service/content/exec_script.ts` 调用该函数并注入执行上下文。`create_context.ts` 把同一对象挂到 `GM.info` 与 `GM_info`。 |

## 脚本元数据解析

`@match`、`@grant`、`@run-at` 由 `src/pkg/utils/script.ts` 的 `parseMetadata` 解析。同一文件的 `parseMetadataLines` 保留行号，并与 `parseMetadata` 共用头块规则。头块正则匹配 `==UserScript==` 与 `==UserSubscribe==`，行正则匹配 `// @指令 值`。指令名转成小写后写入 `SCMetadata`，因此这三项分别落在 `metadata.match`、`metadata.grant`、`metadata["run-at"]`。

编辑器诊断使用 `src/pkg/utils/monaco-editor/metadata.ts`，文件注释写明它与运行时 `parseMetadata` 对齐。`@run-at` 转成浏览器 `runAt` 的函数是 `src/app/service/service_worker/utils.ts` 的 `getRunAt`。URL 规则匹配代码在 `src/pkg/utils/match.ts` 与 `src/pkg/utils/url_matcher.ts`。`@grant` 装入沙盒时经过 `src/app/service/content/gm_api/grant.ts` 与 `src/app/service/content/gm_api/gm_context.ts`。

## 同步与订阅相关目录

以下目录与用户脚本同步、云同步、订阅相关，此处只列路径。

- `src/app/service/service_worker/`（`synchronize.ts`、`subscribe.ts`）
- `src/app/repo/`（`sync.ts`、`subscribe.ts`）
- `packages/filesystem/`（含 `webdav`、`onedrive`、`googledrive`、`dropbox`、`baidu`、`s3`、`zip`）
- `packages/cloudscript/`
- 维护说明文件：`docs/cloud-sync.md`

## 2026 年 6 月以来的活动

仓库在该窗口内仍有提交。可见范围的最早提交是 `b43823a`（2026-06-02，terminology / AI translation guardrails #1468），最新提交是 HEAD `8085454`（2026-09-29）。窗口内发布标签包括 `v1.4.0`、`v1.4.0-beta.4`、`v1.5.0-beta`、`v1.5.0-beta.1`、`v1.5.0-beta.2`、`v1.5.0-beta.3`、`v1.5.0-beta.4`。

最近提交（时间新的在前）：

| 短哈希 | 日期 | 说明 |
| --- | --- | --- |
| `8085454` | 2026-09-29 | 跨浏览器过滤 userScripts 不支持的 `@match` scheme（#1772） |
| `1be6aa8` | 2026-09-29 | 补齐 Firefox userAgentData，并对齐 Tampermonkey 版本粒度与字段顺序（#1754） |
| `e436ff5` | 2026-09-29 | 修复订阅手动检查更新无效，并同步刷新订阅列表（#1781） |
| `120039b` | 2026-09-28 | 优化 ESLint harness 性能并统一诊断断言（#1759） |
| `56ec5d3` | 2026-09-28 | 改进脚本编辑器资源浏览与预览（#1758） |
| `b6e37cc` | 2026-09-28 | 限制本地测试为单 worker（#1767） |
| `a14b8b9` | 2026-09-28 | 排序激活时提示排序状态，拖拽手柄改为锁定（#1768） |
| `3612b8d` | 2026-09-28 | 编辑器对重复 `@resource` 名称发出警告（#1762） |
| `11c5095` | 2026-09-28 | 修复云同步推送时脚本列表与编辑页长时间空白（#1765） |
| `dc4f1dd` | 2026-09-28 | 修复移动端脚本拖拽与左滑漏色（#1756） |
| `249e2fc` | 2026-09-18 | release v1.5.0-beta.4 |
| `61164f6` | 2026-09-01 | release v1.5.0-beta.3 |
| `3f2e412` | 2026-08-06 | release v1.5.0-beta.1 |

2026-06-02 至 2026-09-29 共能看到 162 个提交。更早历史不在本次浅克隆中。

## 对 biliweb 的用法

biliweb 把 ScriptCat 当作安装宿主。产品形态是 ScriptCat 扩展加上在 Edge 中运行的用户脚本。GM API 行为以本仓库当前 `main` 快照为准，快照 HEAD 为 `80854540dd1759e55ce79f541fcf582ba9c0a499`。后续重构把扩展源码留在宿主仓库，用户脚本产品只包含脚本本身。

## 工作树规模与克隆深度

工作树文件数为 1347。该计数排除 `.git` 与 `node_modules`。本次没有执行 npm 或 pnpm install，工作树中没有 `node_modules` 目录。

克隆方式是 `git clone --depth 1`，随后 `git fetch --shallow-since=2026-06-01` 成功。`git rev-parse --is-shallow-repository` 仍为 `true`，`.git/shallow` 仍存在。2026-06-02 及之后的提交已在本地，更早提交不在本次克隆中。
