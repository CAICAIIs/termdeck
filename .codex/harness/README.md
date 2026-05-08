# TermDeck Codex Harness

状态：2026-05-08 刷新。适用于本仓库的日常开发、issue 实现、debug、OpenSpec 规划和 Humanize RLCR 执行。

## 项目定位

TermDeck 是给自动化 agent 使用的持久 PTY daemon 和 CLI。核心目标是让终端会话跨 CLI 调用存活，并提供可轮询、可回放、可审计的输出、日志、事件和 observe-only Web UI。

## 标准开发闭环

1. 先跑窄检查：针对改动范围选择 `pnpm test -- <test-file>`、`pnpm run smoke:daemon`、`termdeck doctor` 或一个最小 CLI 复现。
2. 再实现：保持改动集中在相关模块，避免无关重构。
3. 再跑宽检查：`pnpm run typecheck`、`pnpm run lint`、`pnpm test`、`pnpm run build`。
4. 涉及 daemon/CLI/安装/平台行为时，必须跑 `pnpm run smoke:daemon -- --built`。
5. 最后审 diff：确认没有生成物、密钥、无关文件、未解释的依赖或范围漂移。

## 文件入口

- 命令清单：[commands.md](commands.md)
- 验证梯度：[verification.md](verification.md)
- 长跑会话：[sessions.md](sessions.md)
- 决策记录：[decisions.md](decisions.md)

## 安全策略

- 本地 commit 可以作为实现流程的一部分。
- `git push`、创建/合并 PR、发布 release、打 tag、GitHub 评论或 issue/PR 回复，都必须有用户在当前对话里明确授权。
- 即使用户授权 push，执行前也要说明将执行的远程写入命令。
- `gh` 默认只做只读检查，除非用户明确授权远程写入。
- 不读取或打印 secrets。`termdeck password` 是唯一面向密码输入的路径，不能把密码写进命令日志。
- 用户本机 Docker 默认使用 OrbStack。需要容器复现或 Linux 环境 smoke 时，优先按 OrbStack 的 Docker context、网络和文件共享行为排查，不假设 Docker Desktop。

## OpenSpec / Humanize 连接方式

- OpenSpec 只描述意图、范围、设计取舍和验收项。
- Humanize plan 必须引用本 harness 的 `commands.md` 和 `verification.md`。
- RLCR 每轮实现后，把命令结果、失败日志、修复假设和最终证据写入 Humanize loop 目录或会话摘要。
- issue 驱动实现时，先把 issue 链接、复现命令、验收项映射到 `verification.md` 的梯度，再交给实现循环。
