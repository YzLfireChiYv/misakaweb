# MisakaWeb

本项目大量借用社区上游项目。

## 安装

- [净化与过滤版](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-pure.user.js)：保留现有全部净化和视频、评论、动态、专栏过滤能力，适合搭配其他增强脚本。
- [完整工具包](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-desktop-toolkit.user.js)：净化与过滤，加上下面全部六组优化。
- [不含字体与主题的工具包](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-without-text-appearance.user.js)：包含布局、播放、阅读导航、链接工具，便于将字体和主题交给其他脚本。
- [开发测试版 0.1.4.8](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/misakaweb-feedback-test.user.js)：完整能力，另有反馈编号、优化取舍和只读维护诊断，适合参与测试。
- [旧版 0.1.4](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/misakaweb.user.js)：保留原发布文件与地址。

使用脚本猫等用户脚本管理器安装，**只选择一种版本**。下列单组版也都包含完整净化与过滤，不需要再安装净化版。

- [净化＋文字与字幕](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-text-style.user.js)：字体、字号、字重和字幕样式。
- [净化＋主题与外观](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-appearance.user.js)：夜间模式、圆角、滚动条等。
- [净化＋页面布局](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-layout.user.js)：列数、边距、宽度和位置。
- [净化＋播放控制](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-playback.user.js)：播放模式、全屏滚动和小窗控制。
- [净化＋阅读与导航](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-reading-navigation.user.js)：自动展开、跳转和导航便利。
- [净化＋链接工具](https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/variants/misakaweb-link-tools.user.js)：短域名分享、BV/AV转换和右键复制链接。

当前为 **0.1.4.8 测试阶段成品**。各版本沿用 MisakaWeb 名称、命名空间和设置键；切换时请确认管理器是在更新原脚本，避免出现同时运行的副本，完成后刷新网页。裁剪的能力不读取或启用原设置，其已保存值仍保留，切回相应版本后可继续使用。不同管理器之间迁移数据仍需导入备份。每种成品有独立固定更新链接，后续更新沿用所选版本。设置面板显示当前版本类别。

## 优化功能组

当前分为文字与字幕、主题与外观、页面布局、播放控制、阅读与导航、链接工具；为平板版另预留触摸操作。字体、直角化和夜间模式保留为可选能力、默认不启用。净化分享和过滤需要的补充载入能力留在净化/过滤核心。

成品在构建时按整组裁剪规则、相关样式及专用入口，组内仍保留分项设置；包含一个组不表示自动开启其中所有功能。后续组合由同一份源码与发行配置生成。播放器触摸手势尚未集成，暂不提供平板触摸版安装链接。

## 开发

源码在 `products/experience/cleaner/`。进入目录运行 `pnpm release:prepare`，会检查、测试、构建开发脚本和全部可用成品并生成公开摘要；GitHub工作流在源码更新后执行同一流程并更新安装文件。

产品由本仓库独立管理，构建不依赖本机上游参考或私人数据。功能组与外部来源定义在 [优化组清单](products/experience/cleaner/config/optimization-packs.json)，版本与更新地址在 [发行设置](products/experience/cleaner/config/release.json)。

## 交给网页版AI维护

[维护入口与命令](products/experience/cleaner/maintenance/README.md)说明如何按模块、设置编号或源码文件生成材料，包含相关源码、固定上游、差异状态、必要依赖与验收步骤。M06中的B34可导出只读页面结构诊断，不导出正文、名单或凭据。

也可以在[GitHub维护包生成页面](https://github.com/YzLfireChiYv/misakaweb/actions/workflows/maintenance-packet.yml)点击Run workflow，填写模块（例如shortcut、video-filter、comment-filter、rules-common），或在setting中填写编号（例如S179），完成后下载maintenance-handoff。将其中CONTEXT.md及问题描述交给网页版AI即可；包是修复输入，不表示已经通过真实网页验证。
