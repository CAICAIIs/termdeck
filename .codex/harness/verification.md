# 验证梯度

## 梯度 1：最小复现或目标测试

按改动选择一个最窄入口：

- CLI/doctor：`pnpm exec tsx --test tests/doctor.test.ts`
- daemon 协议和 CLI：`pnpm exec tsx --test tests/integration.test.ts`
- 平台信号：`pnpm exec tsx --test tests/platform.test.ts`
- 安装和 native binding：`pnpm exec tsx --test tests/install-check.test.ts`
- 手动复现：`TERMDECK_HOME="$(mktemp -d)" pnpm run smoke:daemon`

成功证据要包含命令、退出码、关键输出。

## 梯度 2：相关套件

```bash
pnpm test
pnpm run smoke:daemon
```

daemon、CLI、Web API、日志或事件行为变更时，必须至少跑到这一层。

## 梯度 3：全量本地质量门

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run smoke:daemon -- --built
```

发布形态、CI、安装、平台适配、协议或 CLI 改动完成前必须跑到这一层。

## 验收映射

- “能安装”：`pnpm install --frozen-lockfile`、`node scripts/install-check.mjs`、`termdeck doctor`。
- “daemon 能工作”：`pnpm run smoke:daemon` 或 `pnpm run smoke:daemon -- --built`。
- “agent 可稳定 step”：`termdeck step <session> ... --timeout-ms ... --lines ...` 输出目标文本和 `[termdeck] status=ready`。
- “可调试”：`termdeck doctor`、`termdeck log`、`termdeck events`、`termdeck inspect` 能给出明确证据。
- “跨平台”：本机测试通过，并让 CI 覆盖 Ubuntu/macOS。
- “Linux 容器复现”：仅在需要时使用 OrbStack Docker，记录 `docker context ls`、`docker info`、镜像名和容器内命令输出。

## 最终声明前检查

- `git diff --stat` 和 `git diff` 已看过。
- 没有提交 `dist/`、临时目录、日志、`.termdeck*`、`.humanize` 或秘密。
- 新增命令已写入 `commands.md`。
- 新增行为有测试或 smoke 证据。
- 如果用了 OpenSpec/Humanize，最终总结要链接 spec/plan/loop 目录和测试证据。
