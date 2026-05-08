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
