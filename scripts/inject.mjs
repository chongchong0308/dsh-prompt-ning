#!/usr/bin/env node
/**
 * 手动兜底：把包内提示词写到 DSH override 路径。
 * 宿主任何一档都失效时，一条命令恢复效果。
 *   node scripts/inject.mjs [--dry-run] [--restore]
 */
import { probe } from "../lib/probe.js";
import * as fileBackend from "../lib/backends/file.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const restore = args.includes("--restore");

const p = await probe();
const res = restore ? fileBackend.revert({ dryRun }) : fileBackend.apply({ dryRun });

process.stdout.write(`${JSON.stringify({ tier: p.chosen, dryRun, action: restore ? "revert" : "apply", result: res }, null, 2)}\n`);
process.exitCode = res.ok === false ? 1 : 0;
