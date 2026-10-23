#!/usr/bin/env node
import { probe } from "../lib/probe.js";
import { check, repair } from "../lib/watchdog.js";
import { readState } from "../lib/state.js";
import * as fileBackend from "../lib/backends/file.js";
import * as wrapperBackend from "../lib/backends/wrapper.js";

const argv = process.argv.slice(2);
const cmd = argv[0] || "status";
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
	const hit = argv.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : fallback;
};

const dryRun = flag("dry-run");

function out(obj) {
	process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

async function main() {
	switch (cmd) {
		case "probe": {
			return out(await probe());
		}
		case "status": {
			const state = readState();
			const wd = check({ maxAgeHours: Number(opt("max-age-hours", 72)) });
			const p = await probe();
			return out({ state, watchdog: wd, probe: { chosen: p.chosen, tiers: p.tiers } });
		}
		case "install": {
			const p = await probe();
			const tier = opt("tier", p.chosen);
			const backend = tier === "wrapper" ? wrapperBackend : fileBackend;
			return out({ tier, result: backend.apply({ dryRun }) });
		}
		case "revert": {
			return out(fileBackend.revert({ dryRun }));
		}
		case "watchdog": {
			const res = flag("fix") ? await repair({ dryRun }) : check({ maxAgeHours: Number(opt("max-age-hours", 72)) });
			return out(res);
		}
		default: {
			process.stderr.write(`unknown command: ${cmd}\nusage: dsh-prompt <status|probe|install|revert|watchdog> [--dry-run] [--fix]\n`);
			process.exitCode = 2;
		}
	}
}

main().catch((err) => {
	process.stderr.write(`${(err && err.stack) || err}\n`);
	process.exitCode = 1;
});
