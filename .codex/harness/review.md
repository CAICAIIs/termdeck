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
