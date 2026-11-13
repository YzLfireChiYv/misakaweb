# 评论过滤实现链

逐段核对固定源码；实际网页和布局未做浏览器实测。

四步：找到评论 → 获取信息 → 独立判断留下或不留下 → 整理页面。源码位置使用仓库相对路径。

判断契约、页面分派、两种隐藏/恢复模式、绘制、自然排布与补载缺口，统一见[过滤共用登记](FILTER-COMMON.generated.md)。

## 此类过滤的共用能力（不含判断策略）

- **评论组件收集与观察**｜找到卡片（有源码实现）：Shadow 工具包装 attachShadow，按宿主标签收集 shadowRoot。评论入口初始化规则、开启自身免过滤规则并安装观察器；入口本身不主动全量扫描。评论区六类路由共用这一适配。
  - 源码：`src/utils/shadow.ts:56`、`src/utils/shadow.ts:170`、`src/modules/filters/variety/comment/pages/common.ts:713`
- **评论组件已有数据**｜获取信息（有源码实现）：两级均读取宿主 __data、__upMid、__user，不主动请求评论或用户资料。没有将组件内数据整理成独立的、可跨页面使用的评论对象接口。
  - 源码：`src/modules/filters/variety/comment/pages/common.ts:134`
  - 宿主 __data / __upMid / __user：member.uname、member.avatar、member.vip.vipStatus、member.level_info.current_level、content.message、content.members、content.jump_url、mid、作者 mid、当前用户名；缺少 未主动拉取未渲染的评论。

## 可替换的判断策略

通用匹配和黑白名单组合见[过滤共用登记](FILTER-COMMON.generated.md)；它属于现行策略。

- **现行评论规则**（当前策略，仍与页面耦合）：用户名、正文、等级、默认头像、机器人、@与表情等作为当前判断条件。机器人名单是内置昵称，不是网络识别；带货使用内置关键词/正则。保留全部一级/二级分别在进入规则前短路。自身或提及自身规则在入口默认启用，是普通豁免，不能覆盖强制屏蔽。二级链式过滤基于已隐藏回复的 rpid 多轮传播，完整扫描清理层级图。
  - 源码：`src/modules/filters/variety/comment/pages/common.ts:49`、`src/modules/filters/variety/comment/pages/common.ts:416`、`src/modules/filters/variety/comment/pages/common.ts:344`、`src/modules/filters/variety/comment/pages/common.ts:646`、`src/modules/filters/variety/comment/subFilters/black.ts:6`、`src/modules/filters/variety/comment/subFilters/white.ts:3`、`src/modules/filters/variety/comment/extra/bots.ts:33`

## 一级评论／主题串（root）

- **找到评论**（有源码实现）：观察 BILI-COMMENTS 的子树变化，从 shadowStore 中的 BILI-COMMENT-THREAD-RENDERER 取宿主；增量时排除已检查标记。
  - 源码：`src/modules/filters/index.ts:91`、`src/modules/filters/variety/comment/pages/common.ts:424`、`src/modules/filters/variety/comment/pages/common.ts:446`、`src/modules/filters/variety/comment/pages/common.ts:686`
  - 注册条件：`() => isPageVideo() || isPageBangumi() || isPagePlaylist() || isPageDynamic() || isPageSpace() || isPageFestival()`。
