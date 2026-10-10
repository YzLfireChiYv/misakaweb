# 三种方向，按需构建

config/build-profiles.json 的 editions 登记全量体验版、净化轻量版、桌面实用版；profiles 只有两个普通成品。全量体验版沿用编号开发通道。

- 全量体验版：完整净化/过滤、全部优化和触摸原型，当前试用主线。
- 净化轻量版：pure，全部净化/过滤和配置管理，没有可选优化。
- 桌面实用版：desktop-toolkit，基础能力加布局、播放控制、阅读导航、链接工具。字体、主题和触摸留在全量体验版。

本轮三份均生成0.1.5起始版本。pnpm release:prepare 和日常CI默认只更新全量体验版；另两份按需 pnpm build:variants --profile ID。不要把文件存在当作每次都已重建，应看每个成品自己的版本和摘要。旧实验文件仅保留兼容地址，不列入当前安装目录。

脚本身份和GM键保持；优化按编译时对象、CSS与专用入口裁剪，排除值不清除。触摸模块未加入时导出空Item列表，不启动控制器。共享配置管理始终保留，注册表汇总当前成品可用项；跨包不支持项提示跳过，不执行导入文件里的任意代码或默认约束。

scripts/pack-build.mjs 保留当前定义数与完整基线的检查；classificationsFor 提供公开分类。新页面/社区能力先登记设置、稳定编号、功能组与资源归属，再构建。必要的净化/过滤基础不随优化排除。

所有配置读写经过 src/storage/configStorage.ts，配置界面/备份格式见 src/modules/configuration/README.md。未来同步接该边界与作用域注册表，不把缓存、设备位置或连接密码混进用户规则。

触摸适配与来源见 community/README.md 和 src/modules/touch/README.md。固定来源及许可保留；实际平板输入、音量和原生媒体全屏留待用户试用。复杂评分和新的WebDAV并发协议仍是独立工作。
