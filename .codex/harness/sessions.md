# 会话记录

当前没有需要长期保留的 daemon 或 test watcher。

## 2026-05-19：Codex App 全局链接验证

- 目的：确认当前 checkout 能作为 Codex App 的长期终端后端被日常调用。
- 命令：`npm link`、`termdeck doctor`、`termdeck step caicodex-smoke 'pwd && echo termdeck-ok' --cwd "$PWD" --timeout-ms 5000 --lines 4 --autostart`
- 结果：全局命令已出现在 `/opt/homebrew/bin/termdeck`、`/opt/homebrew/bin/termdeckd`、`/opt/homebrew/bin/termdeck-mcp`；`doctor` 通过；`step` 能自动启动 daemon 并返回 `status=ready`。
- 停止方式：`termdeck kill caicodex-smoke`
- 备注：daemon 未常驻，按需 `--autostart`。

## 临时 daemon 模板

```bash
export TERMDECK_HOME="$(mktemp -d)"
export TERMDECK_WEB_PORT=8787
pnpm run dev:daemon
```

检查：

```bash
TERMDECK_HOME="$TERMDECK_HOME" pnpm run dev:cli -- doctor --require-daemon
TERMDECK_HOME="$TERMDECK_HOME" pnpm run dev:cli -- list
```

停止：

```bash
pkill -f 'src/daemon.ts'
rm -rf "$TERMDECK_HOME"
```

如果开启了长跑 session，在这里记录：

- 目的
- 命令
- `TERMDECK_HOME`
- Web URL
- 最新失败或 ready 输出
- 停止方式