- **获取信息**（有源码实现）：正文去掉 @ 片段；提及名单来自 content.members，是否有回复来自 rcount；置顶与笔记来自 reply_control。链接和自身豁免取组件内信息。
  - 源码：`src/modules/filters/variety/comment/pages/common.ts:134`
  - rpid：站点组件数据。__data.rpid_str，绘制前核对评论身份`src/modules/filters/variety/comment/pages/common.ts:136`
  - username：站点组件数据。member.uname`src/modules/filters/variety/comment/pages/common.ts:137`
  - content：站点组件数据。content.message，去掉 @ 片段`src/modules/filters/variety/comment/pages/common.ts:140`
  - noface：站点组件数据。member.avatar 与 vip.vipStatus`src/modules/filters/variety/comment/pages/common.ts:148`
  - callBot：站点组件数据。content.members 对照内置昵称`src/modules/filters/variety/comment/pages/common.ts:154`
  - callUser：站点组件数据。content.members 是否非空`src/modules/filters/variety/comment/pages/common.ts:161`
  - callUserNoReply：站点组件数据。rcount 为0且有提及`src/modules/filters/variety/comment/pages/common.ts:164`
  - callUserOnly：站点组件数据。移除 @ 后正文为空`src/modules/filters/variety/comment/pages/common.ts:170`
  - callUserOnlyNoReply：站点组件数据。rcount 为0且移除 @ 后正文为空`src/modules/filters/variety/comment/pages/common.ts:173`
  - level：站点组件数据。member.level_info.current_level`src/modules/filters/variety/comment/pages/common.ts:179`
  - emojiOnly：站点组件数据。去掉 @ 与表情后是否为空`src/modules/filters/variety/comment/pages/common.ts:182`
  - isUp：站点组件数据。mid 与 __upMid`src/modules/filters/variety/comment/pages/common.ts:191`
  - isPin：站点组件数据。reply_control.is_up_top`src/modules/filters/variety/comment/pages/common.ts:196`
  - isNote：站点组件数据。reply_control.is_note_v2`src/modules/filters/variety/comment/pages/common.ts:199`
  - isLink：站点组件数据。content.jump_url，搜索链接除外`src/modules/filters/variety/comment/pages/common.ts:202`
  - isMe：站点组件数据。__user.uname 对照评论人或正文 @`src/modules/filters/variety/comment/pages/common.ts:214`
- **独立判断留下或不留下**（有源码实现）：一级免过滤或无阻拦规则时直接恢复；带货和机器人发布为强制规则。一级另有置顶、笔记豁免。
  - 源码：`src/modules/filters/variety/comment/pages/common.ts:482`、`src/modules/filters/variety/comment/pages/common.ts:516`
  - 当前策略／普通黑名单：username → commentUsernameFilter；`global-comment-username-filter-value`、`video-comment-username-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:488`
  - 当前策略／普通黑名单：username → commentUsernameKeywordFilter；`global-comment-username-keyword-filter-value`、`video-comment-username-keyword-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:490`
  - 当前策略／普通黑名单：content → commentContentFilter；`global-comment-content-filter-value`、`video-comment-content-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:491`
  - 当前策略／普通黑名单：level → commentLevelFilter；`global-comment-level-filter-value`、`video-comment-level-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:492`
  - 当前策略／普通黑名单：noface → commentNoFaceFilter；`video-comment-noface-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:493`
  - 当前策略／普通黑名单：callBot → commentCallBotFilter；`video-comment-call-bot-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:494`
  - 当前策略／普通黑名单：callUser → commentCallUserFilter；`video-comment-call-user-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:495`
  - 当前策略／普通黑名单：callUserNoReply → commentCallUserNoReplyFilter；`video-comment-call-user-noreply-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:497`
  - 当前策略／普通黑名单：callUserOnly → commentCallUserOnlyFilter；`video-comment-call-user-only-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:499`
  - 当前策略／普通黑名单：callUserOnlyNoReply → commentCallUserOnlyNoReplyFilter；`video-comment-call-user-only-noreply-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:501`
  - 当前策略／普通黑名单：emojiOnly → commentEmojiOnlyFilter；`video-comment-emoji-only-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:503`
  - 当前策略／白名单：isUp → commentIsUpFilter；`video-comment-uploader-whitelist-status`。`src/modules/filters/variety/comment/pages/common.ts:506`
  - 当前策略／白名单：isPin → commentIsPinFilter；`video-comment-pinned-whitelist-status`。`src/modules/filters/variety/comment/pages/common.ts:507`
  - 当前策略／白名单：isNote → commentIsNoteFilter；`video-comment-note-whitelist-status`。`src/modules/filters/variety/comment/pages/common.ts:508`
  - 当前策略／白名单：isLink → commentIsLinkFilter；`video-comment-link-whitelist-status`。`src/modules/filters/variety/comment/pages/common.ts:509`
  - 当前策略／白名单：isMe → commentIsMeFilter；。`src/modules/filters/variety/comment/pages/common.ts:510`
  - 当前策略／强制黑名单：content → commentAdFilter；`video-comment-ad-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:513`
  - 当前策略／强制黑名单：username → commentBotFilter；`video-comment-bot-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:514`
