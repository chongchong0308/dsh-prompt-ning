import { readFileSync } from "node:fs";
import { sourcePromptPath } from "../paths.js";

/**
 * Tier 1：走宿主的 system-prompt 接口，直接把提示词作为 section 注册进去。
 * 只认明确存在的形状；认不出来就返回 ok:false，由 index.js 落到下一档。
 * 这是唯一一档可能随宿主大版本变化的实现 —— 变化时改这一个文件。
 */
export function apply({ ctx, marker = "dsh-prompt" } = {}) {
	const api = ctx && ctx.systemPrompt;
	if (!api || typeof api !== "object") {
		return { ok: false, tier: "section", reason: "ctx.systemPrompt unavailable" };
	}

	const text = readFileSync(sourcePromptPath(), "utf8");

	const registrar =
		(typeof api.registerSection === "function" && "registerSection") ||
		(typeof api.addSection === "function" && "addSection") ||
		false;

	if (!registrar) {
		return {
			ok: false,
			tier: "section",
			reason: `no registrar on ctx.systemPrompt (keys: ${Object.keys(api).slice(0, 8).join(",")})`,
		};
	}

	try {
		api[registrar]({ name: marker, order: 5100, content: text });
		return { ok: true, tier: "section", via: registrar, bytes: Buffer.byteLength(text) };
	} catch (err) {
		return { ok: false, tier: "section", reason: String((err && err.message) || err) };
	}
}
