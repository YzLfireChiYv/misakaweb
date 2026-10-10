# MisakaWeb

改善哔哩哔哩网页体验，大量借用社区上游实现。

## 安装

当前收拢为三个方向，只安装其中一个；沿用原 MisakaWeb 的名称、命名空间与设置键，更新后刷新网页。

- [全量体验版 0.1.5](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/misakaweb-feedback-test.user.js)：推荐用于当前试用，保留反馈编号。包含完整净化、过滤、全部优化及触摸原型。
- [净化轻量版](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-pure.user.js)：保留完整净化、过滤与配置管理，排除可选优化。
- [桌面实用版](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-desktop-toolkit.user.js)：在净化、过滤、配置管理基础上加入布局、播放控制、阅读导航和链接工具；字体、主题与触摸不在本版。

三份已生成0.1.5起始版本，后续按需构建，日常自动发布默认只更新全量体验版。最终组合继续根据实际使用调整。此前实验文件保留在仓库，不再作为安装目录。

## 使用

“页面净化”按原功能组拆分净化和具体优化栏目；搜索可匹配名称、栏目和反馈编号。各类过滤仍有独立入口。编号版与无编号版共用界面，功能保留不表示全部默认开启。

从脚本菜单或快捷入口打开“配置管理”（编号版M09）。可集中搜索和编辑本版配置，下载备份、预览导入、默认合并或完整恢复明确的未保存项。默认导出功能设置、过滤规则和当前设备偏好；WebDAV连接和密码需单独勾选。导入前保存一份本机恢复备份，导入后的完整应用需要刷新。其它版本不支持的条目会提示跳过，未包含项不被清除。

配置读写统一经过同一存储入口，并按设置、规则、设备、连接信息区分；缓存和运行状态不混入配置备份。这为后续完整配置WebDAV同步准备结构，当前尚未实现多设备并发合并协议。导入时关闭旧规则自动同步，请检查连接和数据后手动启用。

## 平板触摸试用

全量体验版在普通视频页设置中搜索“触摸”或“S529”，开启播放器触摸手势。主开关和上下手势默认关闭：

- 左右滑动预览进度，松开跳转；上、中、下区域分别对应精细、中速、快速。
- 可选上下滑动：左侧画面亮度、右侧音量，松开应用。
- 多指或取消事件撤销预览；停用会清理监听和自己的提示、亮度样式。

使用Evolved固定来源的轨迹与灵敏度逻辑，自有轻量提示，不引入Vue2或完整Evolved运行时，不请求缩略图API。平板请使用可运行脚本的桌面网站模式。真实平板手感、音量控制及系统原生视频全屏仍待试用；桌面人工派发事件通过不代表真触摸验收。

## 开发与维护

源码在 products/experience/cleaner/。pnpm release:prepare 完成既有检查、维护索引和全量编号包；普通版按需使用 pnpm build:variants --profile pure 或 --profile desktop-toolkit。本轮初始生成三份，后续不要求每次全部重建。

[分包说明](products/experience/cleaner/PACKS.md) · [社区来源与适配](products/experience/cleaner/community/README.md) · [维护材料入口](products/experience/cleaner/maintenance/README.md)。

页面设置底部“导出维护信息”只导出页面结构，用于故障反馈；它和包含个人规则的配置备份不同。也可在[GitHub维护包生成页面](https://github.com/YzLfireChiYv/misakaweb/actions/workflows/maintenance-packet.yml)按模块或编号生成源码材料，交给网页AI分析，再做必要的现场验收。
