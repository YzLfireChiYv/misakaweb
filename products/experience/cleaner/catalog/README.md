# 功能与配置登记

这是供产品审阅和后续开发使用的结构化登记。它记录当前实现和已确认的产品决定，尚未接管脚本运行时、修改默认值、写入用户设置或定义WebDAV协议。

## 数据入口

- `feature-groups.json`：功能归组种子。105个历史上游分组保留为 `reference-unreviewed`，`baselineDescription` 是上游基线说明，不能作为当前产品默认值。另有4个当前代码能力组，最终产品分组仍可调整。
- `default-decisions.json`：有依据的产品默认决定，以及候选预设和未定策略的状态。没有登记为已确认的默认值，继续保留待审阅状态。个人设置快照仅引用已有审阅记录，不复制进公开登记。
- `tags.json`：标签词典和少量经源码核对的例外；一般用途、页面和来源从已有分类与索引生成。
- `registry.generated.json`：从上述种子、当前源码和既有索引生成的关系数据。配置声明、代码默认值及约束随源码更新，避免人工再抄一遍。
- `REVIEW.generated.md`：同一数据生成的审阅摘要，先看已确认默认和当前冲突即可，不必逐行阅读完整JSON。
- `video-filter-chain.json`：视频过滤四步、共用能力、可替换策略及参考来源；[视频过滤逐页审阅](VIDEO-FILTER.generated.md)由同一登记生成。
- `object-filter-chains.json`：评论（一级/二级）、动态（三处入口）、专栏（搜索结果）的逐段证据，分别生成 [评论](COMMENT-FILTER.generated.md)、[动态](DYNAMIC-FILTER.generated.md)、[专栏](ARTICLE-FILTER.generated.md)审阅稿。
- `filter-common.json`：四类过滤共享的判断契约、分派、绘制、两种隐藏模式及自然排布/补载边界；[共用登记](FILTER-COMMON.generated.md)不重复放入各条链。
- `upstream-coverage-seed.json`：固定上游树与原始盘点的最小证据，用于核对全部文件、配置声明、动作/隐式行为和存储记录。包含输入摘要；正常查询无需读取 OneDrive 或 refs。
- `project-coverage.json`：非开关行为、少量人工确认的执行例外、共用部件和仓库配套职责。生成的[全量实现登记](COVERAGE.generated.md)区分声明实现、共享支撑、明确排除和不生效的历史设置。

生成器只解析源码语法，不启动页面模块、不联网，也不读取脚本管理器、浏览器或用户保存值。当前数据库采用可版本管理的JSON文件；运行时使用这份登记、数据库服务和同步接入不在本轮范围。

## 关系与默认值

`features` 表示能力分组；`controls` 表示当前界面控件；`configurations` 按“存储位置:实际键名”标识保存的数据；`declarations` 保留每个页面中的声明、选项及约束。功能和配置允许多对多关系。

例如S524和S525两个快捷入口控件共用 `gm:biliweb-shortcut-entry`，分别编辑其中的字段；WebDAV表单是复合控件，其链接、账号和密码是三个配置键，表单本身不冒充一个保存键。附属设备位置等配置也纳入登记。S编号用于反馈，登记关系及实际数据身份不依赖临时显示编号。

`declaredDefault` 区分显式声明、未声明、undefined和无法静态判定的表达式。`configurationDefaults` 记录Item及备份注册采用的缺省含义；未声明的开关虽按假值处理，也不等于已经保存了false。编辑器、连接字段和设备数据的缺省依据分别注明。

`readFallbacks` 另列能静态识别键名的GM_getValue/useGMValue读取回退；`ruleAbsentDefault`保留规则简略包的缺省/省略值。声明、读取和规则包可以不同：如夜间模式声明为default而一处读取为off；旧投币/点赞质量指标阈值声明25而部分读取和规则包缺省为0。它们不互相覆盖，差异列为待核对。工具不计算初始化顺序、外层归一化或动态键的最终效果，`effectiveDefaultStatus`保持not-derived；动态键调用也列出限制。

`productDefaults` 单独记录产品决定，支持完整值和对象字段级决定。状态允许confirmed、candidate、undecided；没有决定的配置保持unreviewed。当前夜间模式的官方默认值是 `default`，`off` 是强制日间。候选预设不自动扩展到后来新增的设置。

已决定不提供的自带夜间模式标为 `not-offered`，其控件和菜单目前仍能定位到源码。旧默认策略另存于 `supersededDecisions`，不参与当前产品默认。动态提示和分享净化的统一默认仅记录于此，现行页面声明仍如实展示。