- **整理页面**（依赖站点自然排布）：隐藏主题串宿主，回复区域随其退出布局；启用一级免过滤或关闭阻拦条件时恢复此前行内 display。当前不改计数、分页或补足主题串。
  - 源码：`src/modules/filters/variety/comment/pages/common.ts:483`
  - 未实现：未加载评论的主动获取、过滤后补足评论数量、评论区专用重排。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：行内样式模式、站点自然排布、按可见数量补载、评论组件收集与观察、评论组件已有数据。

## 二级回复（reply）

- **找到评论**（有源码实现）：观察 BILI-COMMENT-REPLIES-RENDERER 子树，从 BILI-COMMENT-REPLY-RENDERER 取宿主；观察回调全量检查回复。
  - 源码：`src/modules/filters/index.ts:91`、`src/modules/filters/variety/comment/pages/common.ts:537`、`src/modules/filters/variety/comment/pages/common.ts:563`、`src/modules/filters/variety/comment/pages/common.ts:697`
  - 注册条件：`() => isPageVideo() || isPageBangumi() || isPagePlaylist() || isPageDynamic() || isPageSpace() || isPageFestival()`。
- **获取信息**（有源码实现）：从已渲染回复读取字段；正文去掉“回复 @”前缀及其他 @ 片段。rpid_str 与 parent_str 表达回复关系，供当前链式策略。
  - 源码：`src/modules/filters/variety/comment/pages/common.ts:134`
  - rpid：站点组件数据。__data.rpid_str`src/modules/filters/variety/comment/pages/common.ts:229`
  - parent：站点组件数据。__data.parent_str`src/modules/filters/variety/comment/pages/common.ts:232`
  - username：站点组件数据。member.uname`src/modules/filters/variety/comment/pages/common.ts:239`
  - content：站点组件数据。content.message，去掉回复前缀和 @ 片段`src/modules/filters/variety/comment/pages/common.ts:242`
  - noface：站点组件数据。member.avatar 与 vip.vipStatus`src/modules/filters/variety/comment/pages/common.ts:252`
  - callBot：站点组件数据。content.members 对照内置昵称`src/modules/filters/variety/comment/pages/common.ts:258`
  - callUser：站点组件数据。正文移除回复前缀后匹配 @`src/modules/filters/variety/comment/pages/common.ts:265`
  - callUserNoReply：站点组件数据。实现与 callUser 相同，未读回复数量`src/modules/filters/variety/comment/pages/common.ts:271`
  - callUserOnly：站点组件数据。移除回复前缀和 @ 后正文为空`src/modules/filters/variety/comment/pages/common.ts:277`
  - callUserOnlyNoReply：站点组件数据。实现与 callUserOnly 相同，未读回复数量`src/modules/filters/variety/comment/pages/common.ts:286`
  - level：站点组件数据。member.level_info.current_level`src/modules/filters/variety/comment/pages/common.ts:295`
  - emojiOnly：站点组件数据。去掉回复前缀、@ 与表情后是否为空`src/modules/filters/variety/comment/pages/common.ts:298`
  - isUp：站点组件数据。mid 与 __upMid`src/modules/filters/variety/comment/pages/common.ts:308`
  - isLink：站点组件数据。content.jump_url，搜索链接除外`src/modules/filters/variety/comment/pages/common.ts:313`
  - isMe：站点组件数据。__user.uname 对照评论人或去掉回复前缀后的 @`src/modules/filters/variety/comment/pages/common.ts:325`
