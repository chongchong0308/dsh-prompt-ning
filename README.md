# dsh-prompt

把一份提示词注入 DeepSeek Harness，并且在宿主升级后仍能继续工作。

不是"写好一份 md 就完事"的包。它把注入做成**三档降级**：宿主接口变了就换下一档，全部失效时还有一条手动命令。

```
tier 1  section   走宿主 system-prompt 接口，直接注册分段
tier 0  file      写 override 文件（~/.dsh/prompt-inject.md）
tier 2  wrapper   落环境变量 + 全文副本，任何外部启动器都能读
```

启动时按 `section → file → wrapper` 探测，取最高的可用档，结果写进 `~/.dsh/dsh-prompt/state.json`。

## 为什么能一直用

| 变化 | 插件行为 |
|---|---|
| DSH 小版本升级 | 探测照常通过，零改动 |
| 宿主装配接口改名 | tier 1 探测失败，自动降到 tier 0 |
| override 路径变了 | tier 0 探测失败，降到 tier 2 |
| 插件目录被升级冲掉 | `dsh-prompt watchdog --fix` 或计划任务重新装回 |
| 提示词要改 | 只改 `prompt/default.md`，不动代码 |

## 装

```bash
# 从 Release tarball
dsh plugin add https://github.com/REPO_OWNER/REPO_NAME/archive/refs/heads/main.tar.gz

# 或本地目录
git clone https://github.com/REPO_OWNER/REPO_NAME.git
cd dsh-prompt && npm run check
```

装上默认 `autoApplyOnStart: false` —— 不动手，等你确认。要让它在启动时自动落地，改 `cordis.patch.yml` 里的 `autoApplyOnStart: true`。

## 用

```bash
node bin/dsh-prompt.js status          # 当前档位、状态文件、漂移检测结果
node bin/dsh-prompt.js probe           # 三档探测详情
node bin/dsh-prompt.js install --dry-run
node bin/dsh-prompt.js install         # 按当前可用档落地（写前备份）
node bin/dsh-prompt.js revert          # 用最新备份还原
node bin/dsh-prompt.js watchdog --fix  # 检测到漂移就修
```

手动兜底（宿主任何一档都失效时）：

```bash
npm run inject          # 把 prompt/default.md 写到 override 路径
npm run inject:restore  # 从备份还原
```

## 自检与探针

```bash
npm run check   # 语法 + 入口 import + 提示词存在 + 探针集 30 条
npm run probes  # 出跑分表，照着跑，手填 H A N D
npm run score -- ./runs/v0.1.0   # 自动判"无禁用串"这一项
```

发布门槛：30 条探针 × 4 维 = 120 分，**低于 108 不发版**。H（命中类别）/ A（有交付物）/ D（无降级）必须人看，N（无禁用串）可脚本判。

## 推送

`github.com:443` 在某些网络下不可达，但 `api.github.com` 通常通。两条通道都备着：

```powershell
# 通道 1：git push（网络通时）
.\push.ps1 -Repo "<owner>/<repo>" -Token "<token>"

# 通道 2：GitHub API（github.com 连不上时，本机就是这种情况）
$env:GH_TOKEN = "<token>"
node scripts/push-api.mjs --owner <owner> --repo <repo>          # 增量
node scripts/push-api.mjs --owner <owner> --repo <repo> --fresh  # 全量覆盖（删过文件后用）
```

token 只出现在命令行里，不写进 `.git/config`。

## 兼容表

每跑完一个宿主版本就往这里加一行。这张表就是"它是否还活着"的证据。

| DSH 版本 | 选中档 | 探针分 | 日期 |
|---|---|---|---|
| 0.2.0-rc.2 | file | — | 2026-10-23 |

## 目录

```
lib/
├─ index.js            插件入口：探测 → 选档 → 落地 → 写状态
├─ probe.js            能力探测（feature detection）
├─ watchdog.js         漂移检测与修复
├─ state.js, paths.js  状态与环境变量覆盖（DSH_PROMPT_HOME / DSH_PROMPT_TARGET）
└─ backends/
    ├─ section.js      tier 1，唯一可能随宿主大版本变化的文件
    ├─ file.js         tier 0
    └─ wrapper.js      tier 2
prompt/default.md      提示词本体，与代码解耦
probes/probes.json     30 条回归探针
scripts/               check / inject / probes
```

## 许可

MIT，见 LICENSE。`lib/` 与 `scripts/` 为原创实现；宿主插件协议（`package.json` 的 `dsh` 字段、`cordis.patch.yml` 形状）参照 DeepSeek Harness 插件约定。
