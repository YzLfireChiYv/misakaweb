# MisakaWeb

本项目大量借用社区上游项目，改善哔哩哔哩网页体验。

## 安装

当前正在摸索最终产品，推荐使用一个完整编号版，按实际使用反馈决定后续功能组与发行组合：

- [完整编号版 0.1.4.9](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/misakaweb-feedback-test.user.js)：现有净化、过滤和六组优化全部可用，原设置开关保持；编号方便反馈。
- [同版无编号对照](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-desktop-toolkit.user.js)：设置布局相同，便于查看成品界面。

只安装一个版本，确认脚本管理器更新的是原 MisakaWeb，完成后刷新网页。名称、命名空间和设置键不变，不清除已有数据。字体统一、直角化和夜间模式的新默认关闭，已保存的显式设置保留。

## 设置界面

从顶栏快捷入口打开“页面净化”，或使用脚本菜单“页面净化优化”。设置按原功能组和新分类拆为独立栏目，例如“视频列表 - 净化”“视频列表 - 优化 - 文字与字幕”“视频列表 - 优化 - 页面布局”。搜索可匹配设置名称、栏目名称，编号版还可搜索编号。

原“归为优化/净化”“建议删除”和取舍清单已退出界面；旧取舍记录不影响当前分类，也不更改实际设置。编号版与同版普通版共用布局。页面设置底部的“导出维护信息”用于反馈故障，二者都提供，只包含页面结构信息。

视频、评论、动态、专栏过滤仍有原独立设置入口。功能保留不表示全部默认开启。

<details>
<summary>此前的分包实验（暂留，最终发行组合未定）</summary>

这些链接仍可安装，当前保持原实验版本；请优先用上面的完整编号版参与产品探索。各实验也是完整脚本，只安装一个，不需叠加净化版。

- [净化与过滤](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-pure.user.js)
- [净化＋文字与字幕](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-text-style.user.js)
- [净化＋主题与外观](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-appearance.user.js)
- [净化＋页面布局](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-layout.user.js)
- [净化＋播放控制](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-playback.user.js)
- [净化＋阅读与导航](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-reading-navigation.user.js)
- [净化＋链接工具](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-link-tools.user.js)
- [不含字体与主题的工具包](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-without-text-appearance.user.js)
- [旧版 0.1.4](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/misakaweb.user.js)

排除的优化值仍保存，切回包含该能力的版本可继续使用；不同管理器间迁移需要导入备份。实验组合由一套源码生成，未来再按实际需要安排。

</details>

## 开发与社区接入

源码在 `products/experience/cleaner/`。运行 `pnpm release:prepare` 完成现有检查，构建完整编号版与同版普通版，生成公开摘要；GitHub 在源码推送后执行同一流程。其它分包实验暂不随日常发布扩张。

[分包说明](products/experience/cleaner/PACKS.md) · [功能组与来源](products/experience/cleaner/config/optimization-packs.json) · [发行设置](products/experience/cleaner/config/release.json)。

[Evolved 触摸手势接入准备](products/experience/cleaner/community/README.md)已记录固定来源、文件摘要、播放器/设置/提示界面/清理的替换边界。下一块先接普通视频页横向进度手势，尚未启用手势功能或要求安装完整 Evolved。

## 交给网页版 AI 维护

[维护入口](products/experience/cleaner/maintenance/README.md)可按模块、设置编号或源码文件生成材料，包含相关源代码、固定上游与必要依赖；页面设置底部可以导出结构诊断，不导出正文、名单或凭据。

也可在[GitHub 维护包生成页面](https://github.com/YzLfireChiYv/misakaweb/actions/workflows/maintenance-packet.yml)运行工作流，填写 module（例如 shortcut、video-filter、settings-ui）或 setting（例如 S179）。将 CONTEXT.md 和问题描述交给网页 AI；候选修复由实际环境验收。
