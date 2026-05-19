# 评审清单

按这个顺序看 diff：

1. 先确认 authority 没漂移：命令入口、daemon 责任、`TERMDECK_HOME`、协议边界。
2. 再看导航是否清楚：`README.md`、`README_zh.md`、`docs/usage.md`、`AGENTS.md`、`.codex/harness/*` 是否互相指向一致。
3. 再看内容契约：CLI 命令名、参数、默认值、返回状态、脱敏行为、Web 是否只读。
4. 再看验证是否足够：有没有对应的 test、typecheck、build、source smoke、built smoke。
5. 最后看 diff 范围：有没有无关依赖、生成物、日志、临时文件、secret、过度重构。

常见问题：

- 文档写了命令，但 `package.json` 或 bin 没暴露。
- README 写了能力，但测试没覆盖，或者 smoke 没跑。
- 新增状态写了两处，导致 session / metadata / task 之间出现重复真相。
- 只验证了源码路径，没验证 `dist/` 发布形态。

如果这些问题重复出现，把它们升级成脚本、测试或 CI，而不是继续靠人工记忆。

## 自动 GPT-5.5 SubAgent Review

触发条件：

- daemon、CLI、MCP、Web、protocol、task、session、platform signal、install-check、doctor 任一核心路径发生非平凡变更。
- 删除、重构、兼容行为、默认配置、公开 CLI 参数、日志/脱敏、安全边界、Web 只读约束发生变化。
- 测试 oracle 不明显，或者测试在实现过程中被反复修改。
- 准备 push 前，diff 超过文档小改或单测小修。

跳过条件：

- 纯文档 typo、格式整理、只改 harness 文字且已跑 `check-harness-consistency.sh`。
- 单文件低风险修复，已有直接测试和 smoke 证据。
- 需要传入 secret、token、`.env`、生产日志或未脱敏 transcript。
- 同一 diff 已经被 GPT-5.5 reviewer 看过，且之后没有实质变化。

SubAgent 输入只给最小上下文：目标、diff 摘要、关键文件、已跑命令、失败/通过证据、待质疑点。它只读，不编辑、不 push、不评论 GitHub。主 Codex 必须把结论归并为“采纳 / 拒绝 / 待验证”，并继续以真实测试、smoke、日志和源码为最终证据。
