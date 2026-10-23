import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { dshHome, promptTargetPath, stateDir } from "./paths.js";

function writable(dir) {
	try {
		mkdirSync(dir, { recursive: true });
		accessSync(dir, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Tier 1：宿主是否还导出可用的装配/分段接口。
 * 只做能力探测，不比对版本号 —— 版本升了但接口还在，这里照样通过。
 */
export async function probeSectionApi(ctx) {
	if (ctx && typeof ctx.systemPrompt === "object" && ctx.systemPrompt) {
		return { ok: true, keys: Object.keys(ctx.systemPrompt).slice(0, 12), via: "ctx" };
	}
	try {
		const mod = await import("@deepseek-ai/dsh-system-prompt");
		const keys = Object.keys(mod);
		const ok = keys.some((k) => /assemble|section/i.test(k));
		return { ok, keys: keys.slice(0, 12), via: "import", reason: ok ? "" : "no assemble/section export" };
	} catch (err) {
		return { ok: false, keys: [], via: "import", reason: String((err && (err.code || err.message)) || err) };
	}
}

export async function probe({ ctx } = {}) {
	const tiers = {};

	tiers.section = await probeSectionApi(ctx);

	const target = promptTargetPath();
	tiers.file = {
		ok: writable(dirname(target)),
		path: target,
		exists: existsSync(target),
	};

	tiers.wrapper = {
		ok: writable(stateDir()),
		dir: stateDir(),
	};

	const order = ["section", "file", "wrapper"];
	const chosen = order.find((name) => tiers[name] && tiers[name].ok) || "wrapper";

	return { chosen, tiers, dshHome: dshHome() };
}
