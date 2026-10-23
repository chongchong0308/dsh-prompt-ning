import { probe } from "./probe.js";
import { readState, writeState } from "./state.js";
import { check, repair } from "./watchdog.js";
import * as fileBackend from "./backends/file.js";
import * as sectionBackend from "./backends/section.js";
import * as wrapperBackend from "./backends/wrapper.js";

export const name = "dsh-prompt";
export const inject = ["systemPrompt"];

const BACKENDS = { section: sectionBackend, file: fileBackend, wrapper: wrapperBackend };

/**
 * cordis 插件入口。装配顺序：探测能力 → 选档 → （按配置）落地 → 写状态。
 * 任何一步失败都只记录，不抛 —— 插件坏掉时宿主应当照常启动。
 */
export function apply(ctx, config = {}) {
	const cfg = {
		enabled: true,
		tier: "auto",
		autoApplyOnStart: false,
		watchdog: true,
		maxAgeHours: 72,
		verbose: false,
		...config,
	};
	if (!cfg.enabled) {
		writeState({ enabled: false });
		return;
	}

	const run = async () => {
		const p = await probe({ ctx });
		const tier = cfg.tier === "auto" ? p.chosen : cfg.tier;
		const backend = BACKENDS[tier] || fileBackend;

		let applyResult = { ok: true, skipped: "autoApplyOnStart=false" };
		if (cfg.autoApplyOnStart) {
			applyResult = backend.apply({ ctx });
			if (applyResult.ok === false && tier !== "file") {
				applyResult = { ...fileBackend.apply({}), fellBackFrom: tier };
			}
		}

		const wd = cfg.watchdog ? check({ maxAgeHours: cfg.maxAgeHours }) : { needsRepair: false, reason: "watchdog off" };

		writeState({
			tier,
			probe: { chosen: p.chosen, tiers: p.tiers },
			lastApply: applyResult,
			watchdog: wd,
			pid: process.pid,
		});

		if (cfg.verbose) {
			console.log(`[dsh-prompt] tier=${tier} apply=${JSON.stringify(applyResult)} watchdog=${wd.reason}`);
		}
		return { tier, applyResult, wd };
	};

	run().catch((err) => writeState({ error: String((err && err.message) || err) }));

	if (ctx && typeof ctx.on === "function") {
		try {
			ctx.on("ready", () => {
				run().catch((err) => writeState({ error: String((err && err.message) || err) }));
			});
		} catch {
			// 宿主没有 ready 事件就不挂，启动那次已经跑过。
		}
	}
}

export const dshPrompt = { check, repair, probe, readState };
