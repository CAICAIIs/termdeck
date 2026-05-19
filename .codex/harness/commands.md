# 命令清单

所有命令默认在仓库根目录 `/Users/caicaiis/Documents/github/CAICAIIs/termdeck` 执行。

## 安装与准备

```bash
pnpm install
node scripts/install-check.mjs
termdeck doctor
```

- `pnpm install` 会触发 `postinstall`，检查 `node-pty` native binding。
- `node scripts/install-check.mjs` 是安装诊断的窄入口，适合 native binding 或 Node ABI 问题。
- `termdeck doctor` 检查 Node 版本、pnpm build approvals、`node-pty` smoke、daemon socket、socket 权限和信号策略。

## 开发命令

```bash
pnpm run dev:daemon
pnpm run dev:cli -- --help
pnpm run dev:cli -- doctor
pnpm run dev:cli -- step main 'pwd && ls' --cwd "$PWD" --timeout-ms 5000 --autostart
```

ready 信号：

- daemon 输出 `termdeckd listening on ...`。
- `termdeck list` 或 `pnpm run dev:cli -- list` 退出码为 0。
- `termdeck state <session> --lines 12` 输出 `[termdeck] status=ready` 或明确的运行状态。

## Codex App 日常调用入口

本机已经把当前 checkout 通过 `npm link` 暴露为全局命令：

```bash
termdeck doctor
termdeck project-step 'pwd && ls' --cwd "$PWD" --autostart --timeout-ms 5000
termdeck task dashboard --autostart
```

Codex App 的默认选择：

- 短命令：继续用普通终端工具。
- 需要跨 turn 保留状态的项目命令：用 `termdeck project-step`。
- dev server、watch、长 benchmark、长测试：用 `termdeck task start`。
- 最终汇报或继续调试前：用 `termdeck summary`、`termdeck task logs`、`termdeck search` 取证。

项目级命令模板：

```bash
termdeck project-step '<command>' --cwd "$PWD" --autostart --timeout-ms 120000 --lines 20
termdeck list --cwd "$PWD"
termdeck summary <session> --lines 80 --events 20 --autostart
```

后台任务模板：

```bash
termdeck task start web 'pnpm dev' --cwd "$PWD" --ready-port 3000 --autostart
termdeck task status web --autostart
termdeck task logs web --lines 120 --autostart
termdeck task stop web --autostart
```

搜索历史模板：

```bash
termdeck search 'error|failed|panic|timeout' --regex --limit 50 --context 2
```

每次启动可复用的长跑 task 后，把 task 名、命令、cwd、端口或 ready 检查、日志命令和停止命令写进对应项目的 `.codex/harness/sessions.md`。

## 测试

```bash
pnpm test
pnpm exec tsx --test tests/doctor.test.ts
pnpm exec tsx --test tests/integration.test.ts
pnpm exec tsx --test tests/platform.test.ts
pnpm exec tsx --test tests/install-check.test.ts
```

- 改 CLI 输出、doctor、诊断逻辑：优先跑 `tests/doctor.test.ts`。
- 改 daemon/CLI 交互：优先跑 `tests/integration.test.ts`。
- 改信号、平台兼容：优先跑 `tests/platform.test.ts`。
- 改安装、node-pty rebuild：优先跑 `tests/install-check.test.ts`。

## 质量检查

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run smoke:daemon
pnpm run smoke:daemon -- --built
```

- `pnpm run smoke:daemon` 使用源码路径验证 daemon、CLI、doctor、session、日志和 Web API。
- `pnpm run smoke:daemon -- --built` 使用 `dist/` 验证发布形态，CI 也跑这个。

## Debug 与复现

```bash
TERMDECK_HOME="$(mktemp -d)" TERMDECK_WEB_PORT=8787 pnpm run dev:daemon
TERMDECK_HOME="$TERMDECK_HOME" pnpm run dev:cli -- doctor --require-daemon
TERMDECK_HOME="$TERMDECK_HOME" pnpm run dev:cli -- new repro --cwd "$PWD"
TERMDECK_HOME="$TERMDECK_HOME" pnpm run dev:cli -- step repro 'printf ok' --timeout-ms 5000 --lines 8
TERMDECK_HOME="$TERMDECK_HOME" pnpm run dev:cli -- log repro --lines 80
TERMDECK_HOME="$TERMDECK_HOME" pnpm run dev:cli -- events repro --limit 80
TERMDECK_HOME="$TERMDECK_HOME" pnpm run dev:cli -- inspect repro
```

## Docker / OrbStack

本机 Docker 默认按 OrbStack 处理。TermDeck 当前没有必需的容器开发路径；只有在需要复现 Linux-only 行为、容器内 shell、或用户明确要求 Docker 验证时才引入容器。

```bash
docker context ls
docker info
docker run --rm -it -v "$PWD:/work" -w /work node:24-bookworm bash
```

注意：

- 优先确认当前 Docker context 指向 OrbStack 提供的 engine。
- macOS 上的本机 smoke 仍然优先用 `pnpm run smoke:daemon`；Linux 容器 smoke 是补充证据，不替代 macOS 本机验证。
- 容器内调试 PTY、signals、文件权限时，要明确记录宿主 macOS + OrbStack + 容器镜像三层环境。

日志位置：

- daemon 日志：`$TERMDECK_HOME/termdeckd.log`
- session transcript：`$TERMDECK_HOME/sessions/<session>/transcript.log`
- events：`$TERMDECK_HOME/sessions/<session>/events.jsonl`
- metadata：`$TERMDECK_HOME/sessions/<session>/session.json`

## CI 等价命令

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run smoke:daemon -- --built
```

CI 运行在 `ubuntu-latest` 和 `macos-latest`，Node 24，pnpm 10.29.2。
