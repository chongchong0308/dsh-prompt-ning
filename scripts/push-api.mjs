#!/usr/bin/env node
/**
 * 通过 GitHub API 推送（git push 走不通时的替代通道）。
 * api.github.com 通常可达，github.com:443 常常不可达。
 *
 * 用法：
 *   $env:GH_TOKEN="ghp_xxx"
 *   node scripts/push-api.mjs --owner chongchong0308 --repo dsh-prompt-ning [--branch main] [--message "..."]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const owner = arg("owner");
const repo = arg("repo");
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const branch = arg("branch", "main");
const message = arg("message", "feat: dsh-prompt 0.1.0");
const root = resolve(arg("path", fileURLToPath(new URL("..", import.meta.url))));

if (!owner || !repo || !token) {
	console.error("need --owner, --repo and GH_TOKEN in env");
	process.exit(2);
}

const api = "https://api.github.com";
const headers = {
	authorization: `token ${token}`,
	accept: "application/vnd.github+json",
	"user-agent": "dsh-prompt-api",
	"x-github-api-version": "2022-11-28",
};

async function gh(method, path, body) {
	const res = await fetch(`${api}${path}`, {
		method,
		headers: body ? { ...headers, "content-type": "application/json; charset=utf-8" } : headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
	return text ? JSON.parse(text) : null;
}

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (name === ".git" || name === ".tmp" || name === "node_modules") continue;
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) walk(full, out);
		else out.push(full);
	}
	return out;
}

const info = await gh("GET", `/repos/${owner}/${repo}`);
console.log(`repo   -> ${info.full_name} private=${info.private} default=${info.default_branch} size=${info.size}`);

let parentSha = null;
let baseTree = null;
try {
	const ref = await gh("GET", `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
	parentSha = ref.object.sha;
	const commit = await gh("GET", `/repos/${owner}/${repo}/git/commits/${parentSha}`);
	baseTree = commit.tree.sha;
	console.log(`parent -> ${parentSha} (tree ${baseTree})`);
} catch {
	console.log("parent -> none (first push)");
}

const files = walk(root);
console.log(`files  -> ${files.length}`);

// 空仓库不能直接 create blob（409 Git Repository is empty）。
// 先用 Contents API 提交一个文件把仓库初始化，再走 blob/tree/commit。
if (!parentSha) {
	const seed = files.find((f) => relative(root, f).replace(/\\/g, "/") === "README.md") || files[0];
	const seedRel = relative(root, seed).split("\\").join("/");
	const seeded = await gh("PUT", `/repos/${owner}/${repo}/contents/${seedRel}`, {
		message: "chore: init repository",
		content: readFileSync(seed).toString("base64"),
	});
	parentSha = seeded.commit.sha;
	const parentCommit = await gh("GET", `/repos/${owner}/${repo}/git/commits/${parentSha}`);
	baseTree = parentCommit.tree.sha;
	console.log(`seeded -> ${seedRel} (commit ${parentSha})`);
}

const entries = [];
let i = 0;
for (const file of files) {
	i += 1;
	const rel = relative(root, file).split("\\").join("/");
	const blob = await gh("POST", `/repos/${owner}/${repo}/git/blobs`, {
		content: readFileSync(file).toString("base64"),
		encoding: "base64",
	});
	entries.push({ path: rel, mode: "100644", type: "blob", sha: blob.sha });
	if (i % 5 === 0 || i === files.length) process.stdout.write(`  ${i}/${files.length} ${rel}\n`);
}

const treeBody = { tree: entries };
if (baseTree) treeBody.base_tree = baseTree;
const tree = await gh("POST", `/repos/${owner}/${repo}/git/trees`, treeBody);
console.log(`tree   -> ${tree.sha}`);

const commitBody = { message, tree: tree.sha };
if (parentSha) commitBody.parents = [parentSha];
const newCommit = await gh("POST", `/repos/${owner}/${repo}/git/commits`, commitBody);
console.log(`commit -> ${newCommit.sha}`);

if (parentSha) {
	await gh("PATCH", `/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha: newCommit.sha, force: false });
} else {
	await gh("POST", `/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: newCommit.sha });
}
console.log(`ref    -> refs/heads/${branch}`);

const check = await gh("GET", `/repos/${owner}/${repo}/git/trees/${tree.sha}?recursive=1`);
console.log(`verify -> ${check.tree.length} entries on remote`);
console.log(`\ndone -> https://github.com/${owner}/${repo}`);
