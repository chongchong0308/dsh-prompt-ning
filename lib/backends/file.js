import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "../hash.js";
import { backupDir, promptTargetPath, sourcePromptPath } from "../paths.js";

function stamp() {
	return new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
}

/** Tier 0：把包内提示词写到 DSH 读取的 override 路径，写前备份。 */
export function apply({ dryRun = false } = {}) {
	const source = sourcePromptPath();
	const target = promptTargetPath();

	if (!existsSync(source)) {
		return { ok: false, tier: "file", reason: `source missing: ${source}` };
	}

	const text = readFileSync(source, "utf8");
	const nextSha = sha256(text);
	const prev = existsSync(target) ? readFileSync(target, "utf8") : null;
	const prevSha = prev === null ? null : sha256(prev);

	if (prev !== null && prevSha === nextSha) {
		return { ok: true, tier: "file", changed: false, target, sha: nextSha };
	}

	if (dryRun) {
		return { ok: true, tier: "file", changed: true, dryRun: true, target, sha: nextSha, prevSha };
	}

	mkdirSync(backupDir(), { recursive: true });
	let backup = null;
	if (prev !== null) {
		backup = join(backupDir(), `${stamp()}-prompt-inject.md`);
		copyFileSync(target, backup);
	}
	writeFileSync(target, text, "utf8");

	return { ok: true, tier: "file", changed: true, target, sha: nextSha, prevSha, backup };
}

/** 用最新备份还原；没有备份就把目标文件移走。 */
export function revert({ dryRun = false } = {}) {
	const target = promptTargetPath();
	const dir = backupDir();
	const latest = listBackups()[0];
	if (!latest) {
		return { ok: false, tier: "file", reason: "no backup", target };
	}
	if (dryRun) {
		return { ok: true, tier: "file", dryRun: true, target, restoredFrom: latest };
	}
	const text = readFileSync(latest, "utf8");
	writeFileSync(target, text, "utf8");
	return { ok: true, tier: "file", target, restoredFrom: latest, sha: sha256(text) };
}

export function listBackups() {
	try {
		return readdirSync(backupDir())
			.filter((name) => name.endsWith("-prompt-inject.md"))
			.sort((a, b) => (a < b ? 1 : -1))
			.map((name) => join(backupDir(), name));
	} catch {
		return [];
	}
}
