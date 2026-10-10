# MisakaWeb

本项目大量借用社区上游项目。

## 安装

- [开发测试版 0.1.4.5](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/misakaweb-feedback-test.user.js)：当前开发版本，有反馈编号和优化功能组筛选。已有0.1.4.4用户需手动更新一次，之后按这个固定地址检查更新。
- [旧版 0.1.4](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/misakaweb.user.js)：保留原发布文件与地址。

使用脚本猫等用户脚本管理器安装，选择一种版本即可。各版本保留同一脚本身份；换版本前保留设置备份，下一次可以手动导入更新。

## 优化功能组

当前分为文字与字幕、主题与外观、页面布局、播放控制、阅读与导航、链接工具；为平板版另预留触摸操作。字体、直角化和夜间模式保留为可选能力、默认不启用。净化分享和过滤需要的补充载入能力留在净化/过滤核心。

现有开发版已经能按组查看设置；按组加入/剔除的多种成品尚在拆分，完成验证后会逐个增加直接安装链接。播放器触摸手势尚未集成。

## 开发

源码在 `products/experience/cleaner/`。进入目录运行 `pnpm release:prepare`，会检查、测试、构建开发脚本并生成公开摘要；GitHub工作流在源码更新后执行同一流程并更新安装文件。

产品由本仓库独立管理，构建不依赖本机上游参考或私人数据。功能组与外部来源定义在 [优化组清单](products/experience/cleaner/config/optimization-packs.json)，版本与更新地址在 [发行设置](products/experience/cleaner/config/release.json)。
