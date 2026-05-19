# 黄金规则

## 产品与架构

- daemon 才能持有 PTY 和 session 状态；CLI 只能做请求和观测。
- Web UI 只读，不向 PTY 回传键盘输入。
- `termdeck task` 负责长跑后台任务，`termdeck step` / `project-step` 负责单次交互。
- `TERMDECK_HOME` 是运行时单一真相源，所有会话、日志、事件和 metadata 都放在这里。
- 面向 agent 的文本输出默认要脱敏；原始 transcript 只作为本地敏感 artifact。
- `run` 通过 marker 切分输出和 exit code，不要把命令回显和真实输出混为一谈。
- `termdeck password` 是唯一的密码输入路径，不要把 secret 写进 commands log。

## 减法偏好

- 优先复用已有命令、日志和状态文件，少加重复入口。
- 如果一个新能力能通过 `doctor`、`summary`、`search` 或 `task` 解决，就不要再造平行命令。
- 先删复杂分支和重复状态，再考虑增加抽象。

## 机械约束

- 通过测试和 smoke 强制的部分：daemon/CLI/Web 协议、doctor、install-check、built smoke、platform signal、MCP、task dashboard 相关行为。
- 目前主要靠文档约束的部分：README 与 harness 的命令同步、会话记录习惯、长跑任务备注、Codex App 触发规则。
- 如果某条规则反复 drift，优先补测试、脚本或 smoke，而不是再写一段说明。
