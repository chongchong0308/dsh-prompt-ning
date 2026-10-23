#!/usr/bin/env node
/**
 * 发布门槛 / 本地自检：
 *   1) 全部模块语法可解析
 *   2) 入口能被 import
 *   3) 提示词源存在且非空
 *   4) 探针集是 30 条、id 唯一
 * 用法：node scripts/check.mjs
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".git", "probes", "prompt"]);
const EXT = new Set([".js", ".mjs"]);

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (SKIP.has(name)) continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (EXT.has(extname(name))) out.push(full);
	}
	return out;
}

const errors = [];
const files = walk(root);

for (const file of files) {
	const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
	if (check.status !== 0) {
		errors.push(`SYNTAX ${relative(root, file)}: ${(check.stderr || "").split("\n").slice(0, 2).join(" ").trim()}`);
	}
}

const entry = join(root, "lib", "index.js");
try {
	const mod = await import(pathToFileURL(entry).href);
	if (mod.name !== "dsh-prompt") errors.push(`IMPORT entry export name=${mod.name}`);
	if (typeof mod.apply !== "function") errors.push("IMPORT entry missing apply()");
} catch (err) {
	errors.push(`IMPORT entry: ${(err && err.message) || err}`);
}

const promptPath = join(root, "prompt", "default.md");
try {
	const bytes = statSync(promptPath).size;
	if (bytes < 4096) errors.push(`PROMPT too small: ${bytes} B`);
} catch {
	errors.push("PROMPT missing: prompt/default.md");
}

try {
	const probes = JSON.parse(readFileSync(join(root, "probes", "probes.json"), "utf8"));
	const ids = new Set(probes.map((p) => p.id));
	if (probes.length !== 30) errors.push(`PROBES count=${probes.length}, want 30`);
	if (ids.size !== probes.length) errors.push("PROBES duplicate id");
} catch (err) {
	errors.push(`PROBES unreadable: ${(err && err.message) || err}`);
}

console.log(`modules ${files.length}`);
for (const e of errors) console.log(`  ${e}`);
console.log(errors.length ? `FAILED ${errors.length}` : "OK");
process.exitCode = errors.length ? 1 : 0;
