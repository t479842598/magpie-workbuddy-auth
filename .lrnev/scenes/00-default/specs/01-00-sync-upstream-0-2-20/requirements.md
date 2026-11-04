---
spec: 01-00-sync-upstream-0-2-20
scene: 00-default
status: completed
priority: P1
created: '2026-11-04'
updated: '2026-11-04'
---

# 01-00 Sync Upstream 0 2 20 - 需求

## L0 摘要

把本地 workbuddy-auth fork 从上游 0.2.8 同步到 0.2.20，保留五条登录判定（verdicts）改动。

## L1 概览

### 目标

本地 path 插件 `~/.config/magpie/plugins/local/workbuddy-auth` 的代码、测试、入口结构与上游 0.2.20 一致，同时保留 fork 专属的五条 verdict 改动，且不破坏 magpie 的加载。

### 用户故事

- 作为本机 magpie 用户，我希望插件跟上上游 0.2.8→0.2.20 的额度、性能与参数修复，以便额度卡片和路由判断正确。
- 作为 fork 维护者，我希望五条 verdicts 在每次同步后仍然生效，以便 401 判定不被上游回退。

### 范围

**包含**：
- 上游 `packages/workbuddy` 0.2.20 的全部源码、测试、README、REFUSED、testdata
- `opencode.mjs` / `opencode2.mjs` 入口结构与 `package.json` 的 main/exports/files
- 五条 verdicts 的重放与 `verdicts.test.mjs`
- 哨兵脚本 BASE 与 `upstream-update.json`

**不包含**：
- 修改上游逻辑本身
- 发布到 npm 或推送 origin（由用户决定）
- magpie 应用本体的升级

## L2 详情

### 详细需求

#### F-01 同步上游 0.2.20
- 描述：用上游 0.2.20 的文件覆盖本地非 fork 专属文件，重放四段 index.mjs 改动。
- 验收：`package.json` version 为 0.2.20；`index.mjs` 含 0.2.20 逻辑与四段 fork 改动。

#### F-02 保留五条 verdicts
- 描述：`fresh`/`refreshed` 抛 `signIn: "expired"`、`unanswered` 的 401 标 `kept`、`explained` 空 body 可读化、`package.json` 的 `magpie.verdicts`。
- 验收：`verdicts.test.mjs` 与 `refresh.test.mjs` 反转断言全部通过。

### 非功能性需求

- 性能：ledger 读取不再 O(n²)，单次读取在 10ms 级。
- 兼容性：magpie 0.1.2766 读 `main`（opencode.mjs）；OpenCode 1.x/2.x 分别走 main / exports["."]。

### 边界与依赖

上游仓库 `magpie-community/plugins` 的 `packages/workbuddy`；npm 哨兵 `tools/check-upstream.sh`。

### 验收标准

- [x] `package.json` version = 0.2.20，`main` = `./opencode.mjs`
- [x] `HOME=$(mktemp -d) bun test` → 324 pass, 0 fail
- [x] 重启 magpie 后 WorkBuddy / WorkBuddy AI 均 `fetched just now`
- [x] Desktop 副本与本地一致
