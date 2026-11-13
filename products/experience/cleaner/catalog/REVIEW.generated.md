# 功能与配置登记审阅摘要

此摘要由登记数据生成；产品默认仍未应用到运行配置。

- 功能分组记录：111；历史分组是待复核参考，不能等同于已确认的最终产品功能数。
- 设置控件：529；实际配置键：530；源码声明：713。
- 有依据的默认决定：7（含字段级决定）；未审阅配置：522。
- 529个设置控件和53个菜单/动作均带可检索标签；来源或实现不明确的保留待核实。

## 产品范围决定

- common-theme-dark、menu-dark-mode、side-dark-mode：已移除自带夜间模式及其入口。快捷入口读取官方页面配色，历史配置键和编号保留供追溯。（依据：OneDrive:notes/product/refactor-2026-11-07/PLAN.md#已确认的最新产品决定）
- common-unify-font、border-radius：保留为默认关闭的可选优化。（依据：OneDrive:notes/product/2026-10-10/decisions.json#/user_confirmed/optional_optimization_retention_2026_10_11）

## 已确认的默认决定

- `gm:biliweb-shortcut-entry.location`：`"header"`。页面快捷入口默认绑定顶栏搜索图标右侧；悬浮模式保留为用户选择。这里只确认位置，不擅自确认其它字段。
  - 依据：OneDrive:notes/docs/PROJECT-GUIDE.md#快捷入口约定
- `gm:border-radius`：`false`。页面直角化保留在可选优化包中，默认不启用；不覆盖已有显式保存值。
  - 依据：OneDrive:notes/product/2026-10-10/decisions.json#/user_confirmed/optional_optimization_retention_2026_10_11/border-radius
- `gm:common-unify-font`：`false`。保留在可选优化包中，默认不启用；不覆盖已有显式保存值。
  - 依据：OneDrive:notes/product/2026-10-10/decisions.json#/user_confirmed/optional_optimization_retention_2026_10_11/common-unify-font
- `gm:hide-dynamic-page-bili-dyn-dispute`：`true`。动态页和个人空间的警告提示统一默认隐藏；当前源码差异另保留。
  - 依据：OneDrive:notes/product/refactor-2026-11-07/PLAN.md#已确认的最新产品决定
- `gm:url-cleaner`：`false`。用户确定优先做好分享链接净化，地址栏自动净化暂不默认开启。
  - 依据：OneDrive:notes/user-feedback/2026-10-10/REVIEW.md#已确认的两项调整
- `gm:video-page-hide-video-info-argue`：`false`。饮酒、危险行为和AI生成等提示默认显示，保留用户主动隐藏的选择。
  - 依据：OneDrive:notes/user-feedback/2026-10-10/REVIEW.md#已确认的两项调整
- `gm:video-page-simple-share`：`true`。普通视频及番剧的分享净化统一默认开启；短域名继续独立设置。
  - 依据：OneDrive:notes/product/refactor-2026-11-07/PLAN.md#已确认的最新产品决定

## 跨页面声明差异

- `gm:hide-dynamic-page-bili-dyn-dispute`：缺键时由统一读取应用已确认的产品默认。
  - `src/modules/rules/dynamic/groups/centerDyn.ts:19:hide-dynamic-page-bili-dyn-dispute`：`true`
  - `src/modules/rules/space/groups/dynamic.ts:19:hide-dynamic-page-bili-dyn-dispute`：`false`
- `gm:video-page-simple-share`：缺键时由统一读取应用已确认的产品默认。
  - `src/modules/rules/bangumi/groups/basic.ts:4:video-page-simple-share`：`true`
  - `src/modules/rules/video/groups/basic.ts:67:video-page-simple-share`：`false`

## 声明与读取回退需要联查

这里只记录读取调用的回退参数；初始化顺序、外层归一化和动态键未推算，不能将其中某个值当成最终运行默认。


## 本轮保留的待定边界

- 历史候选预设保留证据引用，未复制个人设置或套用到新增项目。
- 原始分组、功能依赖/冲突、动作与功能关系继续待复核；静态import不等于运行依赖。
- 来源信息沿用现有维护登记；文件对应不证明全部函数的作者或网页研究来源。
- 版本可用范围从当前构建配置推导，不代表每版已实际运行验收。
- 默认升级、未来同步路由及最终产品形态继续按需求讨论；本轮未实现。

## 三个审阅样例

- **按标签筛选**：净化＋布局收尾命中 S190 隐藏 大图活动轮播、S197 隐藏 分区栏。这里是已有明确证据的两处收尾样例，未据此给所有布局项贴同样标签。
- **由配置定位实现**：分享净化共用一个保存键，定位到 `src/modules/rules/bangumi/groups/basic.ts`、`src/modules/rules/video/groups/basic.ts`。缺键时统一开启，原始声明保留供上游对照。
- **由上游文件反查**：首页基础样式对应 7 个直接关联项；Evolved swiper 对应触摸手势 S526、S527、S528、S529。装配检查点另列，结果用于定位检查范围。

## 对象过滤实现链

- 已按四步登记 6 个页面适配模块；[逐页审阅](VIDEO-FILTER.generated.md)。共用环节只登记一次，黑白名单只属于现行策略。
- 四类已接入独立判断，正式评分仍未实现。标签区分搜索响应复用与未接入的社区主动取数参考。
- [评论](COMMENT-FILTER.generated.md)、[动态](DYNAMIC-FILTER.generated.md)、[专栏](ARTICLE-FILTER.generated.md)已登记；[共用登记](FILTER-COMMON.generated.md)单列。
- 其余净化、优化、交互、存储和装配见[全量实现登记](COVERAGE.generated.md)，按实际执行方式记录。
- 单页查询：`pnpm catalog --chain dynamic-filter header`。反查上游时额外显示命中的环节和现行策略。

## 审阅入口

- 关系数据：registry.generated.json；产品决定：default-decisions.json；分组种子：feature-groups.json。
- 筛选：`pnpm catalog --tag purpose=cleaning --tag role=finish`。
- 定位：`pnpm catalog --find S502`、`pnpm catalog --find gm:biliweb-shortcut-entry`。
- 反查：`pnpm catalog --upstream cleaner:src/modules/rules/homepage/groups/basic.scss`。
- 确认数据与源码一致：`pnpm catalog --check`。提交和推送另行审阅。
