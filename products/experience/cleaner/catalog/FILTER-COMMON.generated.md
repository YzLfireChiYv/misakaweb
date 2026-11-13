# 过滤共用登记

视频、评论、动态、专栏共用下列事实；不为每类对象重复保存。

## 独立判断契约

- 页面提供字段和启用的条件。判断只接收值，输出 keep 或 discard；统计豁免是内部取数标记。绘制和取数在外层协调，正式评分尚未实现。

## 共用能力

- **页面注册与装载**：注册表按页面分派入口，先调用入口再加载配置项。路由变化补启动尚未启动的模块；目标定位与观察方式见各适配。
  - `src/modules/filters/index.ts:50`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/index.ts)。
  - `src/modules/index.ts:101`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/index.ts)。
  - `src/utils/tool.ts:155`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/utils/tool.ts)。
- **绘制取舍与检查标记**：下一帧按判断结果绘制。核对节点仍在页面、路由和扫描版本，视频卡片另核对身份；取数失败允许增量重试。
  - `src/modules/filters/core/paint.ts:59`；来源见维护索引。
  - `src/config.ts:5`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/config.ts)。
- **隐藏与恢复：属性模式**：添加隐藏属性，由统一 CSS 设置 display:none；恢复时移除属性。DOM不删除。
  - `src/utils/tool.ts:128`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/utils/tool.ts)。
  - `src/utils/tool.ts:136`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/utils/tool.ts)。
  - `src/modules/filters/index.ts:145`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/index.ts)。
  - `src/config.ts:6`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/config.ts)。
- **隐藏与恢复：行内样式模式**：写入行内 display:none!important，恢复时只处理本脚本隐藏记录，并保留原 display 与优先级。DOM 保留。
  - `src/utils/tool.ts:130`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/utils/tool.ts)。
  - `src/modules/filters/core/paint.ts:16`；来源见维护索引。
- **站点自然排布**：隐藏项退出布局，剩余内容依赖站点布局和浏览器排布。父容器或固定占位是否留洞仍须实测；没有通用补洞或重排。
- **按可见数量补载**：没有按过滤后剩余对象数量触发补载的实现；站点滚动、翻页或展开继续由站点控制。

## 当前共用判断实现（可替换）

- **现行规则组合与匹配核心**：可替换的兼容策略。强制命中优先，普通命中可被白名单豁免。精确、关键词、布尔和数值比较接收独立字段值，缺数和运行错误分别处理。
  - `src/modules/filters/decision/compatibility.ts:25`；来源见维护索引。
  - `src/modules/filters/core/core.ts:39`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/core/core.ts)。
  - `src/modules/filters/core/subFilters/stringFilter.ts:3`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/core/subFilters/stringFilter.ts)。
  - `src/modules/filters/core/subFilters/keywordFilter.ts:5`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/core/subFilters/keywordFilter.ts)。
  - `src/modules/filters/core/subFilters/numberMinFilter.ts:3`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/core/subFilters/numberMinFilter.ts)。
  - `src/modules/filters/core/subFilters/numberMaxFilter.ts:3`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/core/subFilters/numberMaxFilter.ts)。
  - `src/modules/filters/core/subFilters/booleanFilter.ts:3`；[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/core/subFilters/booleanFilter.ts)。
