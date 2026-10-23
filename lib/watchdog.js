import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./hash.js";
import { promptTargetPath, sourcePromptPath } from "./paths.js";
import { readState } from "./state.js";
import { probe } from "./probe.js";
import * as fileBackend from "./backends/file.js";
import * as sectionBackend from "./backends/section.js";
import * as wrapperBackend from "./backends/wrapper.js";

/**
 * 漂移检测：目标文件是否仍等于包内那份、上一次状态是否过期。
 * 只看事实，不猜原因 —— 供 watchdog 决定要不要修。
 */
export function check({ maxAgeHours = 72 } = {}) {
	const target = promptTargetPath();
	const source = sourcePromptPath();

	if (!existsSync(source)) return { needsRepair: false, reason: "source missing" };
	const wantSha = sha256(readFileSync(source, "utf8"));

	if (!existsSync(target)) {
		return { needsRepair: true, reason: "target missing", wantSha, target };
	}

	const gotSha = sha256(readFileSync(target, "utf8"));
	if (gotSha !== wantSha) {
		return { needsRepair: true, reason: "target drift", wantSha, gotSha, target };
	}

	const state = readState();
	if (!state || !state.at) return { needsRepair: false, reason: "no state but target matches", wantSha, gotSha };

	const ageH = (Date.now() - new Date(state.at).getTime()) / 3.6e6;
	if (!Number.isFinite(ageH) || ageH > maxAgeHours) {
		return { needsRepair: true, reason: `state stale (${Math.round(ageH)}h)`, wantSha, gotSha, target };
	}

	return { needsRepair: false, reason: "in sync", wantSha, gotSha };
}

export async function repair(options = {}) {
	const v = check(options);
	if (!v.needsRepair) return { ok: true, skipped: v.reason };
	const p = await probe();
	const backend = p.chosen === "section" ? sectionBackend : p.chosen === "wrapper" ? wrapperBackend : fileBackend;
	const res = backend.apply({ dryRun: options.dryRun });
	return { ok: res.ok !== false, tier: p.chosen, result: res, before: v.reason };
}
