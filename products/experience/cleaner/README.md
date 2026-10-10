# MisakaWeb 源码

本目录由根独立 Git 仓库管理，refs 仅供只读参考，不参与构建。

## 当前产品探索

0.1.4.9 以完整编号版供实际试用，普通完整版共用界面，差别仅编号。页面设置按原功能组拆成“净化”“优化 - 具体包”“公共设置”栏目，保留搜索、折叠和实际设置控件。原取舍工具退出产品入口；历史代码和记录仅留作参考，不再读取取舍记录。

分类由构建时的公开目录注入，分栏不改变 Item 引用、配置键、默认值或回调。编号测试可搜索 S 编号；普通版搜索名称和栏目。维护信息导出是两版都有的支持工具，不自动读取私人数据。

## 构建与发行

`pnpm release:prepare` 更新维护索引、检查类型和既有测试，构建完整编号版与普通完整版（desktop-toolkit）及摘要。不执行 Git 操作。源码推送后 GitHub 运行同样流程，更新这两个安装通道。

`pnpm build:feedback` 生成 ../misakaweb-feedback-test.user.js。已有分包实验保留原固定地址，当前暂不扩大发行矩阵。需要特定组合时可用 `pnpm build:variants --profile ID`，有意重建全部实验才用 `pnpm build:variants`。旧 ../misakaweb.user.js 0.1.4 保留，不从当前普通构建自动覆盖。

快捷入口默认在搜索图标右侧的独立 body 节点，可在“快捷开关设置”中关闭或切回悬浮；每次打开快捷设置会居中。编号和普通版使用同一组设置键。

社区接入见 [准备记录](community/README.md)，分包约束见 [PACKS.md](PACKS.md)，维护材料见 [maintenance/README.md](maintenance/README.md)。复杂评分与新 WebDAV 并发协议尚未实现。
