import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { statePath, stateDir } from "./paths.js";

export function readState() {
	try {
		return JSON.parse(readFileSync(statePath(), "utf8"));
	} catch {
		return null;
	}
}

export function writeState(patch) {
	mkdirSync(stateDir(), { recursive: true });
	const prev = readState() || {};
	const next = { ...prev, ...patch, at: new Date().toISOString() };
	writeFileSync(statePath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
	return next;
}
