import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "../paths.js";
import { sha256 } from "../hash.js";

/**
 * Tier 2：最外层兜底。不假设宿主有任何接口，只落地两份东西：
 *   prompt.env  —— 供启动器 / 包装脚本读取的环境变量清单
 *   prompt.full.md —— 完整提示词副本，手动粘贴或外部注入用
 * 这一档在宿主彻底改掉装配机制时仍然能用。
 */
export function apply({ dryRun = false } = {}) {
	const dir = stateDir();
	const envPath = join(dir, "prompt.env");
	const fullPath = join(dir, "prompt.full.md");

	const text = readFileSync(new URL("../../prompt/default.md", import.meta.url), "utf8");
	const lines = [
		"# dsh-prompt wrapper tier",
		`# sha256=${sha256(text)}`,
		`DSH_PROMPT_FILE=${fullPath}`,
		`DSH_PROMPT_SHA256=${sha256(text)}`,
	];

	if (dryRun) {
		return { ok: true, tier: "wrapper", dryRun: true, envPath, fullPath };
	}

	mkdirSync(dir, { recursive: true });
	writeFileSync(envPath, `${lines.join("\n")}\n`, "utf8");
	writeFileSync(fullPath, text, "utf8");
	return { ok: true, tier: "wrapper", envPath, fullPath, sha: sha256(text) };
}
