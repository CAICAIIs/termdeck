# 会话记录

当前没有需要长期保留的 daemon 或 test watcher。

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