同一键在不同页面的声明默认全部保留；`declarationDefaultConflict`及`issues`标出差异，不取首项当作统一默认。缺省设置如何跟随未来默认升级尚未决定，显式用户值继续与继承默认分开。

控件的`capabilityEditions`按当前分类和打包配置推导功能可用范围；配置的`registrationEditions`描述配置/备份登记覆盖范围。保留小窗位置等数据不代表纯净版提供小窗优化。两者不表示已逐版本运行验证或默认启用。`scope`描述当前备份注册表的分类，不等于未来的WebDAV读写或共享策略。

## 来源和待复核边界

`sourcePaths`关联到`sourceFiles`，沿用maintenance登记中的固定上游、文件对应关系和本地改动说明；尚未核实的来源保持unverified。文件对应不证明某个函数逐行来自上游，也不证明依赖独立。完整的实现来源审视仍属于后续阶段。

菜单和动作纳入`actions`，其产品功能关系标为not-reviewed；原始功能归组中不带配置的能力保留作审阅参考。后续调整分组、能力边界或默认值时，只修改对应种子及依据，不把历史候选悄然改成已确认结论。

用途、页面与对象、工作职责、维护来源、状态均可筛选，状态拆为 `product` 与 `implementation`。`located` 表示找到当前源码，不能据此认定实机可用。对象和职责按现有分组及键名给出初步标签；确定的例外用小范围登记修正，无法定位的条目保留待核实。上游匹配和本地差异是文件级证据，`mixed` 表示不同来源参与，不因同一上游的两个文件分别相同/有差异而混同为多来源。

## 更新和查询

在产品目录执行：

```text
pnpm catalog
pnpm catalog --check
pnpm catalog --coverage
pnpm catalog --coverage src/modules/rules/live/groups/basic.ts
pnpm catalog --baseline A-CTX-01
pnpm catalog --find S179
pnpm catalog --find gm:biliweb-shortcut-entry
pnpm catalog --find F-MISAKA-TOUCH
pnpm catalog --chain video-filter
pnpm catalog --chain video-filter search
pnpm catalog --chain comment-filter reply
pnpm catalog --chain dynamic-filter header
pnpm catalog --chain article-filter search
pnpm catalog --tags
pnpm catalog --tag purpose=cleaning --tag role=finish
pnpm catalog --tag product=not-offered
pnpm catalog --upstream cleaner:src/modules/rules/homepage/groups/basic.scss
pnpm catalog --compare cleaner <本地GitHub比较JSON>
```

生成会更新登记和审阅材料；check重新读取源码并验证产物一致。查询读已生成登记，不重新扫描源码，也不写文件。`--find`支持反馈编号、控件键、实际配置标识和功能ID，返回声明、实际读取、样式引用和固定来源。视频过滤的配置查询还给出对应实现链和页名；`--chain`展开共用环节及页面事实。筛选与反查默认最多显示20条，支持 `--limit`、`--offset` 和 `--json`；多个标签条件同时满足。页面查询包含声明适用于全站的控件。

视频过滤按**找到卡片 → 获取信息 → 独立判断留下或不留下 → 整理页面**登记。`decisionContract` 是尚未实现的独立二选一边界；黑白名单及阈值列在 `strategies`，页面绑定在 `currentStrategy`，不进入 `shared`。获取信息区分卡片 DOM、站点状态、站点响应和主动 API；旧相关度和质量分数属于策略指标。搜索 `tag` 是已有数据，主动标签接口仅有参考来源，未接入。字段、过滤规则与配置键的关系由语法读取；源码锚点失效会停止生成，便于跟版时复核。共用能力只登记一次。整理页面内区分隐藏与恢复、自然排布、独立样式/加载选项，以及尚未实现的按可见数补载。上游反查分别标明命中的实现环节和策略，仍是文件级关联。

反查接受一个或多个 `--upstream 来源ID:路径`，也可读取既有GitHub比较JSON（重命名前后的路径都检查）。比较起点与登记基线不一致、可能截断或路径未登记时会明示限制。结果分直接关联与静态依赖候选，并保留依赖路径；通用装配与注册文件单列为检查点，不向无关菜单和备份控件继续扩散。查询按文件定位，不能证明文件中的每项行为均受影响，也不推断未登记的运行依赖。

当前输入哈希保存在`inputs`，源码变化后重新生成即可识别漂移。工具不依赖本机refs或OneDrive；历史盘点已按最小字段冻结为种子，证据路径用于人工核对。覆盖检查会列出未匹配的声明、动作或存储记录；无缺口不等于每个行为都实机通过。固定上游源码和仓库配套文件均有去向，共用文件保留静态导入与引用关系。提交、发布和后续运行时改造分别审阅。
