# 录制与回放的图片查看

本项目中，无论当前使用哪个主模型，UI 录制、页面探路、录制准备及回放验证中需要理解截图或界面原型时，必须先阅读并使用 [qwen-record-replay-vision](.opencode/skills/qwen-record-replay-vision/SKILL.md)。

统一调用项目 `opencode.json` 配置中的 `Qwen3.8-27B` 查看图片，使用该 skill 的 `scripts/inspect-images.mjs` 获取文字分析。主模型继续负责浏览器操作、录制和回放调度。不要使用主模型视觉、`view_image` 或其他模型代替；配置、连接或模型失败时明确报告，禁止静默回退。DOM、API 和回放报告的读取不受此规则影响。

此规则同样适用于 `playwright-ui-recorder`、`tansun-cst-recorder`、`req-doc-record-steps` 和 `replay-skill` 的图片查看环节；不修改回放引擎逻辑。