- **独立判断留下或不留下**（有源码实现）：二级免过滤或无阻拦条件时恢复；机器人发布在二级为普通规则，带货仍为强制。链式策略只用于二级；按配置深度多轮沿父回复关系传播。
  - 源码：`src/modules/filters/variety/comment/pages/common.ts:597`、`src/modules/filters/variety/comment/pages/common.ts:630`、`src/modules/filters/variety/comment/pages/common.ts:646`
  - 当前策略指标 isReplyToFiltered：parent_str 查询现行策略的隐藏回复图，不是原始字段 输入：父回复 ID、当前隐藏回复图。`src/modules/filters/variety/comment/pages/common.ts:235`
  - 当前策略／普通黑名单：username → commentUsernameFilter；`global-comment-username-filter-value`、`video-comment-username-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:603`
  - 当前策略／普通黑名单：username → commentUsernameKeywordFilter；`global-comment-username-keyword-filter-value`、`video-comment-username-keyword-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:605`
  - 当前策略／普通黑名单：content → commentContentFilter；`global-comment-content-filter-value`、`video-comment-content-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:606`
  - 当前策略／普通黑名单：level → commentLevelFilter；`global-comment-level-filter-value`、`video-comment-level-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:607`
  - 当前策略／普通黑名单：noface → commentNoFaceFilter；`video-comment-noface-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:608`
  - 当前策略／普通黑名单：username → commentBotFilter；`video-comment-bot-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:609`
  - 当前策略／普通黑名单：callBot → commentCallBotFilter；`video-comment-call-bot-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:610`
  - 当前策略／普通黑名单：callUser → commentCallUserFilter；`video-comment-call-user-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:611`
  - 当前策略／普通黑名单：callUserNoReply → commentCallUserNoReplyFilter；`video-comment-call-user-noreply-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:613`
  - 当前策略／普通黑名单：callUserOnly → commentCallUserOnlyFilter；`video-comment-call-user-only-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:615`
  - 当前策略／普通黑名单：callUserOnlyNoReply → commentCallUserOnlyNoReplyFilter；`video-comment-call-user-only-noreply-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:617`
  - 当前策略／普通黑名单：emojiOnly → commentEmojiOnlyFilter；`video-comment-emoji-only-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:619`
  - 当前策略／白名单：isUp → commentIsUpFilter；`video-comment-uploader-whitelist-status`。`src/modules/filters/variety/comment/pages/common.ts:622`
  - 当前策略／白名单：isLink → commentIsLinkFilter；`video-comment-link-whitelist-status`。`src/modules/filters/variety/comment/pages/common.ts:623`
  - 当前策略／白名单：isMe → commentIsMeFilter；。`src/modules/filters/variety/comment/pages/common.ts:624`
  - 当前策略／强制黑名单：content → commentAdFilter；`video-comment-ad-filter-status`。`src/modules/filters/variety/comment/pages/common.ts:627`
  - 当前策略／普通黑名单：isReplyToFiltered → commentChainFilter；`video-comment-chain-filter-status`、`video-comment-chain-level-value`。`src/modules/filters/variety/comment/pages/common.ts:648`
- **整理页面**（依赖站点自然排布）：二级回复保持原有不写已检查标记的行为。完成普通与链式判断后一次绘制，依赖站点评论容器排布。
  - 源码：`src/modules/filters/variety/comment/pages/common.ts:598`
  - 未实现：未展开回复的主动获取、补足剩余回复、独立链式结果与绘制分离。
- 引用的共用能力：页面注册与装载、绘制取舍与检查标记、隐藏与恢复：行内样式模式、站点自然排布、按可见数量补载、评论组件收集与观察、评论组件已有数据。

## 此前本地候选与剩余问题

- **二级提及数据缺失**（待核对或后续处理）：二级 callBot 直接读 members.length；缺失会抛错，不能等同于确认命中。一级有可选链。另有两个“无回复”变体在二级与普通变体相同。仅登记，未修改。
- **评论宿主与恢复边界**（待核对或后续处理）：Shadow 收集无按连接状态清理；行内 display 原值未保留。是否导致当前页面可见异常需要实测。

## 对应的上游文件

链接是固定基线的文件对应，不能凭文件关系判定每行作者。本地差异和未核实来源分别保留。

对照净化大师 15d9bce：评论页面文件仅改存储导入；评论子过滤器和内置名单一致。Shadow 工具另有本地改动：去掉首屏页面限制，并加防重复挂接。

- `src/modules/filters/index.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/index.ts)，存在本地差异。
- `src/modules/filters/variety/comment/extra/bots.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/comment/extra/bots.ts)，与基线一致。
- `src/modules/filters/variety/comment/pages/common.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/comment/pages/common.ts)，存在本地差异。
- `src/modules/filters/variety/comment/subFilters/black.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/comment/subFilters/black.ts)，与基线一致。
- `src/modules/filters/variety/comment/subFilters/white.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/modules/filters/variety/comment/subFilters/white.ts)，与基线一致。
- `src/utils/shadow.ts`：[固定上游](https://github.com/festoney8/bilibili-cleaner/blob/15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/utils/shadow.ts)，存在本地差异。
