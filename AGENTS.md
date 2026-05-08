# AGENTS.md

## Codex Harness

- 做功能、debug、issue 实现或长循环前，先读 `.codex/harness/README.md` 和 `.codex/harness/commands.md`。
- 优先按 `.codex/harness/verification.md` 的梯度验证：窄复现或目标测试，再相关套件，再全量质量门。
- 新增长跑 daemon、复现命令、失败日志或有复用价值的调试路线时，更新 `.codex/harness/`。
- 远程写入仍需当前对话明确授权；执行 `git push`、GitHub 评论、PR/issue 回复、tag、release 前说明具体动作。
