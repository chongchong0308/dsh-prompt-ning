# CHANGELOG

## 0.1.0

首个版本。

- 三档降级注入：`section`（宿主接口）→ `file`（override 文件）→ `wrapper`（环境变量 + 全文副本）
- 能力探测代替版本比对：`lib/probe.js` 只问"接口在不在"，不问"你是哪个版本"
- 漂移自愈：`lib/watchdog.js` 比对 sha256 与状态时间，`dsh-prompt watchdog --fix` 可修复
- 写前备份：每次覆盖 override 前把旧文件落到 `~/.dsh/dsh-prompt/backups/`
- 手动兜底：`npm run inject` / `npm run inject:restore`
- 静态检查：`npm run check`（语法 + 入口 import + 提示词存在 + 探针集完整性）
- 探针跑分：`npm run probes` 出跑分表，`npm run score -- DIR` 自动判禁用串项
- 提示词源：`prompt/default.md`（与代码解耦，换内容不动代码）
