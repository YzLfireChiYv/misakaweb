# 专栏过滤实现链

逐段核对固定源码；实际网页和布局未做浏览器实测。

四步：找到专栏结果 → 获取信息 → 独立判断留下或不留下 → 整理页面。源码位置使用仓库相对路径。

判断契约、页面分派、两种隐藏/恢复模式、绘制、自然排布与补载缺口，统一见[过滤共用登记](FILTER-COMMON.generated.md)。

## 此类过滤的共用能力（不含判断策略）


## 可替换的判断策略

通用匹配和黑白名单组合见[过滤共用登记](FILTER-COMMON.generated.md)；它属于现行策略。

- **现行专栏作者与标题规则**（当前策略，仍与页面耦合）：作者精确匹配、作者昵称关键词、标题关键词为普通规则；作者和标题白名单豁免，没有强制规则。右键作者按当前启用状态写入精确名单并重查。
  - 源码：`src/modules/filters/variety/article/pages/searchArticle.ts:14`、`src/modules/filters/variety/article/pages/searchArticle.ts:326`、`src/modules/filters/variety/article/subFilters/black.ts:4`、`src/modules/filters/variety/article/subFilters/white.ts:4`

## 搜索页专栏结果（search）

- **找到专栏结果**（有源码实现）：等待 div.search-content，在其中找 div.media-list 并扫描其直接子元素；子树变化后重新扫描。不扫描全站，也未注册专栏正文页。
  - 源码：`src/modules/filters/index.ts:129`、`src/modules/filters/variety/article/pages/searchArticle.ts:162`、`src/modules/filters/variety/article/pages/searchArticle.ts:133`、`src/modules/filters/variety/article/pages/searchArticle.ts:77`、`src/modules/filters/variety/article/pages/searchArticle.ts:94`
  - 注册条件：`isPageSearch`。
- **获取信息**（有源码实现）：作者读结果卡片文字，标题只读链接的 title 属性。右键另读作者链接作主页复制，不参与卡片判断。
  - 源码：`src/modules/filters/variety/article/pages/searchArticle.ts:41`
  - author：对象 DOM，`.atc-author .lh_xs`。.atc-author .lh_xs 的文字`src/modules/filters/variety/article/pages/searchArticle.ts:42`
  - title：对象 DOM，`.i_card_title a`，取 title。.i_card_title a 的 title 属性，没有正文或标题文本回退`src/modules/filters/variety/article/pages/searchArticle.ts:45`
- **独立判断留下或不留下**（有源码实现）：按当前作者及标题规则决定保留；源码没有专栏全文判断或独立评分。
  - 源码：`src/modules/filters/variety/article/pages/searchArticle.ts:124`
  - 当前策略／普通黑名单：author → articleAuthorFilter；`global-article-author-filter-value`、`search-article-author-filter-status`。`src/modules/filters/variety/article/pages/searchArticle.ts:114`
  - 当前策略／普通黑名单：author → articleAuthorKeywordFilter；`global-article-author-keyword-filter-value`、`search-article-author-keyword-filter-status`。`src/modules/filters/variety/article/pages/searchArticle.ts:116`
  - 当前策略／普通黑名单：title → articleTitleKeywordFilter；`global-article-title-keyword-filter-value`、`search-article-title-keyword-filter-status`。`src/modules/filters/variety/article/pages/searchArticle.ts:117`
  - 当前策略／白名单：author → articleAuthorWhiteFilter；`global-article-author-whitelist-filter-value`、`search-article-author-whitelist-filter-status`。`src/modules/filters/variety/article/pages/searchArticle.ts:120`
  - 当前策略／白名单：title → articleTitleKeywordWhiteFilter；`global-article-title-keyword-whitelist-filter-value`、`search-article-title-keyword-whitelist-filter-status`。`src/modules/filters/variety/article/pages/searchArticle.ts:122`
- **整理页面**（依赖站点自然排布）：命中卡片加隐藏属性，无启用规则时移除属性；保留项由站点自然排布。结果总量和分页不变。
  - 源码：`src/modules/filters/variety/article/pages/searchArticle.ts:99`
  - 未实现：专栏正文页过滤、正文/标签/互动数据与主动取数、过滤后补洞或跨页补载。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：属性模式、站点自然排布、按可见数量补载。

## 此前本地候选与剩余问题

- **当前识别边界**（待核对或后续处理）：直接处理 media-list 子元素，未再按卡片类型筛选；标题属性缺失时没有回退。是否触发页面遗漏需实测。

## 对应的上游文件

链接是固定基线的文件对应，不能凭文件关系判定每行作者。本地差异和未核实来源分别保留。

对照净化大师 15d9bce：专栏搜索文件仅改存储导入；入口重导出和专栏子过滤器一致。

- `src/modules/filters/index.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/index.ts)，存在本地差异。
- `src/modules/filters/variety/article/pages/searchArticle.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/article/pages/searchArticle.ts)，存在本地差异。
- `src/modules/filters/variety/article/subFilters/black.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/article/subFilters/black.ts)，与基线一致。
- `src/modules/filters/variety/article/subFilters/white.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/article/subFilters/white.ts)，与基线一致。
