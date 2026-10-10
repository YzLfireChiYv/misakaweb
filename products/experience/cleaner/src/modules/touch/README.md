# 播放器触摸适配

来源：[`the1812/Bilibili-Evolved` 的 swiper.ts](https://github.com/the1812/Bilibili-Evolved/blob/fa06dcec095dbccaba82f50ae2318c8d61c26671/registry/lib/components/touch/player-gestures/swiper.ts)，固定提交 `fa06dcec095dbccaba82f50ae2318c8d61c26671`。`gesture-math.ts` 保留方向判定及上、中、下三个区域的进度灵敏度，并修正正负阈值计算；上游许可原文保留为 [LICENCE.md](LICENCE.md)。本模块的反馈和支持归 [MisakaWeb](https://github.com/YzLfireChiYv/misakaweb/issues)。

`index.ts` 提供四项设置，供普通视频页注册。`TouchGestureController` 接收设置读取函数，启用时绑定当前视频，停用时删除触摸/点击/窗口事件、观察器、预览以及仍归自己所有的亮度样式。设置关闭时不观察、不轮询。动态视频替换由 childList 观察器识别，只在加入视频/播放器或旧视频移除时合并重扫；评论和字幕文字变动不会触发播放器重查。

预览是独立的原生 DOM 节点，普通模式位于 body、原生全屏时位于包含视频的全屏根；不复制 Vue 2 组件，不增加另一个框架。画面拖动超过阈值、方向足够明确后才接管，输入框、按钮、播放控制、菜单和多指触摸仍由原界面处理。横向拖动只在松开时设置 currentTime，保持暂停/播放状态；touchcancel 或多指触摸取消，不应用结果。调节过程的坐标与预览是临时状态，不写用户配置。

上下手势独立默认关闭，左侧为画面滤镜亮度，右侧为视频音量，同样松开应用。亮度并非设备屏幕亮度；部分移动浏览器不允许脚本改变音量。移动浏览器也可能优先接管垂直页面滚动，需要真实平板确定体验。所有动作使用当前 HTMLVideoElement，不访问缩略图或其它 API。已加载视频的进度不可用或时长非有限值时只提示，不提交跳转。

普通视频页为首步范围，不宣称番剧/活动页、iOS 音量、内置原生媒体全屏均已支持。真实平板验证待用户安装桌面网站模式后完成；桌面模拟触摸检查不等于实机验收。与 Evolved 或其它播放器手势同时开启时可能重复响应，保持独立开关供用户选择。
