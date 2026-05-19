# 决策记录

## 2026-05-08：把 doctor 和 smoke 作为 harness 主入口

选择新增 `termdeck doctor` 和 `pnpm run smoke:daemon`，因为它们分别覆盖“环境/安装是否健康”和“daemon/CLI/Web 发布形态是否真的可用”。这比只依赖单元测试更适合 agent 开发和 debug。

## 2026-05-08：CI 同时覆盖 Ubuntu 和 macOS

TermDeck 当前声明支持 Linux 和 macOS。CI 需要在两个平台跑 typecheck、lint、tests、build 和 built smoke，避免平台适配只在本机成立。

## 2026-05-08：harness 保存执行现实，OpenSpec 保存意图

OpenSpec 不承担命令百科和日志记录；这些放在 `.codex/harness/`。Humanize RLCR 可以直接引用 harness 的命令和验证梯度。

## 2026-05-08：本机 Docker 默认使用 OrbStack

用户主要使用 OrbStack。后续需要 Docker 或 Linux 容器复现时，默认检查 OrbStack 的 Docker context 和环境，不把 Docker Desktop 当作本机默认。

## 2026-05-19：TermDeck 作为 Codex App 的长跑后端

当前 checkout 已通过 `npm link` 暴露为全局命令。今后在这个机器上，Codex App 里凡是长跑、可恢复、需要日志搜索或后台任务管理的工作，默认优先走 TermDeck，而不是把这些工作硬塞进一次性 shell 命令。

短的一次性检查仍然可以直接用普通命令工具。TermDeck 的价值在于把长跑状态、日志和 ready 检查变成可恢复的系统，而不是替代所有简单命令。
