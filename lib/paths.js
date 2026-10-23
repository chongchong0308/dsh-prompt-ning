import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** DSH 主目录；测试时用 DSH_PROMPT_HOME 指到临时目录，避免碰到真实环境。 */
export function dshHome() {
	return process.env.DSH_PROMPT_HOME || join(homedir(), ".dsh");
}

export function stateDir() {
	return join(dshHome(), "dsh-prompt");
}

export function statePath() {
	return join(stateDir(), "state.json");
}

/** Tier 0 目标：DSH 读的那份 override 文件。 */
export function promptTargetPath() {
	return process.env.DSH_PROMPT_TARGET || join(dshHome(), "prompt-inject.md");
}

export function backupDir() {
	return join(stateDir(), "backups");
}

/** 包内提示词源文件。 */
export function sourcePromptPath() {
	return process.env.DSH_PROMPT_SOURCE || resolve(dirname(fileURLToPath(import.meta.url)), "..", "prompt", "default.md");
}
